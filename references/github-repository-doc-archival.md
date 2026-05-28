# GitHub Repository Documentation Archival

Use this pattern when research targets documentation that lives as tracked files inside a GitHub repository, especially when you already cloned the repo locally.

## Why This Hybrid Pattern Exists

Observed on 2026-04-08 while archiving `ChromeDevTools/chrome-devtools-mcp`:

- `firecrawl scrape` on GitHub blob pages succeeded for screenshot capture and metadata.
- `firecrawl scrape` markdown from GitHub blob pages included GitHub chrome and session UI noise.
- `firecrawl scrape --only-main-content` still included GitHub repository shell content.
- `firecrawl scrape` against `raw.githubusercontent.com` produced much cleaner markdown.
- For source code files, screenshots were low-signal compared with the source text.
- `firecrawl browser "open ..."` shorthand was not reliable because the CLI attempted to invoke `agent-browser` directly and failed.
- `firecrawl browser launch-session --json` did not emit machine-readable JSON on the installed CLI version.

## Recommended Archival Contract

For each repository documentation file:

1. **Canonical markdown**: copy directly from the local clone, or fetch from `raw.githubusercontent.com`.
2. **Rendered HTML fidelity**: fetch the GitHub blob page HTML and save it as `<relative-path>.html`.
3. **Visual evidence**: for docs and markdown pages, use `firecrawl scrape "<blob-url>" --format screenshot --json`. For source code files, skip screenshots by default.

This yields three complementary artifacts: exact source text, exact rendered GitHub HTML, and optional Firecrawl-captured screenshot evidence plus metadata JSON.

## Use the Helper

```bash
npx tsx skills/research-online/scripts/archive-github-repo-docs.ts \
  --session-dir ".researches/<timestamp>" \
  --github-repo "owner/repo" \
  --branch "main" \
  --repo-dir "/absolute/path/to/local/clone" \
  --screenshot-mode docs-only \
  --file "README.md" \
  --file "docs/tool-reference.md"
```

**Screenshot modes:**

- `docs-only` (default): capture screenshots for markdown/docs-like files, skip source code files.
- `always`: capture screenshots for every file.
- `never`: never capture screenshots.

**Outputs:**

- `.researches/<timestamp>/documentation/markdown/<relative-path>`
- `.researches/<timestamp>/documentation/html/<relative-path>.html`
- `.researches/<timestamp>/documentation/screenshots/<relative-path>.png`
- `.researches/<timestamp>/firecrawl/raw/screenshots/<relative-path>.screenshot.json`
- `.researches/<timestamp>/firecrawl/reports/github-doc-archival-manifest.{json,md}`

## Browser Fallback

If screenshot capture fails and browser mode is required:

- Prefer explicit `firecrawl browser execute --node ...` or `--python ...`.
- Do not assume `firecrawl browser "open ..."` shorthand works.
- Do not assume `firecrawl browser launch-session --json` is machine-readable on every installed CLI version.
