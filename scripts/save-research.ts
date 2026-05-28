/**
 * @fileoverview CLI script that persists Firecrawl research artifacts into a
 * timestamped session folder under `.researches/`. Owned by the
 * `research-online/SKILL.md` research workflow; agents invoke this after
 * Firecrawl sessions to capture raw results, metadata, and documentation artifacts.
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/save-research.ts
 * @see skills/research-online/SKILL.md - Skill workflow documentation for persisting Firecrawl research artifacts.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  copyFileToDirIfExists,
  ensureResearchSession,
  ensureResearchesDir,
  isRecord,
  type Metadata,
} from "./research-session";

/**
 * Inputs for persisting Firecrawl output into an ensured `.researches/` session layout.
 *
 * @remarks
 * Callers choose at most one of `resultsPath` or `resultsDir` when supplying raw artifacts; `sessionDir` reuses an existing session root when provided.
 */
type SaveResearchOptions = {
  metadata?: Metadata;
  query: string;
  resultsDir?: string;
  resultsPath?: string;
  sessionDir?: string;
};

/**
 * One row of the `--list` table after reading a session folder's `metadata.json`.
 *
 * @remarks
 * `query` and `timestampIso` fall back to display placeholders when metadata fields are missing or malformed.
 */
type SessionSummary = {
  folder: string;
  query: string;
  timestampIso: string;
};

/**
 * Recursively copies regular files from a source directory tree into a destination tree.
 *
 * @remarks
 * I/O: Synchronous walk and `copyFileSync`; creates destination directories as needed. Logs each copied file path. Ignores non-directory roots and non-file dirent kinds.
 */
function copyDirectoryRecursively(sourceDir: string, destinationDir: string): void {
  const stat = fs.statSync(sourceDir);
  if (!stat.isDirectory()) {
    return;
  }

  fs.mkdirSync(destinationDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  entries.forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursively(sourcePath, destinationPath);
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    console.log(`Saved results file: ${destinationPath}`);
  });
}

/**
 * Ensures a research session folder, ingests optional single-file or directory results, and prints layout paths.
 *
 * @remarks
 * I/O: Delegates session creation to `ensureResearchSession`, copies into `firecrawlRawDir` when paths exist, and writes nothing when optional inputs are absent. Returns the session directory path used for this run.
 */
function saveResearchSession(options: SaveResearchOptions): string {
  const layout = ensureResearchSession({
    query: options.query,
    metadata: options.metadata,
    sessionDir: options.sessionDir,
  });

  if (typeof options.resultsPath === "string") {
    const copiedPath = copyFileToDirIfExists(options.resultsPath, layout.firecrawlRawDir);
    if (copiedPath !== null) {
      console.log(`Saved results file: ${copiedPath}`);
    }
  }

  if (typeof options.resultsDir === "string") {
    const resolvedDir = path.resolve(options.resultsDir);
    if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
      copyDirectoryRecursively(resolvedDir, layout.firecrawlRawDir);
    }
  }

  console.log(`\nResearch session saved to: ${layout.sessionDir}`);
  console.log(`Documentation artifacts: ${layout.documentationDir}`);
  console.log(
    `  - Markdown: ${layout.documentationMarkdownDir}`,
  );
  console.log(`  - HTML: ${layout.documentationHtmlDir}`);
  console.log(
    `  - Screenshots: ${layout.documentationScreenshotsDir}`,
  );
  console.log(
    `  - Full-page screenshots: ${layout.documentationFullPageScreenshotsDir}`,
  );
  console.log(`Firecrawl raw results: ${layout.firecrawlRawDir}`);
  console.log(`Firecrawl reports: ${layout.firecrawlReportsDir}`);
  console.log(`Metadata: ${layout.metadataPath}`);

  return layout.sessionDir;
}

/**
 * Prints a reverse-chronological inventory of saved sessions discovered under `.researches/`.
 *
 * @remarks
 * I/O: Read-only scan of `ensureResearchesDir()`; skips entries without a readable `metadata.json` object. Malformed JSON or shape errors are ignored per folder.
 */
function listSessions(): void {
  const researchesDir = ensureResearchesDir();

  const entries = fs.readdirSync(researchesDir, { withFileTypes: true });
  const sessions: SessionSummary[] = [];

  entries.forEach((entry) => {
    if (!entry.isDirectory() || entry.name === ".git") {
      return;
    }

    const metadataPath = path.join(researchesDir, entry.name, "metadata.json");
    if (!fs.existsSync(metadataPath) || !fs.statSync(metadataPath).isFile()) {
      return;
    }

    try {
      const rawMetadata = fs.readFileSync(metadataPath, "utf8");
      const parsed = JSON.parse(rawMetadata);
      if (!isRecord(parsed)) {
        return;
      }

      const query = typeof parsed.query === "string" ? parsed.query : "N/A";
      const timestampIso =
        typeof parsed.timestampIso === "string" ? parsed.timestampIso : "N/A";

      sessions.push({
        folder: entry.name,
        query,
        timestampIso,
      });
    } catch {
      return;
    }
  });

  sessions.sort((left, right) =>
    right.timestampIso.localeCompare(left.timestampIso),
  );

  console.log(
    `\nFound ${sessions.length} research session(s) in ${researchesDir}\n`,
  );
  sessions.forEach((session) => {
    const queryPreview =
      session.query.length > 80
        ? `${session.query.slice(0, 80)}...`
        : session.query;
    console.log(`  ${session.folder}`);
    console.log(`    Query: ${queryPreview}`);
    console.log(`    Time:  ${session.timestampIso}`);
    console.log("");
  });
}

/**
 * Writes CLI invocation examples and flag reference text to stdout for `--help`.
 */
function printUsage(): void {
  console.log(`
Usage:
  npx tsx skills/research-online/scripts/save-research.ts --query "Research topic" --results /tmp/results.json
  npx tsx skills/research-online/scripts/save-research.ts --query "Research topic" --results-dir /tmp/raw-results
  npx tsx skills/research-online/scripts/save-research.ts --query "Research topic" --session-dir ".researches/2026-02-11T134626Z" --results /tmp/results.json
  npx tsx skills/research-online/scripts/save-research.ts --list

Options:
  --query, -q        Research query or question
  --results, -r      Path to a single results file
  --results-dir, -d  Directory containing multiple result files
  --session-dir, -s  Existing research session directory to reuse
  --metadata, -m     JSON object string with extra metadata
  --list, -l         List saved research sessions
  --help, -h         Show this help
`);
}

/**
 * Parses argv via `parseArgs`, then branches to help, session listing, or save flows.
 *
 * @remarks
 * I/O: Reads `--metadata` JSON when present. Throws if save mode is requested without a non-empty `--query`. Does not set `process.exitCode` itself; the top-level catch handles failures.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      query: { type: "string", short: "q" },
      results: { type: "string", short: "r" },
      "results-dir": { type: "string", short: "d" },
      "session-dir": { type: "string", short: "s" },
      metadata: { type: "string", short: "m" },
      list: { type: "boolean", short: "l" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (values.list) {
    listSessions();
    return;
  }

  if (typeof values.query !== "string" || values.query.trim().length === 0) {
    throw new Error("--query is required unless --list is specified");
  }

  let metadata: Metadata | undefined;
  if (typeof values.metadata === "string") {
    const parsedMetadata = JSON.parse(values.metadata);
    if (!isRecord(parsedMetadata)) {
      throw new Error("--metadata must be a JSON object");
    }
    metadata = parsedMetadata;
  }

  saveResearchSession({
    query: values.query,
    resultsPath:
      typeof values.results === "string" ? values.results : undefined,
    resultsDir:
      typeof values["results-dir"] === "string"
        ? values["results-dir"]
        : undefined,
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
