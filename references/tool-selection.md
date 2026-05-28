# Research Tool Selection Guide

Tool selection follows a pragmatic decision tree. Use the simplest tool that answers the question:

1. **Quick lookup or discovery**: `web_search` / `web_fetch` — zero setup, always available, full content per result.
2. **Structured extraction, site mapping, crawling**: Firecrawl CLI — advanced capabilities, requires install and auth.
3. **Multi-source research**: Hybrid two-phase pattern — `web_search` for discovery, then Firecrawl for deep extraction.

When Firecrawl CLI is not installed or not authenticated, fall back to built-in web tools immediately. Do not block research for setup.

Set `FIRECRAWL_OUTPUT_DIR` to the active research session before running Firecrawl commands:

```bash
export FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"
```

## Decision Tree

```text
What do you need?
|
|-- Quick fact or discovery (no install needed)
|   |-- Use: web_search
|       |-- Need deeper content from a result?
|           |-- web_fetch the URL for full page content
|       |-- Need clean markdown or dual representation?
|           |-- Firecrawl scrape --only-main-content (if available)
|
|-- Find information (don't know exact URLs, need targeted discovery)
|   |-- Use: web_search first, then firecrawl search --scrape for best results
|   |   |-- Need page content from results?
|   |   |   |-- web_fetch for single URL, or firecrawl search --scrape for batch
|   |-- Need structured extraction?
|       |-- firecrawl agent with --schema
|
|-- Explore a website structure
|   |-- Use: firecrawl map
|       |-- Need content from discovered pages?
|       |   |-- Use firecrawl crawl with include/exclude paths
|       |-- Need specific pages only?
|           |-- Use firecrawl scrape on selected URLs
|
|-- Extract from known URLs
|   |-- Single or few URLs
|   |   |-- Use: web_fetch for quick reads, or firecrawl scrape for clean markdown
|   |       |-- Need full content?
|   |       |   |-- web_fetch (fastest) or firecrawl scrape --format markdown,html
|   |       |-- Need structured extraction?
|   |           |-- firecrawl agent --urls ... --schema ...
|   |
|   |-- Many URLs from same site
|       |-- Use: firecrawl crawl
|
|-- Complex multi-step research
    |-- Use: firecrawl agent --wait
        |-- If interactions are required, use firecrawl browser
```

## Command Summary

| Goal | Primary Command | Typical Flags |
| --- | --- | --- |
| Search web | `firecrawl search "<query>"` | `--limit`, `--sources`, `--tbs`, `--scrape` |
| Scrape known page | `firecrawl scrape "<url>"` | `--format markdown,html`, `--only-main-content`, `--wait-for` |
| Discover site URLs | `firecrawl map "<url>"` | `--search`, `--limit`, `--sitemap` |
| Crawl section | `firecrawl crawl "<url>"` | `--wait`, `--limit`, `--max-depth`, `--include-paths` |
| Structured extraction | `firecrawl agent "<prompt>"` | `--schema`, `--schema-file`, `--urls`, `--wait` |
| Interactive browsing | `firecrawl browser ...` | `launch-session`, `execute`, `list`, `close` |
| GitHub repo docs | `archive-github-repo-docs.ts` | Keep markdown from local/raw, HTML from blob page |

## Patterns

### 1. Search First (Hybrid Pattern)

Start with `web_search` for discovery, then use Firecrawl for deep extraction:

```
# Phase 1: Discovery with built-in tools
web_search: "site:docs.example.com auth"
→ identify 2-5 most relevant URLs from results

# Phase 2: Deep extraction with Firecrawl (if needed)
firecrawl scrape "<best-url>" --only-main-content -o "$FIRECRAWL_OUTPUT_DIR/auth.md"
```

Or use Firecrawl search when you need targeted batch results:

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
npx tsx skills/research-online/scripts/archive-github-repo-docs.ts \
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

1. Start with `web_search` for discovery — it's zero-setup and free.
2. Use Firecrawl for deep extraction only when you need clean markdown, structured data, site mapping, or archival.
3. Use `search`/`scrape`/`map` before `agent`.
4. Add explicit limits (`--limit`, `--max-depth`) for crawls.
5. Use `--max-age` for cache reuse during iteration.
6. Save output to files (`-o`) and inspect incrementally.
7. Use `agent` only when deterministic commands cannot complete the task.
8. For GitHub repo docs, spend Firecrawl credits on screenshot evidence, not canonical markdown capture.
9. When Firecrawl is unavailable, `web_search` + `web_fetch` provides full content for most research needs.
10. Use the hybrid two-phase pattern for multi-source research: `web_search` for discovery, Firecrawl for deep extraction of the best sources.
11. Formulate specific, disambiguated queries before searching — see SKILL.md > Research Methodology > Query Formulation for heuristics.
12. Evaluate source credibility before deep-reading — prioritize results matching 3+ strong signals (official docs, recent, code examples, first-party, canonical). See SKILL.md > Research Methodology > Source Evaluation.
