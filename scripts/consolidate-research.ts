/**
 * @fileoverview CLI that consolidates research results from Firecrawl and/or
 * built-in web tool (web_search, web_fetch) artifacts into a single markdown
 * report with optional deduplication. Content cleaning is **enabled by
 * default** — navigation chrome, cookie banners, footers, and social prompts
 * are stripped from fetch content during consolidation. Use `--no-clean` to
 * disable cleaning and preserve raw content. Owned by research-online;
 * invoked by agents during research session closeout to produce the final
 * consolidated deliverable.
 *
 * Supports three input modes:
 * 1. Explicit `--input-dir` / `--input-file` (legacy, Firecrawl-only)
 * 2. `--session-dir` to auto-discover all artifact subdirectories
 *    (firecrawl/reports, web-search, web-fetch, web-research)
 * 3. `--auto-session` to locate the latest session under `.researches/`
 *
 * @example
 * # Consolidate from a specific session (auto-discovers all artifact dirs)
 * npx tsx skills/research-online/scripts/consolidate-research.ts \
 *   --session-dir .researches/2026-02-11T134626Z \
 *   --query "Example research question" \
 *   --format thematic
 *
 * # Consolidate Firecrawl reports only (legacy mode)
 * npx tsx skills/research-online/scripts/consolidate-research.ts \
 *   --input-dir .researches/2026-02-11T134626Z/firecrawl/reports \
 *   --query "Example research question" \
 *   --format thematic
 *
 * @testing Manual — npx tsx skills/research-online/scripts/consolidate-research.ts
 * @see skills/research-online/SKILL.md - Research workflow that owns this consolidation surface.
 * @see skills/research-online/scripts/save-web-research.ts - Web tool result persistence sibling script.
 * @documentation reviewed=2026-05-18 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { cleanWebContent, type CleanOptions } from "./clean-web-content";
import { getRepoRoot, publishScopedArtifacts } from "../../../scripts/shared/finalize-scoped-artifact";

/**
 * Supported markdown layouts for grouped consolidation output.
 */
type ConsolidationFormat = "thematic" | "source-based" | "timeline";

/**
 * Loose artifact row produced from JSON reports or synthesized markdown loads.
 */
type ResearchResult = Record<string, unknown>;

/**
 * Normalized CLI inputs controlling consolidation, dedupe, output paths, and publish.
 *
 * @remarks
 * `sessionDir` and `autoSession` are mutually exclusive with explicit `inputDirs`/`inputFiles`.
 * When `sessionDir` or `autoSession` is set, the script auto-discovers artifacts from
 * `firecrawl/reports`, `web-search`, `web-fetch`, and `web-research` subdirectories.
 */
type ConsolidationOptions = {
  autoSession?: boolean;
  clean?: CleanOptions | boolean;
  /**
   * When true, skip content cleaning even if --clean was not explicitly passed.
   * Used to override the default cleaning behavior.
   */
  noClean?: boolean;
  commitMessage?: string;
  dedupe: boolean;
  format: ConsolidationFormat;
  inputDirs: string[];
  inputFiles: string[];
  outputPath?: string;
  publish: boolean;
  query: string;
  sessionDir?: string;
};

/**
 * Narrows unknown parsed JSON values to non-array plain objects.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates user-supplied `--format` tokens against supported layouts.
 */
function isConsolidationFormat(value: string): value is ConsolidationFormat {
  return (
    value === "thematic" || value === "source-based" || value === "timeline"
  );
}

/**
 * Reads a string field from a loose result record with an optional fallback.
 */
function getStringValue(
  result: ResearchResult,
  key: string,
  fallback = "",
): string {
  const value = result[key];
  return typeof value === "string" ? value : fallback;
}

/**
 * Resolves a human-facing title from common metadata keys for headings.
 */
function getDisplayTitle(result: ResearchResult): string {
  const title = getStringValue(result, "title");
  if (title.length > 0) {
    return title;
  }

  const name = getStringValue(result, "name");
  if (name.length > 0) {
    return name;
  }

  return "Untitled";
}

/**
 * Resolves clean options for content cleaning during consolidation.
 *
 * @remarks
 * Content cleaning is enabled by default (fetch chrome removal). When `clean`
 * is `true`, normalizes to `{ source: "fetch" }`. When `clean` is a
 * CleanOptions object, uses it as-is. `noClean` disables cleaning and yields
 * `undefined`. Explicit clean payloads override `noClean`. Agents who want raw
 * content in the consolidated output can pass `--no-clean`.
 */
function resolveCleanOptions(
  options: ConsolidationOptions,
): CleanOptions | undefined {
  // Explicit clean options override everything
  if (options.clean === true) {
    return { source: "fetch" };
  }
  if (typeof options.clean === "object") {
    return options.clean;
  }
  // --no-clean disables default cleaning
  if (options.noClean === true) {
    return undefined;
  }
  // Default: clean fetch content (remove navigation chrome)
  return { source: "fetch" };
}

/**
 * Resolves primary body text from `content`, otherwise from `description`, for display.
 *
 * @remarks
 * When `content` is non-empty and `cleanOptions` is set, returns text passed
 * through `cleanWebContent`. A non-empty `description` is returned as stored
 * (no cleaning pass).
 */
function getDisplayContent(
  result: ResearchResult,
  cleanOptions?: CleanOptions,
): string {
  let content = getStringValue(result, "content");
  if (content.length > 0) {
    if (cleanOptions) {
      content = cleanWebContent(content, cleanOptions);
    }
    return content;
  }

  const description = getStringValue(result, "description");
  if (description.length > 0) {
    return description;
  }

  return "";
}

/**
 * Returns the attribution label used for grouping and citations.
 */
function getSource(result: ResearchResult): string {
  return getStringValue(result, "source", "Unknown");
}

/**
 * Ensures each parsed row carries a source label derived from the filename when missing.
 */
function withDefaultSource(
  result: ResearchResult,
  filePath: string,
): ResearchResult {
  if (typeof result.source === "string" && result.source.length > 0) {
    return result;
  }

  return {
    ...result,
    source: path.basename(filePath, path.extname(filePath)),
  };
}

/**
 * Loads research rows from a markdown or JSON file.
 *
 * @remarks
 * I/O: synchronous filesystem read; logs JSON parse failures without throwing.
 */
function loadResultsFromFile(filePath: string): ResearchResult[] {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".md" || extension === ".txt") {
    return [
      {
        source: path.basename(filePath, extension),
        format: "markdown",
        content: fs.readFileSync(filePath, "utf8"),
      },
    ];
  }

  if (extension === ".html") {
    return [
      {
        source: path.basename(filePath, ".html"),
        format: "html",
        content: fs.readFileSync(filePath, "utf8"),
      },
    ];
  }

  // Files without extension (e.g., URL-based fetch filenames) are treated as markdown
  if (extension === "") {
    return [
      {
        source: path.basename(filePath),
        format: "markdown",
        content: fs.readFileSync(filePath, "utf8"),
      },
    ];
  }

  if (extension !== ".json") {
    // Unknown extensions (e.g., ".com-docs" from URL-based fetch filenames)
    // are treated as markdown content rather than silently skipped.
    return [
      {
        source: path.basename(filePath, extension),
        format: "markdown",
        content: fs.readFileSync(filePath, "utf8"),
      },
    ];
  }

  try {
    const rawContent = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(rawContent);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is ResearchResult => isRecord(entry))
        .map((entry) => withDefaultSource(entry, filePath));
    }

    if (isRecord(parsed)) {
      return [withDefaultSource(parsed, filePath)];
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    console.error(`Warning: failed to parse ${filePath}: ${message}`);
  }

  return [];
}

/** Subdirectory names within a research session that contain consolidatable artifacts. */
const SESSION_ARTIFACT_SUBDIRS = [
  "firecrawl/reports",
  "web-search",
  "web-fetch",
  "web-research",
] as const;

/** File extensions (with leading dot) considered consolidatable artifacts. */
const ARTIFACT_EXTENSIONS = new Set([".json", ".md", ".txt", ".html"]);

/**
 * Resolves session artifact directories from a session directory path.
 *
 * @remarks
 * Returns only directories that exist on disk, so a Firecrawl-only session
 * won't include empty web-tool directories and vice versa.
 */
function resolveSessionArtifactDirs(sessionDir: string): string[] {
  const existingDirs: string[] = [];

  for (const subdir of SESSION_ARTIFACT_SUBDIRS) {
    const candidate = path.join(sessionDir, subdir);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      existingDirs.push(candidate);
    }
  }

  return existingDirs;
}

/**
 * Finds the most recent timestamped session directory under `.researches/`.
 *
 * @remarks
 * Sorts directory names lexicographically (which matches ISO timestamp order).
 * Returns `null` when no matching directory is found.
 */
function findLatestSession(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);

  // Walk up to find .researches/
  while (true) {
    const candidate = path.join(current, ".researches");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }

  // Re-walk to find .researches
  let searchFrom = path.resolve(startDir);
  let researchesPath: string | null = null;
  while (true) {
    const candidate = path.join(searchFrom, ".researches");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      researchesPath = candidate;
      break;
    }
    const parent = path.dirname(searchFrom);
    if (parent === searchFrom) {
      break;
    }
    searchFrom = parent;
  }

  if (researchesPath === null) {
    return null;
  }

  const entries = fs.readdirSync(researchesPath, { withFileTypes: true });
  const sessionDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T\d{6}Z$/.test(entry.name))
    .map((entry) => path.join(researchesPath, entry.name))
    .sort()
    .reverse();

  return sessionDirs.length > 0 ? sessionDirs[0] : null;
}

/**
 * Collects artifact file paths from directories plus explicit files.
 *
 * @param permissive - When true, accepts all regular files regardless of extension.
 *   Used for session-discovered web-tool directories where URL-based filenames
 *   may have arbitrary extensions like ".com-docs" from "www.better-auth.com/docs".
 *   When false (the default), only accepts files with recognized artifact extensions.
 *
 * @remarks
 * I/O: synchronous directory scans; warns when paths are missing.
 */
function collectInputFiles(
  inputDirs: string[],
  inputFiles: string[],
  permissive = false,
): string[] {
  const discoveredFiles: string[] = [];

  inputDirs.forEach((inputDir) => {
    const resolvedDir = path.resolve(inputDir);
    if (
      !fs.existsSync(resolvedDir) ||
      !fs.statSync(resolvedDir).isDirectory()
    ) {
      console.error(`Warning: input directory not found: ${inputDir}`);
      return;
    }

    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isFile()) {
        return;
      }

      // In permissive mode, accept all files; otherwise, only recognized extensions + extensionless
      const extension = path.extname(entry.name).toLowerCase();
      if (permissive || ARTIFACT_EXTENSIONS.has(extension) || extension === "") {
        discoveredFiles.push(path.join(resolvedDir, entry.name));
      }
    });
  });

  inputFiles.forEach((inputFile) => {
    const resolvedFile = path.resolve(inputFile);
    if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
      console.error(`Warning: input file not found: ${inputFile}`);
      return;
    }

    discoveredFiles.push(resolvedFile);
  });

  return Array.from(new Set(discoveredFiles)).sort((left, right) =>
    left.localeCompare(right),
  );
}

/**
 * Keeps the first row per stable key; rows with empty keys are always retained.
 */
function dedupeByKey(
  results: ResearchResult[],
  keySelector: (result: ResearchResult) => string | null,
): ResearchResult[] {
  const seen = new Set<string>();
  const unique: ResearchResult[] = [];

  results.forEach((result) => {
    const key = keySelector(result);
    if (key === null || key.length === 0) {
      unique.push(result);
      return;
    }

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(result);
  });

  return unique;
}

/**
 * Token-overlap score between two strings for fuzzy title deduplication.
 */
function simpleSimilarity(left: string, right: string): number {
  const leftTokens = new Set(
    left
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );
  const rightTokens = new Set(
    right
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Drops later rows when title similarity to an earlier titled row exceeds the threshold.
 */
function dedupeFuzzyByTitle(
  results: ResearchResult[],
  threshold: number,
): ResearchResult[] {
  const unique: ResearchResult[] = [];

  results.forEach((result) => {
    const title = getStringValue(result, "title");
    if (title.length === 0) {
      unique.push(result);
      return;
    }

    const duplicate = unique.some((existing) => {
      const existingTitle = getStringValue(existing, "title");
      if (existingTitle.length === 0) {
        return false;
      }

      return simpleSimilarity(title, existingTitle) > threshold;
    });

    if (!duplicate) {
      unique.push(result);
    }
  });

  return unique;
}

/**
 * Normalizes heterogeneous finding payloads to trimmed plain text or null.
 */
function findingToText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value.trim() : null;
  }

  if (isRecord(value)) {
    const text = value.text;
    if (typeof text === "string" && text.trim().length > 0) {
      return text.trim();
    }

    const description = value.description;
    if (typeof description === "string" && description.trim().length > 0) {
      return description.trim();
    }
  }

  return null;
}

/**
 * Flattens `key_findings` and `findings` arrays across all loaded results.
 */
function collectKeyFindings(results: ResearchResult[]): string[] {
  const findings: string[] = [];

  results.forEach((result) => {
    const keyFindings = result.key_findings;
    if (Array.isArray(keyFindings)) {
      keyFindings.forEach((entry) => {
        const text = findingToText(entry);
        if (text !== null) {
          findings.push(text);
        }
      });
    }

    const genericFindings = result.findings;
    if (Array.isArray(genericFindings)) {
      genericFindings.forEach((entry) => {
        const text = findingToText(entry);
        if (text !== null) {
          findings.push(text);
        }
      });
    }
  });

  return findings;
}

/**
 * Shortens preview text with an ellipsis suffix when over the limit.
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

/**
 * Walks parents from a file or directory path to find a `.researches/<timestamp>/` session folder.
 *
 * @remarks
 * I/O: synchronous stat calls while ascending the directory chain.
 */
function findResearchSessionDirFromPath(candidatePath: string): string | null {
  let currentPath = path.resolve(candidatePath);

  if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
    currentPath = path.dirname(currentPath);
  }

  while (true) {
    const currentBaseName = path.basename(currentPath);
    const parentPath = path.dirname(currentPath);

    if (
      /^\d{4}-\d{2}-\d{2}T\d{6}Z$/.test(currentBaseName) &&
      path.basename(parentPath) === ".researches"
    ) {
      return currentPath;
    }

    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

/**
 * Builds the consolidated markdown document for the chosen grouping strategy.
 */
function generateMarkdownConsolidation(
  results: ResearchResult[],
  query: string,
  format: ConsolidationFormat,
  cleanOptions?: CleanOptions,
  cleaningStats?: { originalChars: number; cleanedChars: number },
): string {
  const lines: string[] = [
    `# Research Consolidation: ${query}`,
    "",
    `**Sources:** ${results.length}`,
    `**Format:** ${format}`,
    "",
    "---",
    "",
  ];

  if (format === "thematic") {
    const byCategory = new Map<string, ResearchResult[]>();

    results.forEach((result) => {
      const category = getStringValue(result, "category", "General");
      const existing = byCategory.get(category);
      if (existing === undefined) {
        byCategory.set(category, [result]);
        return;
      }

      existing.push(result);
    });

    Array.from(byCategory.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([category, categoryItems]) => {
        lines.push(`## ${category}`);
        lines.push("");

        const bySource = new Map<string, ResearchResult[]>();
        categoryItems.forEach((item) => {
          const source = getSource(item);
          const existing = bySource.get(source);
          if (existing === undefined) {
            bySource.set(source, [item]);
            return;
          }

          existing.push(item);
        });

        Array.from(bySource.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .forEach(([source, sourceItems]) => {
            lines.push(`### ${source}`);
            lines.push("");

            sourceItems.forEach((item) => {
              lines.push(
                `- **${getDisplayTitle(item)}**: ${truncate(getDisplayContent(item, cleanOptions), 200)}`,
              );
            });

            lines.push("");
          });
      });
  }

  if (format === "source-based") {
    const bySource = new Map<string, ResearchResult[]>();

    results.forEach((result) => {
      const source = getSource(result);
      const existing = bySource.get(source);
      if (existing === undefined) {
        bySource.set(source, [result]);
        return;
      }

      existing.push(result);
    });

    Array.from(bySource.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([source, sourceItems]) => {
        lines.push(`## ${source}`);
        lines.push("");

        sourceItems.forEach((item) => {
          lines.push(
            `- **${getDisplayTitle(item)}**: ${getDisplayContent(item, cleanOptions)}`,
          );
        });

        lines.push("");
      });
  }

  if (format === "timeline") {
    const sorted = [...results].sort((left, right) => {
      const leftDate = getStringValue(left, "date");
      const rightDate = getStringValue(right, "date");
      return leftDate.localeCompare(rightDate);
    });

    lines.push("## Timeline");
    lines.push("");

    sorted.forEach((result) => {
      const date = getStringValue(result, "date", "Unknown date");
      const source = getSource(result);
      const title = getDisplayTitle(result);
      const content = truncate(getDisplayContent(result, cleanOptions), 200);

      lines.push(`- **${date}** (${source}): ${title}`);
      if (content.length > 0) {
        lines.push(`  ${content}`);
      }
    });

    lines.push("");
  }

  const sources = Array.from(
    new Set(results.map((result) => getSource(result))),
  );
  lines.push("---");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total items: ${results.length}`);
  lines.push(`- Sources: ${sources.length}`);
  if (cleaningStats && cleaningStats.originalChars > 0) {
    const reductionPercent = (
      ((cleaningStats.originalChars - cleaningStats.cleanedChars) / cleaningStats.originalChars) * 100
    ).toFixed(1);
    const reductionChars = cleaningStats.originalChars - cleaningStats.cleanedChars;
    lines.push(`- Content cleaning: ${reductionChars} chars removed (${reductionPercent}% reduction)`);
  }
  lines.push("");
  lines.push("### Key Findings");
  lines.push("");

  const findings = collectKeyFindings(results);
  if (findings.length === 0) {
    lines.push("No explicit key findings recorded.");
  } else {
    findings.slice(0, 10).forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding}`);
    });
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Chooses `consolidated.md` beside a detected session directory or falls back to the cwd.
 */
/**
 * Chooses `consolidated.md` beside a detected session directory or falls back to the cwd.
 *
 * @remarks
 * Prefers an explicit session directory when provided via `--session-dir` or `--auto-session`,
 * then falls back to path heuristics from input directories and files.
 */
function resolveDefaultOutputPath(inputPaths: string[], sessionDir?: string): string {
  if (typeof sessionDir === "string" && sessionDir.trim().length > 0) {
    return path.join(sessionDir, "consolidated.md");
  }

  for (const inputPath of inputPaths) {
    const foundSessionDir = findResearchSessionDirFromPath(inputPath);
    if (foundSessionDir !== null) {
      return path.join(foundSessionDir, "consolidated.md");
    }
  }

  return path.resolve("consolidated.md");
}

/**
 * Maps a consolidation output path back to its enclosing session directory when possible.
 */
function resolveSessionDirFromOutputPath(outputPath: string): string | null {
  return findResearchSessionDirFromPath(outputPath);
}

/**
 * Loads inputs, optionally dedupes, writes markdown and JSON, and may publish the session.
 *
 * @remarks
 * I/O: synchronous writes to markdown and sibling JSON paths; may invoke git publish helpers.
 */
function consolidateResearch(options: ConsolidationOptions): string {
  // Resolve session-auto directories when requested
  let effectiveInputDirs = [...options.inputDirs];
  let resolvedSessionDir: string | undefined;

  if (typeof options.sessionDir === "string" && options.sessionDir.trim().length > 0) {
    const sessionPath = path.resolve(options.sessionDir.trim());
    if (!fs.existsSync(sessionPath) || !fs.statSync(sessionPath).isDirectory()) {
      throw new Error(`Session directory not found: ${options.sessionDir}`);
    }

    const artifactDirs = resolveSessionArtifactDirs(sessionPath);
    console.log(`Auto-discovered ${artifactDirs.length} artifact directory(ies) in session: ${sessionPath}`);
    artifactDirs.forEach((dir) => console.log(`  - ${dir}`));
    effectiveInputDirs.push(...artifactDirs);
    resolvedSessionDir = sessionPath;
  } else if (options.autoSession) {
    const latestSession = findLatestSession();
    if (latestSession === null) {
      throw new Error("No research session found under .researches/. Create one with init-research-session first.");
    }

    const artifactDirs = resolveSessionArtifactDirs(latestSession);
    console.log(`Auto-detected latest session: ${latestSession}`);
    console.log(`Auto-discovered ${artifactDirs.length} artifact directory(ies)`);
    artifactDirs.forEach((dir) => console.log(`  - ${dir}`));
    effectiveInputDirs.push(...artifactDirs);
    resolvedSessionDir = latestSession;
  }

  // Use permissive file scanning when session auto-discovery is active,
  // because web-tool filenames (e.g. "www.better-auth.com-docs") may have
  // arbitrary extensions not in the artifact whitelist.
  const usePermissiveScan =
    typeof options.sessionDir === "string" || options.autoSession;

  const discoveredInputFiles = collectInputFiles(
    effectiveInputDirs,
    options.inputFiles,
    usePermissiveScan,
  );
  if (discoveredInputFiles.length === 0) {
    throw new Error(
      "No input result files found. Use --input-dir, --session-dir, or --auto-session to specify sources.",
    );
  }

  console.log(`Loading ${discoveredInputFiles.length} result file(s)...`);

  let results = discoveredInputFiles.flatMap((filePath) =>
    loadResultsFromFile(filePath),
  );
  console.log(`Loaded ${results.length} result item(s)`);

  if (options.dedupe) {
    if (results.some((result) => typeof result.url === "string")) {
      results = dedupeByKey(results, (result) => {
        const url = result.url;
        return typeof url === "string" ? url : null;
      });
      console.log(`After URL deduplication: ${results.length} item(s)`);
    }

    if (results.some((result) => typeof result.title === "string")) {
      results = dedupeFuzzyByTitle(results, 0.85);
      console.log(`After title fuzzy deduplication: ${results.length} item(s)`);
    }
  }

  const cleanOptions = resolveCleanOptions(options);

  // Compute cleaning statistics for the summary section
  let cleaningStats: { originalChars: number; cleanedChars: number } | undefined;
  if (cleanOptions) {
    let totalOriginal = 0;
    let totalCleaned = 0;
    results.forEach((result) => {
      const raw = getStringValue(result, "content") || getStringValue(result, "description") || "";
      if (raw.length > 0) {
        totalOriginal += raw.length;
        totalCleaned += cleanWebContent(raw, cleanOptions).length;
      }
    });
    cleaningStats = { originalChars: totalOriginal, cleanedChars: totalCleaned };
  }

  const markdown = generateMarkdownConsolidation(
    results,
    options.query,
    options.format,
    cleanOptions,
    cleaningStats,
  );

  if (cleanOptions) {
    console.log(`Content cleaning enabled (default): removing navigation chrome, cookie banners, footers`);
  } else {
    console.log(`Content cleaning disabled (--no-clean): raw content preserved`);
  }

  const resolvedOutputPath =
    typeof options.outputPath === "string"
      ? path.resolve(options.outputPath)
      : resolveDefaultOutputPath([...effectiveInputDirs, ...options.inputFiles], resolvedSessionDir);

  fs.writeFileSync(resolvedOutputPath, `${markdown}\n`, "utf8");
  console.log(`\nConsolidated markdown saved to: ${resolvedOutputPath}`);

  const jsonOutputPath = resolvedOutputPath.replace(/\.md$/, ".json");
  const jsonPayload: Record<string, unknown> = {
    format: options.format,
    query: options.query,
    results,
    sources: Array.from(new Set(results.map((result) => getSource(result)))),
    totalResults: results.length,
    cleaningStats: cleaningStats
      ? {
          originalChars: cleaningStats.originalChars,
          cleanedChars: cleaningStats.cleanedChars,
          removedChars: cleaningStats.originalChars - cleaningStats.cleanedChars,
          reductionPercent: Number(
            ((cleaningStats.originalChars - cleaningStats.cleanedChars) / cleaningStats.originalChars * 100).toFixed(1),
          ),
        }
      : undefined,
  };
  fs.writeFileSync(
    jsonOutputPath,
    `${JSON.stringify(jsonPayload, null, 2)}\n`,
    "utf8",
  );
  console.log(`Consolidated JSON saved to: ${jsonOutputPath}`);

  if (options.publish) {
    const sessionDir = resolveSessionDirFromOutputPath(resolvedOutputPath);
    if (sessionDir !== null) {
      const repoRoot = getRepoRoot(process.cwd());
      const commitMessage =
        typeof options.commitMessage === "string" && options.commitMessage.trim().length > 0
          ? options.commitMessage.trim()
          : `docs(research): publish ${path.basename(sessionDir)}`;

      const publishResult = publishScopedArtifacts({
        repoRoot,
        scopePaths: [sessionDir],
        commitMessage,
      });

      console.log(
        `Published research session: branch=${publishResult.branchName} commit="${publishResult.commitMessage}"`,
      );
    } else {
      console.log("Skipped auto-publish because the consolidation output is not inside a .researches session folder.");
    }
  }

  return resolvedOutputPath;
}

/**
 * Prints CLI usage and option reference to stdout.
 */
function printUsage(): void {
  console.log(`
Usage:
  # Consolidate from a specific session (auto-discovers all artifact dirs)
  npx tsx skills/research-online/scripts/consolidate-research.ts \\
    --session-dir .researches/2026-02-11T134626Z \\
    --query "Research question" \\
    --format thematic

  # Consolidate the latest session automatically
  npx tsx skills/research-online/scripts/consolidate-research.ts \\
    --auto-session \\
    --query "Research question" \\
    --format thematic

  # Consolidate from specific directories (legacy)
  npx tsx skills/research-online/scripts/consolidate-research.ts \\
    --input-dir .researches/2026-02-11T134626Z/firecrawl/reports \\
    --query "Research question" \\
    --format thematic

  # Consolidate from explicit files
  npx tsx skills/research-online/scripts/consolidate-research.ts \\
    --input-file /tmp/report-1.json \\
    --input-file /tmp/report-2.json \\
    --query "Research question" \\
    --format source-based

  # Consolidate from a specific session with content cleaning
  npx tsx skills/research-online/scripts/consolidate-research.ts \
    --session-dir .researches/2026-02-11T134626Z \
    --query "Research question" \
    --format thematic \
    --clean

Options:
  --session-dir, -s  Research session directory to auto-discover artifacts from.
  --auto-session     Use the latest session under .researches/ automatically.
  --input-dir, -d    Directory containing result files (.json/.md). Repeatable.
  --input-file, -f   Individual result file path. Repeatable.
  --query, -q        Original research query.
  --format           thematic | source-based | timeline (default: thematic).
  --clean            Strip navigation chrome, cookie banners, footers, and social prompts from content during consolidation (default: enabled).
  --no-clean         Disable content cleaning during consolidation. Use this when raw content is needed.
  --no-dedupe        Disable URL/title deduplication.
  --no-publish       Skip the default scoped commit/push for the session folder.
  --output, -o       Explicit output markdown path.
  --commit-message   Override the default auto-publish commit message.
  --help, -h         Show this help.
`);
}

/**
 * Coerces `node:util` multi-string options into a uniform string array.
 */
function normalizeStringArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

/**
 * Parses CLI arguments and runs consolidation with validated options.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      "session-dir": { type: "string", short: "s" },
      "auto-session": { type: "boolean" },
      "input-dir": { type: "string", short: "d", multiple: true },
      "input-file": { type: "string", short: "f", multiple: true },
      query: { type: "string", short: "q" },
      format: { type: "string" },
      "no-dedupe": { type: "boolean" },
      "no-publish": { type: "boolean" },
      clean: { type: "boolean" },
      "no-clean": { type: "boolean" },
      output: { type: "string", short: "o" },
      "commit-message": { type: "string" },
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

  const formatValue =
    typeof values.format === "string" ? values.format : "thematic";
  if (!isConsolidationFormat(formatValue)) {
    throw new Error(
      "--format must be one of: thematic, source-based, timeline",
    );
  }

  consolidateResearch({
    autoSession: values["auto-session"] === true,
    clean: values.clean === true ? true : undefined,
    noClean: values["no-clean"] === true,
    commitMessage:
      typeof values["commit-message"] === "string" ? values["commit-message"] : undefined,
    dedupe: !values["no-dedupe"],
    format: formatValue,
    inputDirs: normalizeStringArray(values["input-dir"]),
    inputFiles: normalizeStringArray(values["input-file"]),
    outputPath: typeof values.output === "string" ? values.output : undefined,
    publish: !values["no-publish"],
    query: values.query,
    sessionDir: typeof values["session-dir"] === "string" ? values["session-dir"] : undefined,
  });
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
