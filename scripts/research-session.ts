/**
 * @fileoverview Library that defines research session directory contracts, layout builders, and
 * file-system helpers. Owned by the `research-online/SKILL.md` skill; consumed by the
 * init-research-session CLI and Firecrawl orchestration workflows.
 *
 * @example
 * ```ts
 * import { ensureResearchSession } from "./research-session";
 *
 * const layout = ensureResearchSession({ query: "OpenRouter model pricing" });
 * console.log(layout.sessionDir);
 * console.log(layout.firecrawlDir);
 * ```
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/research-session.ts
 * @see skills/research-online/SKILL.md - Skill workflow documentation for research session contracts.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";

/** Arbitrary key-value metadata stored alongside a research session. */
export type Metadata = Record<string, unknown>;

/** Directory layout produced by `buildResearchSessionLayout`; all paths are absolute.
 *
 * Includes directories for both Firecrawl artifacts and built-in web tool results,
 * supporting the hybrid two-phase research pattern where Phase 1 uses web_search/web_fetch
 * and Phase 2 uses Firecrawl.
 */
export type ResearchSessionLayout = {
  documentationDir: string;
  documentationFullPageScreenshotsDir: string;
  documentationHtmlDir: string;
  documentationMarkdownDir: string;
  documentationScreenshotsDir: string;
  firecrawlDir: string;
  firecrawlRawDir: string;
  firecrawlReportsDir: string;
  metadataPath: string;
  sessionDir: string;
  subagentReportsDir: string;
  /** Directory for web_search result artifacts (JSON). Created alongside firecrawl/ for hybrid sessions. */
  webSearchDir: string;
  /** Directory for web_fetch result artifacts (markdown, HTML). Created alongside firecrawl/ for hybrid sessions. */
  webFetchDir: string;
  /** Directory for hybrid web research artifacts that combine search and fetch. */
  webResearchDir: string;
};

/** Type guard that returns `true` when `value` is a plain object (not `null`, not an `Array`). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Formats a Date as an ISO-8601 UTC timestamp string in `YYYY-MM-DDTHHmmssZ` format. */
export function createResearchTimestamp(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}${minute}${second}Z`;
}

/**
 * Locates `.researches` by walking up from `startDir`, or creates it at the repo root if absent.
 * Also creates a `.gitkeep` file to keep the directory tracked.
 */
export function ensureResearchesDir(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, ".researches");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  const researchesDir = path.join(path.resolve(startDir), ".researches");
  fs.mkdirSync(researchesDir, { recursive: true });

  const gitkeepPath = path.join(researchesDir, ".gitkeep");
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(
      gitkeepPath,
      "# Keep .researches tracked while publishing completed generated session folders\n",
      "utf8",
    );
  }

  return researchesDir;
}

/** Builds the complete directory layout for a research session, including Firecrawl, web tool, and documentation subdirectories. */
export function buildResearchSessionLayout(sessionDir: string): ResearchSessionLayout {
  const firecrawlDir = path.join(sessionDir, "firecrawl");
  const documentationDir = path.join(sessionDir, "documentation");
  return {
    sessionDir,
    firecrawlDir,
    documentationDir,
    documentationFullPageScreenshotsDir: path.join(
      documentationDir,
      "screenshots",
      "full-page",
    ),
    documentationHtmlDir: path.join(documentationDir, "html"),
    documentationMarkdownDir: path.join(documentationDir, "markdown"),
    documentationScreenshotsDir: path.join(documentationDir, "screenshots"),
    firecrawlRawDir: path.join(firecrawlDir, "raw"),
    firecrawlReportsDir: path.join(firecrawlDir, "reports"),
    subagentReportsDir: path.join(sessionDir, "subagent-reports"),
    webSearchDir: path.join(sessionDir, "web-search"),
    webFetchDir: path.join(sessionDir, "web-fetch"),
    webResearchDir: path.join(sessionDir, "web-research"),
    metadataPath: path.join(sessionDir, "metadata.json"),
  };
}

/**
 * Loads existing session metadata from disk when `metadata.json` is present.
 *
 * @remarks
 * Synchronous read. Returns `{}` when the path is missing, not a regular file, JSON parsing fails,
 * or the decoded value is not a plain object record.
 *
 * @agent.internal
 */
function readMetadataIfPresent(metadataPath: string): Metadata {
  if (!fs.existsSync(metadataPath) || !fs.statSync(metadataPath).isFile()) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Creates a research session directory, all required subdirectories, and a `metadata.json`.
 * If `sessionDir` is not provided, generates a timestamped session folder under `.researches`.
 */
export function ensureResearchSession(options: {
  metadata?: Metadata;
  query: string;
  sessionDir?: string;
  startDir?: string;
}): ResearchSessionLayout {
  const startDir = options.startDir ?? process.cwd();
  let sessionDir: string;

  if (typeof options.sessionDir === "string" && options.sessionDir.trim().length > 0) {
    const trimmedSessionDir = options.sessionDir.trim();
    if (path.isAbsolute(trimmedSessionDir)) {
      sessionDir = trimmedSessionDir;
    } else if (
      trimmedSessionDir === ".researches" ||
      trimmedSessionDir.startsWith(".researches/")
    ) {
      const researchesDir = ensureResearchesDir(startDir);
      sessionDir = path.resolve(path.dirname(researchesDir), trimmedSessionDir);
    } else {
      sessionDir = path.resolve(startDir, trimmedSessionDir);
    }
  } else {
    const researchesDir = ensureResearchesDir(startDir);
    const timestamp = createResearchTimestamp();
    sessionDir = path.join(researchesDir, timestamp);

    if (fs.existsSync(sessionDir)) {
      throw new Error(`Research session already exists: ${sessionDir}`);
    }
  }

  const layout = buildResearchSessionLayout(sessionDir);
  fs.mkdirSync(layout.documentationDir, { recursive: true });
  fs.mkdirSync(layout.documentationHtmlDir, { recursive: true });
  fs.mkdirSync(layout.documentationMarkdownDir, { recursive: true });
  fs.mkdirSync(layout.documentationScreenshotsDir, { recursive: true });
  fs.mkdirSync(layout.documentationFullPageScreenshotsDir, { recursive: true });
  fs.mkdirSync(layout.firecrawlRawDir, { recursive: true });
  fs.mkdirSync(layout.firecrawlReportsDir, { recursive: true });
  fs.mkdirSync(layout.subagentReportsDir, { recursive: true });
  fs.mkdirSync(layout.webSearchDir, { recursive: true });
  fs.mkdirSync(layout.webFetchDir, { recursive: true });
  fs.mkdirSync(layout.webResearchDir, { recursive: true });

  const existingMetadata = readMetadataIfPresent(layout.metadataPath);
  const timestamp = path.basename(layout.sessionDir);
  const nowIso = new Date().toISOString();
  const createdAt =
    typeof existingMetadata.createdAt === "string" && existingMetadata.createdAt.length > 0
      ? existingMetadata.createdAt
      : nowIso;

  const nextMetadata: Metadata = {
    ...existingMetadata,
    ...(options.metadata ?? {}),
    query: options.query,
    timestamp,
    timestampIso:
      typeof existingMetadata.timestampIso === "string" && existingMetadata.timestampIso.length > 0
        ? existingMetadata.timestampIso
        : nowIso,
    createdAt,
  };

  fs.writeFileSync(layout.metadataPath, `${JSON.stringify(nextMetadata, null, 2)}\n`, "utf8");

  return layout;
}

/** Copies a file to `destinationDir` if it exists; returns the destination path or `null` if the source was absent. */
export function copyFileToDirIfExists(filePath: string, destinationDir: string): string | null {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return null;
  }

  const destinationPath = path.join(destinationDir, path.basename(resolvedPath));
  fs.copyFileSync(resolvedPath, destinationPath);
  return destinationPath;
}
