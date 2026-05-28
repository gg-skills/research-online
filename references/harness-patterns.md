# Harness Research Patterns (CLI)

Patterns for spawning harness workers to parallelize research using Firecrawl CLI, built-in web tools, or hybrid combinations.

## Pattern 1: Parallel Site Research

Research multiple sites simultaneously, one subagent per site.

**Use case:** Cross-site documentation or competitor comparison.

```bash
# One subagent per site
firecrawl search "site:salesforce.com sales cloud pricing" --scrape --limit 5 --json \
  -o .researches/<timestamp>/firecrawl/raw/salesforce-search.json

firecrawl scrape "https://www.salesforce.com/products/sales-cloud" --only-main-content \
  -o .researches/<timestamp>/firecrawl/raw/salesforce.md
```

## Pattern 2: Section-Based Documentation Extraction

Map a docs site, then split sections across harness workers.

```bash
# Main agent discovers URLs
firecrawl map "https://docs.example.com" --json -o .researches/<timestamp>/firecrawl/raw/map.json

# Harness workers process assigned sections
firecrawl scrape "<section-url>" --only-main-content -o .researches/<timestamp>/firecrawl/raw/sections/<name>.md
```

## Pattern 3: Search Result Distribution

Search once, then distribute result URLs into fixed batches.

```text
1. Run one search with --limit N and --json output.
2. Tokenize URLs as URL_1..URL_N.
3. Split into batches (e.g., 5 URLs per delegate runner).
4. Each subagent scrapes only its assigned URLs.
5. Merge outputs and dedupe.
```

## Pattern 4: Hierarchical Research

Use tiered harness workers (industry -> company -> product).

```text
Level 1 subagent:
- firecrawl search for top entities and canonical sources.
- Return normalized entity list.

Level 2 harness workers:
- One entity each; run scrape/crawl for details.
- Save artifacts under per-entity folders.
```

## Pattern 5: Structured Extraction Pipeline

Use `firecrawl agent --schema` across multiple sites in parallel.

```bash
firecrawl agent "Extract product name, price, availability" \
  --urls "https://site-a.example.com/products" \
  --schema-file schema.json --wait --json \
  -o .researches/<timestamp>/extractions/site-a.json
```

Repeat per site/subagent and consolidate.

## Pattern 6: Agent-Directed Deep Research

Use `firecrawl agent` for discovery, then fan out deterministic commands.

**Use case:** Open-ended tasks with uncertain source locations.

**Guardrails:**

- Use `--wait` and explicit output file paths.
- Bound cost using model/credit controls where applicable.
- After discovery, switch to `search`/`scrape`/`crawl` for follow-up extraction.

**Fallbacks:**

1. If agent output is too broad, narrow with `search "site:..."`.
2. If URLs are known, skip agent and scrape directly.
3. For JS-heavy pages, escalate to `firecrawl browser`.

---

## Hybrid Patterns: Web Tools + Firecrawl

These patterns use `web_search` for Phase 1 discovery (zero-setup, always available) and
Firecrawl for Phase 2 deep extraction (clean markdown, structured data, site mapping).
Use `save-web-research.ts` and `consolidate-research.ts` with `--session-dir` to unify
all artifacts into one session.

### Pattern 7: Hybrid Search-Then-Scrape

Use `web_search` to discover relevant URLs, then Firecrawl to extract clean content from
the most promising results.

**Use case:** General research where you don't know which sites have the best information.

**Key efficiency principle:** When `web_search` returns 5 results, scan titles and snippets
first. Do not read all results in full. Select only the 1-2 most relevant URLs and deep-read
those with `web_fetch`. Save full discovery results for reproducibility even if you only
deep-read a subset.

```text
❌ web_search → read all 5 full results → try to synthesize from 5 noisy pages
✅ web_search → scan titles + snippets → select 1-2 best → web_fetch → synthesize
```

```text
Phase 1 — Discovery (built-in web tools, zero setup)
  1. Init session: npx tsx scripts/init-research-session.ts --query "Better Auth vs NextAuth"
  2. web_search for topic, identify top 2-5 URLs
  3. Save discovery results:
     npx tsx scripts/save-web-research.ts \
       --query "Better Auth vs NextAuth" \
       --source search \
       --content "{...search results JSON...}" \
       --session-dir "$SESSION_DIR"

Phase 2 — Deep extraction (Firecrawl, targeted)
  1. For each promising URL from Phase 1:
     firecrawl scrape "$URL" --only-main-content \
       -o "$SESSION_DIR/firecrawl/raw/$(slugify $URL).md"
  2. Or batch with search:
     firecrawl search "site:docs.example.com auth" --scrape --limit 5 \
       -o "$SESSION_DIR/firecrawl/raw/auth-search.json"

Consolidation
  npx tsx scripts/consolidate-research.ts \
    --session-dir "$SESSION_DIR" \
    --query "Better Auth vs NextAuth comparison" \
    --format thematic
```

**Skip Phase 2 when:** The web_search/web_fetch results already provide sufficient
information for the query. No need to spend Firecrawl credits on simple lookups.

### Pattern 8: Parallel Discovery Workers

Spawn multiple discovery workers using `web_search`, each targeting a different aspect
of the research question. Then selectively deepen the most relevant results.

**Use case:** Multi-faceted research where different sub-questions need different sources.

```text
Session init:
  npx tsx scripts/init-research-session.ts --query "Drizzle ORM ecosystem"

Workers (parallel discovery):
  Worker A: web_search "Drizzle ORM connection pooling"     → save --source search
  Worker B: web_search "Drizzle ORM vs Prisma performance"   → save --source search
  Worker C: web_search "Drizzle ORM PostgreSQL best practices" → save --source search
  Worker D: web_fetch "https://orm.drizzle.team/docs/overview" → save --source fetch --url ...

Selective deepening (only for promising URLs):
  firecrawl scrape "https://orm.drizzle.team/docs/connect-overview" --only-main-content

Consolidation:
  npx tsx scripts/consolidate-research.ts --session-dir "$SESSION_DIR" --format thematic
```

**Cost guardrail:** Each `web_search` call is free. Firecrawl credits are spent only on
the most promising sources after review, not on every search result.

**Efficiency tip:** Have each worker scan its search results and only deep-read the
1-2 most relevant URLs. The other results are saved for reproducibility via
`save-web-research.ts` but don't need to be fetched.

### Pattern 9: Auto-Session Consolidation

After collecting artifacts from any combination of tools, use auto-session consolidation
instead of manually specifying input directories.

**Use case:** Mixed Firecrawl + web tool research where you want one-click consolidation.

```bash
# After saving web and/or Firecrawl artifacts to a session:
npx tsx scripts/consolidate-research.ts \
  --auto-session \
  --query "Research question" \
  --format source-based

# Or with an explicit session:
npx tsx scripts/consolidate-research.ts \
  --session-dir .researches/2026-05-18T002403Z \
  --query "Research question" \
  --format thematic
```

`--auto-session` finds the latest session under `.researches/` automatically and discovers
artifacts from `firecrawl/raw`, `firecrawl/reports`, `web-search`, `web-fetch`, and
`web-research` directories.

### Pattern 10: Web-Only Fallback

When Firecrawl is unavailable or credits are exhausted, complete research using only
built-in web tools.

**Use case:** Firecrawl CLI not installed, API key expired, or credit budget reached.

```text
Phase 1 — Discovery:
  web_search "topic query"
  → identify relevant URLs

Phase 2 — Selective reading:
  web_fetch each promising URL
  → save results:
    npx tsx scripts/save-web-research.ts \
      --query "topic" \
      --source fetch \
      --content "$(cat page-content)" \
      --url "https://example.com/page" \
      --session-dir "$SESSION_DIR"

Consolidation:
  npx tsx scripts/consolidate-research.ts \
    --session-dir "$SESSION_DIR" \
    --query "topic" \
    --format source-based
```

**Limitations vs Firecrawl:** No site mapping, no structured extraction, no JavaScript
rendering. Content cleanliness depends on source page quality. Best for text-heavy docs
and simple pages.

## Session Directory Reference

All patterns above save artifacts into a shared session directory with this structure:

```text
.researches/<timestamp>/
├── firecrawl/
│   ├── raw/              ← Firecrawl scrape/search/crawl raw output
│   └── reports/          ← Processed Firecrawl reports (JSON/MD)
├── web-search/           ← web_search result artifacts (JSON)
├── web-fetch/            ← web_fetch result artifacts (markdown, HTML)
├── web-research/         ← Hybrid search+fetch combined artifacts
├── documentation/
│   ├── html/              ← Rendered documentation pages
│   ├── markdown/         ← Documentation in markdown
│   └── screenshots/      ← Visual evidence captures
│       └── full-page/
├── subagent-reports/     ← Harness worker outputs
├── metadata.json         ← Session metadata (query, tool, phase)
├── consolidated.md       ← Final consolidated report
└── consolidated.json      ← Consolidated report in JSON
```

**Key commands:**

| Command | Purpose |
| ------- | ------- |
| `npx tsx scripts/init-research-session.ts --query "..."` | Create a new session |
| `npx tsx scripts/save-research.ts --query "..." --results ...` | Save Firecrawl artifacts |
| `npx tsx scripts/save-web-research.ts --query "..." --source search \| fetch \| hybrid` | Save web tool artifacts |
| `npx tsx scripts/consolidate-research.ts --session-dir ... --query "..."` | Consolidate session (auto-discovers all dir types) |
| `npx tsx scripts/consolidate-research.ts --auto-session --query "..."` | Consolidate latest session |
