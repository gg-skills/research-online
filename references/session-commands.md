# Research Session Commands

Read this when you need to initialize a session, save artifacts, consolidate results, or publish a completed session. Run these commands from the project where you want to store `.researches/`.

## Quick Commands

Initialize a research session:

```bash
npx tsx .agents/skills/research-online/scripts/init-research-session.ts \
  --query "<research question>"
```

If your project defines the `research:session:init` npm script, you can also use the project alias.

```bash
npm run research:session:init -- --query "<research question>"
# Example
npm run research:session:init -- --query "What changed in Next.js 15?"
```

Consolidate with session auto-discovery (picks up web-search, web-fetch, web-research, and firecrawl dirs if present):

```bash
# Runner alternatives: bunx tsx / pnpm dlx tsx / deno run -A npm:tsx / node --import tsx / yarn dlx tsx
npx tsx .agents/skills/research-online/scripts/consolidate-research.ts \
  --session-dir ".researches/<timestamp>" \
  --query "What changed in Next.js 15?" \
  --format thematic

# Content cleaning is enabled by default during consolidation.
# Use --no-clean to disable it when raw content is needed:
npx tsx .agents/skills/research-online/scripts/consolidate-research.ts \
  --session-dir ".researches/<timestamp>" \
  --query "What changed in Next.js 15?" \
  --format thematic \
  --no-clean

# Or consolidate the latest session automatically:
npx tsx .agents/skills/research-online/scripts/consolidate-research.ts \
  --auto-session \
  --query "What changed in Next.js 15?" \
  --format thematic
```

Consolidate from specific directories (legacy, single input dir):

```bash
# Runner alternatives: bunx tsx / pnpm dlx tsx / deno run -A npm:tsx / node --import tsx / yarn dlx tsx
npx tsx .agents/skills/research-online/scripts/consolidate-research.ts \
  --input-dir ".researches/<timestamp>/firecrawl/reports" \
  --query "What changed in Next.js 15?" \
  --format thematic
```

Save host web tool results into a session:

```bash
# Save web_search results
# Runner alternatives: bunx tsx / pnpm dlx tsx / deno run -A npm:tsx / node --import tsx / yarn dlx tsx
npx tsx .agents/skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source search \
  --content '{"results": [...]}'

# Save web_fetch content (content cleaning enabled by default for fetch sources)
npx tsx .agents/skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source fetch \
  --content "$(cat page.md)" \
  --url "https://orm.drizzle.team/docs/connect-overview"

# Save web_fetch content with raw content preserved (--no-clean)
npx tsx .agents/skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source fetch \
  --content "$(cat page.md)" \
  --url "https://orm.drizzle.team/docs/connect-overview" \
  --no-clean
```

Consolidation publishes session artifacts by default. To review the results before publishing, consolidate with `--no-publish`, then run the finalizer. Use `--dry-run` on the finalizer to inspect the scope.

```bash
npx tsx .agents/skills/research-online/scripts/finalize-research-session.ts \
  --session-dir ".researches/<timestamp>"
```

## Script Inventory

| Script | Purpose | Key flags |
|--------|---------|-----------|
| `scripts/init-research-session.ts` | Bootstrap a timestamped research session directory | `--query`, `--metadata` |
| `scripts/save-research.ts` | Import specialized-backend artifacts (Firecrawl dumps if used) into a session | `--query`, `--results`, `--results-dir`, `--session-dir`, `--list` |
| `scripts/save-web-research.ts` | Import host search/fetch results into a session; content cleaning enabled by default for fetch/hybrid (`--no-clean` disables) | `--query`, `--source`, `--results`, `--content`, `--url`, `--clean`, `--no-clean`, `--session-dir`, `--metadata` |
| `scripts/clean-web-content.ts` | Strip navigation chrome, cookie banners, footers, edit links, feedback prompts, copy buttons, pagination, inline TOCs, back-to-top links, sponsor sections, social prompts, newsletter CTAs from web content | `--content`, `--file`, `--output`, `--source`, `--no-cookie`, `--no-nav`, `--no-footer`, `--no-social`, `--no-newsletter`, `--no-edit-links`, `--no-feedback`, `--no-related`, `--no-copy-buttons`, `--no-pagination`, `--no-toc`, `--no-back-to-top`, `--no-sponsors`, `--no-whitespace` |
| `scripts/clean-web-content.test.ts` | Regression tests for content cleaning: 10 removal tests + 8 false-positive guards | Run: `npx tsx .agents/skills/research-online/scripts/clean-web-content.test.ts`[^rt] |
| `scripts/consolidate-research.ts` | Deduplicate and merge reports into `consolidated.md` + `consolidated.json`. Content cleaning enabled by default; use `--no-clean` for raw output. Auto-discovers all artifact dirs with `--session-dir` or `--auto-session` | `--session-dir`, `--auto-session`, `--input-dir`, `--input-file`, `--query`, `--format`, `--no-clean`, `--no-dedupe`, `--no-publish`, `--output` |
| `scripts/finalize-research-session.ts` | Publish a completed session with a scoped commit/push | `--session-dir`, `--latest`, `--dry-run` |
| `scripts/archive-github-repo-docs.ts` | Archive GitHub repo docs with canonical markdown + HTML + optional screenshots | `--session-dir`, `--github-repo`, `--branch`, `--repo-dir`, `--screenshot-mode`, `--file`, `--files-from` |
| `scripts/research-session.ts` | Library: session directory layout builders and helpers | Imported by other scripts |

[^rt]: `npx tsx` accepts any standard runner — `bunx tsx`, `pnpm dlx tsx`, `deno run -A npm:tsx`, `node --import tsx`, or `yarn dlx tsx`. The first five auto-fetch `tsx` on demand; only `node --import tsx` requires `tsx` to be installed locally first (`npm i -D tsx`, or `npm i -g tsx` if you cannot reach the npm registry). Bun users can also skip `tsx` entirely and run TypeScript directly via `bun <script>`. Pick whichever your project ships. The canonical runtime decision table lives in the `skills-manager` skill under `Runtime Selection` (only available when working in the full `gg-skills` monorepo).
