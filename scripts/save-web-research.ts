/**
 * @fileoverview CLI script that persists built-in web tool research results (web_search,
 * web_fetch) into a timestamped session folder under `.researches/`. Bridges the
 * reproducibility gap between Firecrawl-only and hybrid research workflows by saving
 * web tool results alongside the same session layout used by `save-research.ts`.
 *
 * Owned by the `research-online/SKILL.md` skill; agents invoke this after
 * web_search/web_fetch calls when Firecrawl is unavailable or when simple queries
 * don't need Firecrawl-level extraction.
 *
 * @example
 * ```bash
 * # Save a web_search result as JSON (no cleaning for search JSON)
 * npx tsx skills/research-online/scripts/save-web-research.ts \
 *   --query "Better Auth vs NextAuth" \
 *   --source search \
 *   --results /tmp/search-results.json
 *
 * # Save a web_fetch result (content cleaning enabled by default)
 * npx tsx skills/research-online/scripts/save-web-research.ts \
 *   --query "Drizzle ORM connection pooling" \
 *   --source fetch \
 *   --results /tmp/page-content.md \
 *   --url "https://orm.drizzle.team/docs/connect-overview"
 *
 * # Save a web_fetch result with cleaning disabled (raw content preserved)
 * npx tsx skills/research-online/scripts/save-web-research.ts \
 *   --query "Drizzle ORM connection pooling" \
 *   --source fetch \
 *   --results /tmp/page-content.md \
 *   --url "https://orm.drizzle.team/docs/connect-overview" \
 *   --no-clean
 * ```
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/save-web-research.ts --query "test" --source search --content '{}'
 * @see skills/research-online/SKILL.md - Skill workflow documentation for research sessions.
 * @see skills/research-online/scripts/save-research.ts - Firecrawl artifact persistence.
 * @see skills/research-online/scripts/research-session.ts - Session layout library.
 * @documentation reviewed=2026-05-18 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  cleanWebContent,
  type CleanOptions,
} from "./clean-web-content";
import {
  ensureResearchSession,
  type Metadata,
  type ResearchSessionLayout,
} from "./research-session";

/** Supported web research source types. */
type WebResearchSource = "search" | "fetch" | "hybrid";

/**
 * Options for persisting web tool research results into a session folder.
 *
 * @remarks
 * Callers provide either `resultsPath` (path to a file on disk) or `content` (inline string content),
 * but not both. `sessionDir` reuses an existing session root when provided.
 */
type SaveWebResearchOptions = {
  clean?: CleanOptions | boolean;
  /**
   * When true, skip content cleaning even for fetch content.
   * Content cleaning is enabled by default for fetch and hybrid sources.
   */
  noClean?: boolean;
  content?: string;
  metadata?: Metadata;
  query: string;
  resultsPath?: string;
  sessionDir?: string;
  source: WebResearchSource;
  url?: string;
};

/**
 * Determines the file extension and subdirectory path based on the source type.
 *
 * @remarks
 * Search results are saved as JSON under `web-search/`. Fetch results are saved
 * with their original extension (or `.md` default) under `web-fetch/`. Hybrid
 * results are saved under both directories.
 */
function resolveArtifactPath(
  source: WebResearchSource,
  outputDir: string,
  filename: string,
): string {
  if (source === "search") {
    const dir = path.join(outputDir, "web-search");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, filename.endsWith(".json") ? filename : `${filename}.json`);
  }

  if (source === "fetch") {
    const dir = path.join(outputDir, "web-fetch");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, filename);
  }

  // hybrid: save under web-research/
  const dir = path.join(outputDir, "web-research");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

/**
 * Generates a filesystem-safe filename from a URL for fetch results.
 *
 * @remarks
 * Strips the protocol, replaces non-alphanumeric characters with hyphens,
 * and appends `.md` if no extension is present.
 */
function urlToFilename(url: string): string {
  const parsed = new URL(url);
  let base = parsed.hostname + parsed.pathname;
  base = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  if (base.endsWith("-")) {
    base = base.slice(0, -1);
  }
  if (!base.includes(".")) {
    base = `${base}.md`;
  }
  return base;
}

/** Mutable slice of cleaning stats and primary artifact path after each persist step. */
type WebResearchPersistState = {
  cleanReduction: number;
  originalLength: number;
  savedPath: string | null;
};

/**
 * Resolves cleaning options from explicit flags and source defaults.
 *
 * @remarks
 * Mirrors CLI semantics: `--clean` / object `clean`, `--no-clean`, then default clean for
 * fetch and hybrid only.
 */
function resolveWebResearchCleanOptions(
  options: SaveWebResearchOptions,
): CleanOptions | undefined {
  if (options.clean === true) {
    return { source: options.source };
  }
  if (typeof options.clean === "object") {
    return options.clean;
  }
  if (options.noClean === true) {
    return undefined;
  }
  return options.source !== "search" ? { source: options.source } : undefined;
}

/**
 * Builds the artifact basename for saved web results (file or inline).
 *
 * @remarks
 * Fetch results with a URL reuse `urlToFilename`; otherwise uses timestamp and extension.
 */
function buildWebResearchArtifactBasename(
  source: WebResearchSource,
  url: string | undefined,
  timestamp: string,
  extension: string,
): string {
  if (source === "fetch" && typeof url === "string") {
    return urlToFilename(url);
  }
  const ext = extension.length > 0 ? extension : ".json";
  return `${timestamp}-${source}-results${ext}`;
}

/**
 * True when cleaning should run (non-search sources with resolved clean options).
 */
function webResearchShouldApplyCleaning(
  cleanOptions: CleanOptions | undefined,
  source: WebResearchSource,
): boolean {
  return Boolean(cleanOptions && source !== "search");
}

/**
 * Persists `--results` file content into the session when the path is a readable file.
 *
 * @remarks
 * I/O: May read, clean, and write or copy into `resolveArtifactPath` destination.
 */
function persistWebResearchFromResultsFile(options: {
  cleanOptions: CleanOptions | undefined;
  layoutSessionDir: string;
  persist: SaveWebResearchOptions;
  timestamp: string;
}): WebResearchPersistState {
  const { cleanOptions, layoutSessionDir, persist, timestamp } = options;
  let savedPath: string | null = null;
  let cleanReduction = 0;
  let originalLength = 0;

  if (typeof persist.resultsPath !== "string") {
    return { savedPath, cleanReduction, originalLength };
  }

  const resolvedPath = path.resolve(persist.resultsPath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    console.warn(`Warning: results path does not exist or is not a file: ${resolvedPath}`);
    return { savedPath, cleanReduction, originalLength };
  }

  const ext = path.extname(resolvedPath);
  const filename = buildWebResearchArtifactBasename(
    persist.source,
    persist.url,
    timestamp,
    ext || ".json",
  );
  const destination = resolveArtifactPath(persist.source, layoutSessionDir, filename);
  const shouldClean = webResearchShouldApplyCleaning(cleanOptions, persist.source);

  if (shouldClean && cleanOptions) {
    const rawContent = fs.readFileSync(resolvedPath, "utf8");
    originalLength = rawContent.length;
    const cleanedContent = cleanWebContent(rawContent, cleanOptions);
    cleanReduction = originalLength - cleanedContent.length;
    fs.writeFileSync(destination, cleanedContent, "utf8");
  } else {
    fs.copyFileSync(resolvedPath, destination);
  }

  savedPath = destination;
  console.log(`Saved results file: ${destination}`);
  return { savedPath, cleanReduction, originalLength };
}

/**
 * Persists inline `--content` into the session layout.
 *
 * @remarks
 * I/O: Writes UTF-8 text to the resolved artifact path; optional cleaning for non-search sources.
 */
function persistWebResearchFromInlineContent(options: {
  cleanOptions: CleanOptions | undefined;
  layoutSessionDir: string;
  persist: SaveWebResearchOptions;
  timestamp: string;
}): WebResearchPersistState {
  const { cleanOptions, layoutSessionDir, persist, timestamp } = options;
  let savedPath: string | null = null;
  let cleanReduction = 0;
  let originalLength = 0;

  if (typeof persist.content !== "string") {
    return { savedPath, cleanReduction, originalLength };
  }

  const filename = buildWebResearchArtifactBasename(
    persist.source,
    persist.url,
    timestamp,
    ".json",
  );
  const destination = resolveArtifactPath(persist.source, layoutSessionDir, filename);
  let contentToSave = persist.content;
  const shouldClean = webResearchShouldApplyCleaning(cleanOptions, persist.source);

  if (shouldClean && cleanOptions) {
    originalLength = persist.content.length;
    contentToSave = cleanWebContent(persist.content, cleanOptions);
    cleanReduction = originalLength - contentToSave.length;
  }

  fs.writeFileSync(destination, contentToSave, "utf8");
  savedPath = destination;
  console.log(`Saved inline content: ${destination}`);
  return { savedPath, cleanReduction, originalLength };
}

/**
 * Prints session layout paths and optional cleaning summary lines.
 */
function logWebResearchSaveSessionSummary(options: {
  cleanOptions: CleanOptions | undefined;
  cleanReduction: number;
  layout: ResearchSessionLayout;
  originalLength: number;
  savedPath: string | null;
}): void {
  const {
    cleanOptions,
    cleanReduction,
    layout,
    originalLength,
    savedPath,
  } = options;
  const webSearchDir = path.join(layout.sessionDir, "web-search");
  const webFetchDir = path.join(layout.sessionDir, "web-fetch");
  const webResearchDir = path.join(layout.sessionDir, "web-research");

  console.log(`\nWeb research session saved to: ${layout.sessionDir}`);
  console.log(`  Documentation artifacts: ${layout.documentationDir}`);
  console.log(`    - Markdown: ${layout.documentationMarkdownDir}`);
  console.log(`    - HTML: ${layout.documentationHtmlDir}`);
  console.log(`  Web search results: ${webSearchDir}`);
  console.log(`  Web fetch results: ${webFetchDir}`);
  console.log(`  Web research (hybrid): ${webResearchDir}`);
  console.log(`  Firecrawl raw results: ${layout.firecrawlRawDir}`);
  console.log(`  Metadata: ${layout.metadataPath}`);

  if (savedPath) {
    console.log(`  Primary artifact: ${savedPath}`);
  }

  if (cleanReduction > 0) {
    const percent =
      originalLength > 0
        ? ((cleanReduction / originalLength) * 100).toFixed(1)
        : "0.0";
    console.log(
      `  Content cleaning: ${cleanReduction} chars removed (${percent}% reduction)`,
    );
  } else if (cleanOptions) {
    console.log(`  Content cleaning: no chrome detected (content already clean)`);
  }
}

/**
 * Ensures a research session folder, ingests web tool results, writes metadata,
 * and prints layout paths.
 *
 * @remarks
 * I/O: Creates session directories via `ensureResearchSession`, writes result files,
 * and updates metadata.json with source information. Returns the session directory path.
 */
function saveWebResearch(options: SaveWebResearchOptions): string {
  const layout = ensureResearchSession({
    query: options.query,
    metadata: {
      ...options.metadata,
      source: options.source,
      ...(options.url ? { url: options.url } : {}),
      tool: "web-tools",
    },
    sessionDir: options.sessionDir,
  });

  // Ensure web artifact directories exist alongside the existing layout
  const webSearchDir = path.join(layout.sessionDir, "web-search");
  const webFetchDir = path.join(layout.sessionDir, "web-fetch");
  const webResearchDir = path.join(layout.sessionDir, "web-research");
  fs.mkdirSync(webSearchDir, { recursive: true });
  fs.mkdirSync(webFetchDir, { recursive: true });
  fs.mkdirSync(webResearchDir, { recursive: true });

  const timestamp = path.basename(layout.sessionDir);
  const cleanOptions = resolveWebResearchCleanOptions(options);

  let state = persistWebResearchFromResultsFile({
    cleanOptions,
    layoutSessionDir: layout.sessionDir,
    persist: options,
    timestamp,
  });
  state = {
    ...state,
    ...persistWebResearchFromInlineContent({
      cleanOptions,
      layoutSessionDir: layout.sessionDir,
      persist: options,
      timestamp,
    }),
  };

  logWebResearchSaveSessionSummary({
    cleanOptions,
    cleanReduction: state.cleanReduction,
    layout,
    originalLength: state.originalLength,
    savedPath: state.savedPath,
  });

  return layout.sessionDir;
}

/**
 * Prints CLI invocation examples and flag reference text to stdout for `--help`.
 */
function printUsage(): void {
  console.log(`
Usage:
  # Save web_search results from a file
  npx tsx skills/research-online/scripts/save-web-research.ts \\
    --query "Research topic" --source search --results /tmp/results.json

  # Save web_fetch results with a URL for filename generation
  npx tsx skills/research-online/scripts/save-web-research.ts \\
    --query "Research topic" --source fetch --results /tmp/page.md \\
    --url "https://example.com/docs"

  # Save inline content directly
  npx tsx skills/research-online/scripts/save-web-research.ts \\
    --query "Research topic" --source search \\
    --content '{"results": [...]}'

  # Save into an existing session
  npx tsx skills/research-online/scripts/save-web-research.ts \\
    --query "Research topic" --source fetch --content "Page content" \\
    --session-dir ".researches/2026-05-18T120000Z" --url "https://example.com"

Options:
  # Save web_fetch content with URL-based filename, cleaning navigation chrome
  npx tsx skills/research-online/scripts/save-web-research.ts \
    --query "Research topic" --source fetch --content "Page content" \
    --url "https://example.com/docs"

Options:
  --query, -q        Research query or question (required)
  --source, -s       Source type: "search", "fetch", or "hybrid" (required)
  --results, -r      Path to a results file on disk
  --content, -c      Inline string content (alternative to --results)
  --url, -u          URL of the fetched page (used for filename generation)
  --clean            Strip navigation chrome (default for fetch/hybrid). Use --no-clean to preserve raw content.
  --no-clean         Disable content cleaning; save raw content as-is
  --session-dir, -d  Existing research session directory to reuse
  --metadata, -m     JSON object string with extra metadata
  --help, -h         Show this help
`);
}

/**
 * Parses argv, validates inputs, and delegates to `saveWebResearch`.
 *
 * @remarks
 * I/O: Reads `--metadata` JSON when present. Throws if `--query` or `--source` are missing/empty.
 * Does not set `process.exitCode` itself; the top-level catch handles failures.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      query: { type: "string", short: "q" },
      source: { type: "string", short: "s" },
      results: { type: "string", short: "r" },
      content: { type: "string", short: "c" },
      url: { type: "string", short: "u" },
      clean: { type: "boolean" },
      "no-clean": { type: "boolean" },
      "session-dir": { type: "string", short: "d" },
      metadata: { type: "string", short: "m" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (typeof values.query !== "string" || values.query.trim().length === 0) {
    throw new Error("--query is required");
  }

  const sourceValue = typeof values.source === "string" ? values.source : undefined;
  if (sourceValue !== "search" && sourceValue !== "fetch" && sourceValue !== "hybrid") {
    throw new Error('--source is required and must be "search", "fetch", or "hybrid"');
  }

  if (typeof values.results === "string" && typeof values.content === "string") {
    throw new Error("Specify either --results or --content, not both");
  }

  if (
    typeof values.results !== "string" &&
    typeof values.content !== "string"
  ) {
    throw new Error("Either --results or --content is required");
  }

  let metadata: Metadata | undefined;
  if (typeof values.metadata === "string") {
    const parsedMetadata = JSON.parse(values.metadata);
    if (
      typeof parsedMetadata !== "object" ||
      parsedMetadata === null ||
      Array.isArray(parsedMetadata)
    ) {
      throw new Error("--metadata must be a JSON object");
    }
    metadata = parsedMetadata;
  }

  saveWebResearch({
    query: values.query.trim(),
    source: sourceValue,
    resultsPath:
      typeof values.results === "string" ? values.results : undefined,
    content:
      typeof values.content === "string" ? values.content : undefined,
    url: typeof values.url === "string" ? values.url : undefined,
    clean: values.clean === true ? true : undefined,
    noClean: values["no-clean"] === true,
    sessionDir:
      typeof values["session-dir"] === "string"
        ? values["session-dir"]
        : undefined,
    metadata,
  });
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}