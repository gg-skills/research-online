/**
 * @fileoverview CLI entry point that bootstraps a Firecrawl-backed research session directory.
 * Owned by the `research-online/SKILL.md` skill; agents invoke this to create timestamped
 * session folders before crawling.
 *
 * @example
 * ```bash
 * npx tsx skills/research-online/scripts/init-research-session.ts \
 *   --query "OpenRouter model pricing" \
 *   --metadata '{"priority":"high"}'
 * ```
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/init-research-session.ts --query "OpenRouter model pricing"
 * @see skills/research-online/SKILL.md - Skill workflow documentation for Firecrawl-backed research sessions.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { parseArgs } from "node:util";

import { ensureResearchSession, isRecord, type Metadata } from "./research-session";

/**
 * Prints CLI usage and supported flags to stdout for `--help` and operator discovery.
 *
 * @remarks
 * PURITY: Writes only to `console.log`; does not parse argv or exit the process.
 */
function printUsage(): void {
  console.log(`
Usage:
  npx tsx skills/research-online/scripts/init-research-session.ts --query "Research topic"

Options:
  --query, -q      Research query or question
  --metadata, -m   JSON object string with extra metadata
  --help, -h       Show this help
`);
}

/**
 * Parses argv, validates required inputs, materializes the research session layout, and prints JSON paths.
 *
 * @remarks
 * I/O: Reads `--metadata` JSON from argv; creates session directories via `ensureResearchSession`; writes a single JSON object to stdout.
 * Throws when `--query` is missing/empty, JSON metadata is not an object, or session bootstrap fails.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      query: { type: "string", short: "q" },
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

  let metadata: Metadata | undefined;
  if (typeof values.metadata === "string") {
    const parsedMetadata = JSON.parse(values.metadata);
    if (!isRecord(parsedMetadata)) {
      throw new Error("--metadata must be a JSON object");
    }

    metadata = parsedMetadata;
  }

  const layout = ensureResearchSession({
    query: values.query.trim(),
    metadata,
  });

  console.log(
    JSON.stringify(
      {
        sessionDir: layout.sessionDir,
        firecrawlDir: layout.firecrawlDir,
        firecrawlOutputDir: layout.firecrawlRawDir,
        documentationDir: layout.documentationDir,
        documentationHtmlDir: layout.documentationHtmlDir,
        documentationMarkdownDir: layout.documentationMarkdownDir,
        documentationScreenshotDir: layout.documentationScreenshotsDir,
        documentationFullPageScreenshotsDir: layout.documentationFullPageScreenshotsDir,
        firecrawlReportsDir: layout.firecrawlReportsDir,
        subagentReportsDir: layout.subagentReportsDir,
        webSearchDir: layout.webSearchDir,
        webFetchDir: layout.webFetchDir,
        webResearchDir: layout.webResearchDir,
        metadataPath: layout.metadataPath,
      },
      null,
      2,
    ),
  );
}

main();
