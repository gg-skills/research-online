# Research Tool Selection Guide

Tool selection follows a pragmatic decision tree. Use the simplest **available** tool that answers the question. `web_search` / `web_fetch` here mean whatever search and page-fetch tools the current harness exposes.

1. **Discovery and reads (default):** host `web_search` / `web_fetch` — any available search or fetch.
2. **Mapping, crawl, schema, JS-browser (optional):** Firecrawl CLI or equivalent — only if already installed and authenticated, and only when host fetch cannot do the job.
3. **Multi-source research:** host search for discovery, host fetch for deep-reads. Specialized scrape/map only if needed and present.

Never block research for Firecrawl setup. Missing Firecrawl is not a failure of this skill.

If Firecrawl commands are used, set `FIRECRAWL_OUTPUT_DIR` to the active research session first:

```bash
export FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"
```

## Decision Tree

```text
What do you need?
|
|-- Quick fact or discovery
|   |-- Use: host web_search
|       |-- Need deeper content from a result?
|           |-- host web_fetch the URL
|       |-- Need dual representation AND a scrape backend is already available?
|           |-- optional Firecrawl scrape --only-main-content
|
|-- Find information (don't know exact URLs)
|   |-- Use: host web_search, then host web_fetch on 1-2 URLs
|   |   |-- Do not switch search backends with the same query
|   |-- Need structured extraction AND a schema backend is already available?
|       |-- optional firecrawl agent with --schema; else fetch and parse
|
|-- Explore a website structure
|   |-- Host fetch has no map equivalent
|   |-- If Firecrawl (or equivalent) is already available: firecrawl map
|       |-- Need content from discovered pages? crawl or scrape
|   |-- Else: search `site:<domain> <topic>` and fetch listed URLs; note the gap
|
|-- Extract from known URLs
|   |-- Single or few URLs
|   |   |-- Use: host web_fetch
|   |       |-- Optional Firecrawl scrape if already available and host fetch is noisy
|   |       |-- Optional firecrawl agent --schema if structured JSON is required
|   |
|   |-- Many URLs from same site
|       |-- Host fetch each selected URL, or optional firecrawl crawl if present
|
|-- Complex multi-step research
    |-- Chain host searches first
    |-- Optional firecrawl agent --wait / browser only if that backend is present
```

## Host tools (default)

| Goal | Primary tool |
| --- | --- |
| Search web | Host `web_search` (or equivalent) |
| Read a known page | Host `web_fetch` (or equivalent) |
| Persist artifacts | `save-web-research.ts` |
| Consolidate | `consolidate-research.ts --auto-session` |

## Optional Firecrawl commands

Only when that CLI is already available. See SKILL.md for when Phase 2 is useful.

| Goal | Primary Command | Typical Flags |
| --- | --- | --- |
| Alternate search | `firecrawl search "<query>"` | `--limit`, `--sources`, `--tbs`, `--scrape` |
| Scrape known page | `firecrawl scrape "<url>"` | `--format markdown,html`, `--only-main-content`, `--wait-for` |
| Discover site URLs | `firecrawl map "<url>"` | `--search`, `--limit`, `--sitemap` |
| Crawl section | `firecrawl crawl "<url>"` | `--wait`, `--limit`, `--max-depth`, `--include-paths` |
| Structured extraction | `firecrawl agent "<prompt>"` | `--schema`, `--schema-file`, `--urls`, `--wait` |
| Interactive browsing | `firecrawl browser ...` | `launch-session`, `execute`, `list`, `close` |
| GitHub repo docs | `archive-github-repo-docs.ts` | Keep markdown from local/raw, HTML from blob page |

## Patterns

### 1. Search First (Default Host Pattern)

Start with host `web_search` for discovery, then host `web_fetch` for deep-reads:

```
# Phase 1: Discovery
web_search: "site:docs.example.com auth"
→ identify 2-5 most relevant URLs from results
→ web_fetch the 1-2 best URLs

# Phase 2: Optional specialized extraction (only if host fetch is insufficient
# and Firecrawl is already available)
firecrawl scrape "<best-url>" --only-main-content -o "$FIRECRAWL_OUTPUT_DIR/auth.md"
```

Optional Firecrawl search when that CLI is present and host search is not enough:

```bash
firecrawl search "site:docs.example.com auth" --limit 10 --json \
  -o "$FIRECRAWL_OUTPUT_DIR/search.json"
```

**Key efficiency tip:** When `web_search` returns 5 results, scan titles and snippets first.
Do not read all results in full. Select only the 1-2 most relevant URLs and
`web_fetch` those. Save full discovery results with `save-web-research.ts` for
reproducibility, even if you only deep-read a subset.

```text
❌ web_search → read all 5 full results → try to synthesize from noisy pages
✅ web_search → scan titles + snippets → select 1-2 best → web_fetch → synthesize
```

### 2. Map then Scrape

```bash
firecrawl map "https://docs.example.com" --search "webhook" --json \
  -o "$FIRECRAWL_OUTPUT_DIR/map.json"
firecrawl scrape "https://docs.example.com/reference/webhooks" --only-main-content \
  -o "$FIRECRAWL_OUTPUT_DIR/webhooks.md"
```

### 3. Controlled Crawl

```bash
firecrawl crawl "https://docs.example.com" --include-paths /docs --exclude-paths /blog \
  --limit 100 --max-depth 2 --wait --json -o "$FIRECRAWL_OUTPUT_DIR/crawl.json"
```

### 4. Structured Agent Extraction

```bash
firecrawl agent "Extract pricing tiers and limits" --schema-file schema.json --wait --json \
  -o "$FIRECRAWL_OUTPUT_DIR/pricing.json"
```

### 5. Browser Escalation for Dynamic Pages

```bash
firecrawl browser "open https://example.com"
firecrawl browser "snapshot -i"
firecrawl browser "click @e5"
firecrawl browser "scrape" -o "$FIRECRAWL_OUTPUT_DIR/dynamic.md"
firecrawl browser close
```

### 6. Verbatim Documentation Capture

```bash
firecrawl scrape "https://docs.example.com/reference/auth" --format markdown \
  -o ".researches/<timestamp>/documentation/markdown/auth.md"
firecrawl scrape "https://docs.example.com/reference/auth" --format html \
  -o ".researches/<timestamp>/documentation/html/auth.html"
```

Screenshot evidence:

```bash
firecrawl scrape "https://docs.example.com/reference/auth" --format screenshot --json \
  -o ".researches/<timestamp>/firecrawl/raw/auth-screenshot.json"
curl -L "$(jq -r '.screenshot' .researches/<timestamp>/firecrawl/raw/auth-screenshot.json)" \
  -o ".researches/<timestamp>/documentation/screenshots/auth.png"
```

If the installed CLI lacks a direct full-page screenshot flag, escalate to `firecrawl browser ...` after confirming the command surface with `firecrawl browser --help`.

### 7. GitHub Repository Docs (Hybrid Pattern)

When documentation lives as tracked files in a GitHub repository:

- Use the local clone or `raw.githubusercontent.com` as the canonical markdown source.
- Save rendered HTML from the GitHub blob page for source fidelity.
- Use Firecrawl screenshot capture on the blob page only when visual evidence is useful.
- Skip screenshots by default for source code files; keep them for markdown/docs pages.
- Do not treat blob-page `firecrawl scrape` markdown as verbatim file content.

```bash
npx tsx .agents/skills/research-online/scripts/archive-github-repo-docs.ts \
  --session-dir ".researches/<timestamp>" \
  --github-repo "owner/repo" \
  --branch "main" \
  --repo-dir "/abs/path/to/clone" \
  --screenshot-mode docs-only \
  --file "README.md" \
  --file "docs/tool-reference.md"
```

If browser fallback is required for GitHub pages, prefer explicit `firecrawl browser execute --node ...` or `--python ...`. Avoid assuming the agent-browser shorthand or `launch-session --json` will behave consistently across CLI versions.

## Cost and Reliability Guardrails

1. Start with host `web_search` for discovery and host `web_fetch` for known URLs.
2. Use a specialized backend only when you need mapping, crawl, schema extraction, or JS-browser work that host fetch cannot do — and only if it is already available.
3. If Firecrawl is in use: `search`/`scrape`/`map` before `agent`.
4. Add explicit limits (`--limit`, `--max-depth`) for crawls.
5. Use `--max-age` for cache reuse during iteration (specialized backends).
6. Save output to files (`-o` or `save-web-research.ts`) and inspect incrementally.
7. Use `agent` only when deterministic commands cannot complete the task.
8. For GitHub repo docs, do not spend specialized-backend credits on canonical markdown capture; use raw URLs or the archival helper.
9. Host `web_search` + `web_fetch` is a complete default path, not a fallback.
10. Multi-source research: host search for discovery, host fetch for the best sources; Phase 2 only if needed.
11. Formulate specific, disambiguated queries before searching — see SKILL.md > Research Methodology > Query Formulation for heuristics.
12. Evaluate source credibility before deep-reading — prioritize results matching 3+ strong signals (official docs, recent, code examples, first-party, canonical). See SKILL.md > Research Methodology > Source Evaluation.

### Hybrid Two-Phase Research Pattern

For multi-source research where both breadth and depth matter, compose the tools in two phases:

**Phase 1 — Discovery (host search/fetch, default):**
1. Use host `web_search` with the research query to discover relevant URLs.
2. Review result titles and snippets to identify the 2–5 most promising sources.
3. Use host `web_fetch` on the **most promising 1–2 URLs only** for immediate deep-reads. Do not fetch all results — selectivity reduces context noise and improves synthesis quality.
4. If the answers are sufficient, deliver the synthesis — no specialized backend needed.

**Phase 2 — Deep extraction (optional specialized backend):**
5. Only if host fetch cannot produce clean extraction, structured JSON, site maps, or crawls **and** a backend such as Firecrawl CLI is already available:
   ```bash
   firecrawl scrape "<url>" --only-main-content --format markdown
   ```
6. For multi-page sites that need mapping (host fetch has no equivalent):
   ```bash
   firecrawl map "<site-root>" --search "<topic>"
   ```
7. Save all Phase 2 outputs to the `.researches/<timestamp>/` session folder.

**When to skip Phase 2:**
- Phase 1 provided sufficient answers.
- No specialized backend is installed or authenticated.
- The research doesn't need mapping, crawl, schema extraction, or dual-representation archival.

**When Phase 2 is useful (only if a backend is already available):**
- Research needs structured JSON extraction (`firecrawl agent --schema` or equivalent).
- Research needs site-wide mapping or crawling.
- Research needs dual-representation archival that host fetch cannot produce.

This pattern uses always-available host tools for discovery, and spends specialized-backend budget only on the extraction tasks those backends uniquely cover.

## Firecrawl Command Examples

**Hybrid discovery pattern (recommended for most research):**

1. Discover with host `web_search`, then deep-read with host `web_fetch`:

```
web_search: "What changed in Next.js 15?"
→ scan titles + snippets (don't read all results in full)
→ select 1-2 most relevant URLs
web_fetch: top URL for deep content
→ optional, only if host fetch is insufficient AND a specialized backend is already available:
   firecrawl scrape "<url>" --only-main-content --format markdown
```

Optional Firecrawl search (only if that CLI is already available and host search is not enough):

```bash
export FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"
firecrawl search "site:nextjs.org Next.js 15" --scrape --limit 10 --json \
  -o "$FIRECRAWL_OUTPUT_DIR/search.json"
```

Optional dual-representation scrape (same condition):

```bash
firecrawl scrape "https://docs.nextjs.org/14" --format markdown \
  -o ".researches/<timestamp>/documentation/markdown/nextjs-14.md"
firecrawl scrape "https://docs.nextjs.org/14" --format html \
  -o ".researches/<timestamp>/documentation/html/nextjs-14.html"
```

## Command Decision Guide

| Scenario | Best tool | Reasoning |
|----------|-----------|----------|
| Quick fact lookup or discovery | Host `web_search` | Default path; any available search |
| Known URL to read | Host `web_fetch` | Default path; any available fetch |
| Do not know exact URLs, need targeted search | Host `web_search` then `web_fetch` | Scan snippets, then selective deep-read |
| Need site structure | Specialized backend `map` (e.g. Firecrawl) if already available | No host-tool equivalent |
| Deep-dive a docs section | Host `web_fetch` on listed URLs; optional specialized `crawl` | Crawl only if backend is present |
| Extract structured fields | Specialized `agent --schema` if already available | Otherwise fetch and parse manually |
| Complex autonomous exploration | Specialized `agent --wait` if already available | Otherwise chain host searches |
| JS-heavy or interactive page | Specialized `browser` if already available | Otherwise note the gap |
| Multi-source archival for repo docs | `archive-github-repo-docs.ts` | Hybrid markdown + HTML capture |
| Reproducible research session | Session scripts + `.researches/` | Independent of which search/fetch ran |
| No specialized backend installed | Host `web_search` / `web_fetch` | Complete default path, not a fallback |

**Rule of thumb:** Use the simplest available tool that suffices. Host search/fetch for discovery and reads. Specialized backends only for mapping, crawl, schema, or browser work they uniquely cover — and only if already available.

## Quick Decision Guide

| Scenario | Recommended path | Trade-off |
|----------|------------------|----------|
| Need current facts from web | Host `web_search` | Default; no extra install |
| Deep docs extraction | Host `web_fetch` for single pages; optional specialized `map`/`scrape` for multi-page sites | Host tools for speed; backend only if already available |
| Structured data from known pages | Specialized `agent --schema` if already available; else fetch and parse | Schema extraction is optional |
| JS-heavy or interactive page | Specialized `browser` if already available; else note the gap | Slowest; only when host fetch fails |
| GitHub repo docs | `archive-github-repo-docs.ts` | Avoids blob-page markdown noise |
| Quick question, no session needed | Host `web_search` | Fastest path to an answer |
| Systematic multi-source research | Host search/fetch + `.researches/` session | Reproducibility does not require Firecrawl |
| Compose discovery + deep extraction | Phase 1: host `web_search` → Phase 2 only if needed and a backend is present | Default is host-only |

### Additional Cost and Reliability Guardrails

2. If a specialized crawl/scrape backend is in use, prefer `--max-age` for cache hits during iterative debugging.
3. Scope crawls aggressively (`--limit`, `--include-paths`, `--exclude-paths`) when a crawl backend is used.
4. Use schema-extraction agents only when structured output is required and that backend is already available.
5. Treat autonomous browser/agent modes as a last resort and include timeout fallback logic.
