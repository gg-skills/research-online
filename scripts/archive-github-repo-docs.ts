#!/usr/bin/env -S npx tsx

/**
 * @fileoverview CLI helper for the research-online skill that archives GitHub repository
 * documentation into an active research session. Copies canonical markdown from a local clone when
 * available, otherwise falls back to raw GitHub URLs, snapshots rendered blob page HTML, and
 * captures screenshot evidence via Firecrawl.
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/archive-github-repo-docs.ts --session-dir ".researches/<timestamp>" --github-repo "owner/repo" --branch "main" --repo-dir "/path/to/local/clone" --file "README.md"
 * @see skills/research-online/SKILL.md - Skill workflow that orchestrates this archiver.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { buildResearchSessionLayout } from "./research-session";

/**
 * CLI screenshot policy for which paths trigger Firecrawl captures.
 *
 * @remarks
 * Parsed from `--screenshot-mode` and threaded through archival helpers.
 */
type ArchiveGithubRepoDocs_ScreenshotMode = "always" | "docs-only" | "never";

/**
 * Parsed CLI flags governing where to write artifacts and how to source markdown and screenshots.
 *
 * @remarks
 * Constructed only by `parseCliOptions` after argv validation and path normalization.
 */
type ArchiveOptions = {
  branch: string;
  filePaths: string[];
  githubRepo: string;
  repoDir?: string;
  sessionDir: string;
  screenshotMode: ArchiveGithubRepoDocs_ScreenshotMode;
};

/**
 * Per-requested-file archival outcome: artifact locations, step status, and collected error strings.
 *
 * @remarks
 * Drives JSON/Markdown manifests; `partial-failure` retains partial artifacts when some steps fail.
 */
type ArchivedFileRecord = {
  blobUrl: string;
  filePath: string;
  htmlPath: string;
  markdownPath: string;
  markdownSource: "local-repo" | "raw-github";
  rawUrl: string;
  screenshotJsonPath?: string;
  screenshotPath?: string;
  status: "archived" | "partial-failure";
  steps: {
    htmlSnapshot: "ok" | "failed";
    markdown: "ok" | "failed";
    screenshot: "ok" | "failed";
  };
  errors: string[];
};

/**
 * Minimal Firecrawl scrape JSON shape used when reading screenshot metadata from disk.
 *
 * @remarks
 * Only `screenshot` is consulted; extra fields are ignored by this script.
 */
type ScreenshotPayload = {
  screenshot?: string;
};

/**
 * Prints CLI usage text for manual invocation or `--help`.
 *
 * @remarks
 * Writes to stdout only; does not exit the process.
 */
function printUsage(): void {
  console.log(`
Usage:
  npx tsx skills/research-online/scripts/archive-github-repo-docs.ts \\
    --session-dir ".researches/<timestamp>" \\
    --github-repo "owner/repo" \\
    --branch "main" \\
    --repo-dir "/path/to/local/clone" \\
    --file "README.md" \\
    --file "docs/tool-reference.md"

Options:
  --session-dir   Active research session directory (required)
  --github-repo   GitHub repository in owner/repo form (required)
  --branch        Git branch or ref to archive (default: main)
  --repo-dir      Local clone to use as canonical markdown source when available
  --screenshot-mode  Screenshot policy: always, docs-only, never (default: docs-only)
  --file          Relative file path to archive; repeatable
  --files-from    Newline-delimited file list to archive
  --help, -h      Show this help
`);
}

/**
 * Normalizes a repository-relative path and rejects empty, `.`, or `..` traversal segments.
 *
 * @remarks
 * Throws when the path is unsafe for GitHub URL construction or local filesystem joins.
 *
 * @throws Error when the input cannot be represented as a safe repo-relative POSIX path.
 */
function normalizeRelativeFilePath(filePath: string): string {
  const trimmedPath = filePath.trim().replace(/\\/g, "/");
  const withoutLeadingSlash = trimmedPath.replace(/^\/+/, "");
  const normalizedPath = path.posix.normalize(withoutLeadingSlash);

  if (
    normalizedPath.length === 0 ||
    normalizedPath === "." ||
    normalizedPath.startsWith("../") ||
    normalizedPath.includes("/../")
  ) {
    throw new Error(`Invalid relative file path: ${filePath}`);
  }

  return normalizedPath;
}

/**
 * Builds the deduplicated sorted file list from repeatable `--file` flags and optional `--files-from`.
 *
 * @remarks
 * Skips blank lines and `#` comments in the list file; resolves `--files-from` to an absolute path first.
 *
 * @throws Error when the list file is missing or not a regular file.
 */
function loadFilePaths(values: {
  file?: string[];
  "files-from"?: string;
}): string[] {
  const filePaths = new Set<string>();

  const explicitFiles = Array.isArray(values.file) ? values.file : [];
  explicitFiles.forEach((filePath) => {
    filePaths.add(normalizeRelativeFilePath(filePath));
  });

  if (typeof values["files-from"] === "string" && values["files-from"].trim().length > 0) {
    const listPath = path.resolve(values["files-from"].trim());
    if (!fs.existsSync(listPath) || !fs.statSync(listPath).isFile()) {
      throw new Error(`--files-from file not found: ${values["files-from"]}`);
    }

    fs.readFileSync(listPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .forEach((line) => {
        filePaths.add(normalizeRelativeFilePath(line));
      });
  }

  return Array.from(filePaths).sort((left, right) => left.localeCompare(right));
}

/**
 * Parses argv into archive options after validating required flags and filesystem preconditions.
 *
 * @remarks
 * Calls `printUsage` and `process.exit(0)` when `--help` is present.
 *
 * @throws Error when required options, repo shape, paths, or screenshot mode are invalid.
 */
function parseCliOptions(): ArchiveOptions {
  const { values } = parseArgs({
    options: {
      "session-dir": { type: "string" },
      "github-repo": { type: "string" },
      branch: { type: "string" },
      "repo-dir": { type: "string" },
      "screenshot-mode": { type: "string" },
      file: { type: "string", multiple: true },
      "files-from": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (typeof values["session-dir"] !== "string" || values["session-dir"].trim().length === 0) {
    throw new Error("--session-dir is required");
  }

  if (typeof values["github-repo"] !== "string" || values["github-repo"].trim().length === 0) {
    throw new Error("--github-repo is required");
  }

  const filePaths = loadFilePaths({
    file: values.file,
    "files-from": values["files-from"],
  });

  if (filePaths.length === 0) {
    throw new Error("Provide at least one --file or a non-empty --files-from list");
  }

  const githubRepo = values["github-repo"].trim();
  if (!/^[^/]+\/[^/]+$/.test(githubRepo)) {
    throw new Error("--github-repo must be in owner/repo form");
  }

  const repoDir =
    typeof values["repo-dir"] === "string" && values["repo-dir"].trim().length > 0
      ? path.resolve(values["repo-dir"].trim())
      : undefined;

  if (repoDir !== undefined && (!fs.existsSync(repoDir) || !fs.statSync(repoDir).isDirectory())) {
    throw new Error(`--repo-dir is not a directory: ${values["repo-dir"]}`);
  }

  const screenshotModeRaw =
    typeof values["screenshot-mode"] === "string" && values["screenshot-mode"].trim().length > 0
      ? values["screenshot-mode"].trim()
      : "docs-only";
  if (
    screenshotModeRaw !== "always" &&
    screenshotModeRaw !== "docs-only" &&
    screenshotModeRaw !== "never"
  ) {
    throw new Error("--screenshot-mode must be one of: always, docs-only, never");
  }

  return {
    sessionDir: path.resolve(values["session-dir"].trim()),
    githubRepo,
    branch:
      typeof values.branch === "string" && values.branch.trim().length > 0
        ? values.branch.trim()
        : "main",
    repoDir,
    filePaths,
    screenshotMode: screenshotModeRaw,
  };
}

/**
 * Ensures the parent directory exists for a destination file path.
 *
 * @remarks
 * Uses recursive `mkdir`; safe for repeated calls with the same logical tree.
 */
function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Encodes each path segment for GitHub blob and raw URLs while preserving slash separators.
 *
 * @remarks
 * Uses `encodeURIComponent` per segment so Unicode and spaces survive URL assembly.
 */
function encodeGitHubRelativePath(relativePath: string): string {
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Performs an HTTP GET and returns the response body as UTF-8 text.
 *
 * @remarks
 * Sets a User-Agent and follows redirects; throws on non-2xx responses.
 *
 * @throws Error when the HTTP status is not ok.
 */
async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "research-online",
      Accept: "text/plain, text/html;q=0.9, */*;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return await response.text();
}

/**
 * Performs an HTTP GET and returns the response body as a byte buffer.
 *
 * @remarks
 * Used for screenshot PNG downloads referenced by Firecrawl JSON URLs.
 *
 * @throws Error when the HTTP status is not ok.
 */
async function downloadBinary(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "research-online",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Binary request failed (${response.status}) for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Copies markdown from a local repository clone when the source file exists.
 *
 * @remarks
 * Returns `false` when the source path is missing or not a file; does not throw for missing files.
 */
function copyLocalMarkdown(options: {
  destinationPath: string;
  filePath: string;
  repoDir: string;
}): boolean {
  const sourcePath = path.join(options.repoDir, options.filePath);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    return false;
  }

  ensureParentDir(options.destinationPath);
  fs.copyFileSync(sourcePath, options.destinationPath);
  return true;
}

/**
 * Downloads canonical markdown from the raw.githubusercontent.com URL into the session tree.
 *
 * @remarks
 * Writes atomically via `writeFileSync` after ensuring parent directories exist.
 *
 * @throws Error when the HTTP fetch fails or the response is not ok.
 */
async function writeRawMarkdown(options: {
  destinationPath: string;
  rawUrl: string;
}): Promise<void> {
  const markdownContent = await fetchText(options.rawUrl);
  ensureParentDir(options.destinationPath);
  fs.writeFileSync(options.destinationPath, markdownContent, "utf8");
}

/**
 * Invokes the `firecrawl` CLI to screenshot a blob URL and parses the emitted JSON payload.
 *
 * @remarks
 * Synchronous subprocess plus filesystem read; returns `{}` when JSON parses to nullish content.
 */
function runFirecrawlScreenshot(options: {
  blobUrl: string;
  screenshotJsonPath: string;
}): ScreenshotPayload {
  ensureParentDir(options.screenshotJsonPath);
  execFileSync(
    "firecrawl",
    [
      "scrape",
      options.blobUrl,
      "--format",
      "screenshot",
      "--json",
      "-o",
      options.screenshotJsonPath,
    ],
    {
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  const parsedPayload = JSON.parse(fs.readFileSync(options.screenshotJsonPath, "utf8")) as
    | ScreenshotPayload
    | null;

  return parsedPayload ?? {};
}

/**
 * Renders a Markdown report summarizing session inputs and per-file archival outcomes.
 *
 * @remarks
 * Suitable for human review alongside JSON manifests under the Firecrawl reports directory.
 */
function buildManifestMarkdown(options: {
  branch: string;
  githubRepo: string;
  records: ArchivedFileRecord[];
  repoDir?: string;
  sessionDir: string;
  screenshotMode: ArchiveGithubRepoDocs_ScreenshotMode;
}): string {
  const requestedCount = options.records.length;
  const archivedCount = options.records.filter((record) => record.status === "archived").length;
  const partialFailureCount = requestedCount - archivedCount;
  const localMarkdownCount = options.records.filter(
    (record) => record.markdownSource === "local-repo",
  ).length;

  const lines = [
    "# GitHub Repo Docs Archival",
    "",
    `- Generated at: ${new Date().toISOString()}`,
    `- Session: ${options.sessionDir}`,
    `- GitHub repo: ${options.githubRepo}`,
    `- Branch: ${options.branch}`,
    `- Local repo source: ${options.repoDir ?? "not provided"}`,
    `- Screenshot mode: ${options.screenshotMode}`,
    `- Files requested: ${requestedCount}`,
    `- Fully archived: ${archivedCount}`,
    `- Partial failures: ${partialFailureCount}`,
    `- Markdown from local clone: ${localMarkdownCount}`,
    `- Markdown from raw GitHub: ${requestedCount - localMarkdownCount}`,
    "",
    "## Files",
    "",
  ];

  options.records.forEach((record) => {
    lines.push(`### ${record.filePath}`);
    lines.push(`- Status: ${record.status}`);
    lines.push(`- Markdown source: ${record.markdownSource}`);
    lines.push(`- Blob URL: ${record.blobUrl}`);
    lines.push(`- Raw URL: ${record.rawUrl}`);
    lines.push(`- Markdown path: ${record.markdownPath}`);
    lines.push(`- HTML path: ${record.htmlPath}`);
    lines.push(`- Screenshot JSON path: ${record.screenshotJsonPath ?? "not written"}`);
    lines.push(`- Screenshot PNG path: ${record.screenshotPath ?? "not written"}`);
    if (record.errors.length > 0) {
      lines.push("- Errors:");
      record.errors.forEach((error) => {
        lines.push(`  - ${error}`);
      });
    }
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

/**
 * Decides whether Firecrawl screenshot capture runs for a given path and screenshot policy.
 *
 * @remarks
 * In `docs-only` mode, screenshots run for common doc extensions or paths under `docs/`.
 */
function shouldCaptureScreenshot(options: {
  filePath: string;
  screenshotMode: ArchiveGithubRepoDocs_ScreenshotMode;
}): boolean {
  if (options.screenshotMode === "always") {
    return true;
  }

  if (options.screenshotMode === "never") {
    return false;
  }

  const normalizedPath = options.filePath.toLowerCase();
  const extname = path.posix.extname(normalizedPath);
  if (extname === ".md" || extname === ".mdx" || extname === ".rst" || extname === ".txt") {
    return true;
  }

  return normalizedPath.startsWith("docs/") || normalizedPath.includes("/docs/");
}

/**
 * Archives one repository file: markdown (local or raw), rendered HTML snapshot, and optional screenshot.
 *
 * @remarks
 * Partial failures append to `errors` and downgrade status without throwing; uses network and subprocess I/O.
 */
async function archiveFile(options: {
  branch: string;
  filePath: string;
  githubRepo: string;
  layout: ReturnType<typeof buildResearchSessionLayout>;
  repoDir?: string;
  screenshotMode: ArchiveGithubRepoDocs_ScreenshotMode;
}): Promise<ArchivedFileRecord> {
  const encodedRelativePath = encodeGitHubRelativePath(options.filePath);
  const blobUrl = `https://github.com/${options.githubRepo}/blob/${options.branch}/${encodedRelativePath}`;
  const rawUrl = `https://raw.githubusercontent.com/${options.githubRepo}/${options.branch}/${encodedRelativePath}`;
  const markdownPath = path.join(options.layout.documentationMarkdownDir, options.filePath);
  const htmlPath = path.join(options.layout.documentationHtmlDir, `${options.filePath}.html`);
  const screenshotJsonPath = path.join(
    options.layout.firecrawlRawDir,
    "screenshots",
    `${options.filePath}.screenshot.json`,
  );
  const screenshotPath = path.join(
    options.layout.documentationScreenshotsDir,
    `${options.filePath}.png`,
  );

  const record: ArchivedFileRecord = {
    filePath: options.filePath,
    blobUrl,
    rawUrl,
    markdownPath,
    htmlPath,
    screenshotJsonPath,
    screenshotPath,
    markdownSource: options.repoDir === undefined ? "raw-github" : "local-repo",
    status: "archived",
    steps: {
      markdown: "failed",
      htmlSnapshot: "failed",
      screenshot: "failed",
    },
    errors: [],
  };

  try {
    if (
      options.repoDir !== undefined &&
      copyLocalMarkdown({
        destinationPath: markdownPath,
        filePath: options.filePath,
        repoDir: options.repoDir,
      })
    ) {
      record.markdownSource = "local-repo";
    } else {
      record.markdownSource = "raw-github";
      await writeRawMarkdown({
        destinationPath: markdownPath,
        rawUrl,
      });
    }
    record.steps.markdown = "ok";
  } catch (error) {
    record.errors.push(
      `Markdown archive failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const htmlContent = await fetchText(blobUrl);
    ensureParentDir(htmlPath);
    fs.writeFileSync(htmlPath, htmlContent, "utf8");
    record.steps.htmlSnapshot = "ok";
  } catch (error) {
    record.errors.push(
      `HTML snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (shouldCaptureScreenshot({ filePath: options.filePath, screenshotMode: options.screenshotMode })) {
    try {
      const screenshotPayload = runFirecrawlScreenshot({
        blobUrl,
        screenshotJsonPath,
      });
      if (
        typeof screenshotPayload.screenshot !== "string" ||
        screenshotPayload.screenshot.length === 0
      ) {
        throw new Error("Firecrawl screenshot payload did not include a screenshot URL");
      }

      const screenshotBytes = await downloadBinary(screenshotPayload.screenshot);
      ensureParentDir(screenshotPath);
      fs.writeFileSync(screenshotPath, screenshotBytes);
      record.steps.screenshot = "ok";
    } catch (error) {
      record.errors.push(
        `Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    record.screenshotJsonPath = undefined;
    record.screenshotPath = undefined;
    record.steps.screenshot = "ok";
  }

  if (record.errors.length > 0) {
    record.status = "partial-failure";
  }

  return record;
}

/**
 * CLI entrypoint: materializes session directories, archives each requested file, and writes manifests.
 *
 * @remarks
 * Final stdout line is JSON with paths to the JSON and Markdown manifest files for downstream tooling.
 */
async function main(): Promise<void> {
  const options = parseCliOptions();
  const layout = buildResearchSessionLayout(options.sessionDir);

  [
    layout.documentationDir,
    layout.documentationHtmlDir,
    layout.documentationMarkdownDir,
    layout.documentationScreenshotsDir,
    layout.documentationFullPageScreenshotsDir,
    layout.firecrawlDir,
    layout.firecrawlRawDir,
    layout.firecrawlReportsDir,
  ].forEach((directoryPath) => {
    fs.mkdirSync(directoryPath, { recursive: true });
  });

  const records: ArchivedFileRecord[] = [];

  for (const filePath of options.filePaths) {
    const record = await archiveFile({
      branch: options.branch,
      filePath,
      githubRepo: options.githubRepo,
      layout,
      repoDir: options.repoDir,
      screenshotMode: options.screenshotMode,
    });
    records.push(record);
  }

  const reportJsonPath = path.join(layout.firecrawlReportsDir, "github-doc-archival-manifest.json");
  const reportMarkdownPath = path.join(layout.firecrawlReportsDir, "github-doc-archival-manifest.md");

  const manifest = {
    generatedAt: new Date().toISOString(),
    sessionDir: options.sessionDir,
    githubRepo: options.githubRepo,
    branch: options.branch,
    repoDir: options.repoDir ?? null,
    screenshotMode: options.screenshotMode,
    filesRequested: options.filePaths.length,
    filesArchived: records.length,
    fullyArchivedCount: records.filter((record) => record.status === "archived").length,
    partialFailureCount: records.filter((record) => record.status === "partial-failure").length,
    records,
  };

  fs.writeFileSync(reportJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    reportMarkdownPath,
    buildManifestMarkdown({
      branch: options.branch,
      githubRepo: options.githubRepo,
      records,
      repoDir: options.repoDir,
      sessionDir: options.sessionDir,
      screenshotMode: options.screenshotMode,
    }),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        sessionDir: options.sessionDir,
        githubRepo: options.githubRepo,
        branch: options.branch,
        screenshotMode: options.screenshotMode,
        filesRequested: options.filePaths.length,
        fullyArchivedCount: manifest.fullyArchivedCount,
        partialFailureCount: manifest.partialFailureCount,
        reportJsonPath,
        reportMarkdownPath,
      },
      null,
      2,
    ),
  );
}

void main();
