#!/usr/bin/env -S npx tsx

/**
 * @fileoverview CLI that publishes a completed research session directory to
 * the repository. Owned by research-online; invoked by agents
 * to commit and push research artifacts at session closeout.
 *
 * @example
 * npx tsx skills/research-online/scripts/finalize-research-session.ts \
 *   --session-dir ".researches/2026-02-11T134626Z"
 *
 * @testing Manual — npx tsx skills/research-online/scripts/finalize-research-session.ts
 * @see skills/research-online/SKILL.md - Firecrawl-first research workflow that owns session finalization.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { getRepoRoot, publishScopedArtifacts } from "../../../scripts/shared/finalize-scoped-artifact";

const SESSION_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{6}Z$/;

/**
 * Prints CLI usage and flags for research session finalization.
 *
 * @remarks
 * I/O: Writes help text to stdout only; does not exit the process.
 */
function printUsage(): void {
  console.log(`
Usage:
  npx tsx skills/research-online/scripts/finalize-research-session.ts --session-dir ".researches/2026-02-11T134626Z"
  npx tsx skills/research-online/scripts/finalize-research-session.ts --latest

Options:
  --session-dir      Explicit research session directory to publish
  --latest           Publish the latest timestamped research session under .researches/
  --commit-message   Override the default commit message
  --dry-run          Show publish intent without committing
  --help, -h         Show this help
`);
}

/**
 * Selects the newest timestamped session folder under `.researches/`.
 *
 * @remarks
 * I/O: Reads directory entries synchronously from `rootDir` (expected to be the repository
 * `.researches` absolute path).
 *
 * @param rootDir - Absolute filesystem path to the `.researches` directory.
 * @returns Repo-root-relative POSIX path such as `.researches/YYYY-MM-DDTHHmmssZ`.
 * @throws When no matching timestamped session directories exist.
 */
function resolveLatestSessionDir(rootDir: string): string {
  const entries = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SESSION_DIRECTORY_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  if (entries.length === 0) {
    throw new Error("No timestamped research session directories were found.");
  }

  return path.join(".researches", entries[0]);
}

/**
 * Normalizes the target session directory from CLI flags into a repo-relative path.
 *
 * @remarks
 * PRE-CONDITION: Callers must supply either `latest === true` or a non-empty `sessionDir`.
 *
 * @param repoRoot - Absolute repository root used to resolve and relativize paths.
 * @param sessionDir - Optional explicit session directory (absolute or relative).
 * @param latest - When true, picks the newest timestamped folder under `.researches/`.
 * @returns Repo-root-relative POSIX path suitable for `publishScopedArtifacts.scopePaths`.
 * @throws When `--latest` finds no sessions or neither `latest` nor a usable `sessionDir` is given.
 */
function resolveSessionDir(repoRoot: string, sessionDir?: string, latest?: boolean): string {
  const sessionsRoot = path.join(repoRoot, ".researches");
  if (latest === true) {
    return resolveLatestSessionDir(sessionsRoot);
  }

  if (typeof sessionDir !== "string" || sessionDir.trim().length === 0) {
    throw new Error("Provide --session-dir or use --latest.");
  }

  return path.relative(repoRoot, path.resolve(repoRoot, sessionDir)).replace(/\\/g, "/");
}

/**
 * Parses CLI flags, resolves the session directory, and publishes scoped artifacts.
 *
 * @remarks
 * I/O: Reads cwd/repo layout, may invoke git publish via `publishScopedArtifacts`; prints JSON
 * result or usage to stdout. Exits only via Node's normal process completion unless helpers throw.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      "commit-message": { type: "string" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      latest: { type: "boolean" },
      "session-dir": { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help === true) {
    printUsage();
    return;
  }

  const repoRoot = getRepoRoot(process.cwd());
  const sessionDir = resolveSessionDir(
    repoRoot,
    typeof values["session-dir"] === "string" ? values["session-dir"] : undefined,
    values.latest === true,
  );

  const commitMessage =
    typeof values["commit-message"] === "string" && values["commit-message"].trim().length > 0
      ? values["commit-message"].trim()
      : `docs(research): publish ${path.basename(sessionDir)}`;

  const result = publishScopedArtifacts({
    repoRoot,
    scopePaths: [sessionDir],
    commitMessage,
    dryRun: values["dry-run"] === true,
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
