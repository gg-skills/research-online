---
name: research-online
description: when configuring web research — multi-source discovery, site mapping, structured extraction, autonomous research. Save under .researches/. MCP-compatible. Not for offline research.
---

# GG → Research Online → Web Research

> **Snapshot age:** collected 2026-04-30 (~3 days old as of today).
> Verify release-sensitive answers with `firecrawl --help` or `firecrawl` before responding with high confidence.

## Quick Start

**Before searching, answer the 3 planning questions** in Research Planning below: what you need, what you already know, and what would be enough. Then follow these 5 steps:

1. **Discover** — `web_search` with specific, disambiguated query. Scan titles+snippets first; don't read all results. If results reveal a more specific question, chain follow-up searches (see Research Methodology → Research Chaining).
2. **Deep-read** — `web_fetch` only the 1–2 most relevant URLs. Content cleaning is on by default.
3. **Evaluate** — Score each source on the 5-signal heuristic (official docs > GitHub repos > forums/blogs). See `references/source-evaluation.md`.
4. **Synthesize** — Lead with findings, attribute every claim, resolve conflicts using the priority (official > community, recent > outdated, primary > secondary, consensus > outlier, verifiable > unverifiable), mark gaps explicitly. Verify against the Research Quality Checklist before delivering.
5. **Save** — `save-web-research.ts` for artifacts, `consolidate-research.ts --auto-session` for deduped summary. Content cleaning is on by default.

If results are poor after 2–3 reformulations, follow the **Research Dead End Protocol** (classify the failure, switch strategies not tools, document the gap, escalate rather than extrapolate).

See **Research Methodology > Research Sufficiency** for when you have enough evidence to stop researching.

For advanced research (crawling, mapping, structured JSON extraction, dual-representation archival), use Phase 2 with Firecrawl CLI. See Hybrid Two-Phase Research Pattern below.

## Research Planning

Before the first search, clarify three things. Thirty seconds of planning prevents thirty minutes of unfocused querying.

1. **What you need.** Write a one-sentence research question. If you can't, the query is too broad — narrow it until you can.
2. **What you already know.** List facts you're confident about and the version or date you know them for. This prevents re-discovering what you already have.
3. **What would be enough.** Which Research Sufficiency stopping rule applies? (1 authoritative source? 2 convergent sources? A version-qualified answer?) Set your target before searching so you know when to stop.

If you cannot answer #1, follow the Research Dead End Protocol: reformulate, switch strategy, document the gap. Do not launch a vague search hoping something useful turns up.

## Overview

Use this skill to run online research and return source-backed answers with reproducible artifacts.

**Tool selection follows a pragmatic decision tree, not a blanket preference.** Both built-in web tools (`web_search`, `web_fetch`) and Firecrawl CLI have strengths; the skill routes to the right tool based on research complexity and Firecrawl availability.

### Tool Selection Decision Tree

```
1. Is this a simple lookup or quick discovery query?
   → YES: Use built-in web_search / web_fetch (zero setup, full content per result)
   → NO: continue

2. Does the task need structured extraction, site mapping, crawling, or session management?
   → YES: Use Firecrawl CLI (if available)
   → NO: Use built-in web tools

3. Is Firecrawl CLI installed and authenticated? (run `firecrawl --status`)
   → YES: Use Firecrawl CLI for advanced features
   → NO: Fall back to built-in web tools; note the limitation in the synthesis

4. Need reproducible artifacts, multi-source archival, or dual-representation documentation?
   → Always use Firecrawl CLI when available; otherwise document the gap.
```

**Key principle:** The best tool is the one that's available and sufficient for the task. Never block research waiting for Firecrawl setup when built-in tools can answer the question.

### Hybrid Two-Phase Research Pattern

For multi-source research where both breadth and depth matter, compose the tools in two phases:

**Phase 1 — Discovery (built-in web tools):**
1. Use `web_search` with the research query to discover relevant URLs.
2. Review result titles and snippets to identify the 2–5 most promising sources.
3. Use `web_fetch` on the **most promising 1–2 URLs only** for immediate deep-reads. Do not fetch all results — selectivity reduces context noise and improves synthesis quality.
4. If the answers are sufficient, deliver the synthesis — no Firecrawl needed.

**Phase 2 — Deep extraction (Firecrawl CLI, when available):**
5. For the best URLs from Phase 1 that need structured extraction, clean markdown, or archival:
   ```bash
   firecrawl scrape "<url>" --only-main-content --format markdown
   ```
6. For multi-page sites discovered in Phase 1, map the structure:
   ```bash
   firecrawl map "<site-root>" --search "<topic>"
   ```
7. Save all Phase 2 outputs to the `.researches/<timestamp>/` session folder.

**When to skip Phase 2:**
- Phase 1 provided sufficient answers.
- Firecrawl is not installed or authenticated.
- The research doesn't need reproducible artifacts or dual-representation archival.

**When Phase 2 is essential:**
- Research needs structured JSON extraction (`firecrawl agent --schema`).
- Research needs site-wide mapping or crawling.
- Research needs reproducible, timestamped artifacts for audit or handoff.

This pattern leverages the zero-setup, always-available advantage of built-in tools for discovery, while reserving Firecrawl's credit budget and advanced capabilities for the deep-extraction tasks where they uniquely excel.

#### Search-Then-Selective-Fetch (Key Efficiency Pattern)

`web_search` returns 5 results with full page content per result — potentially thousands of tokens of text. Processing all results in full wastes context and introduces noise from irrelevant pages.

**Efficient workflow:**

1. **Scan, don't read.** When `web_search` returns results, read only the titles, URLs, and snippet text in the response. Do not dump full content into context.
2. **Select the 1–2 most relevant results.** Based on title relevance, domain authority, and snippet quality, pick the URLs most likely to answer the question.
3. **Deep-read selectively.** Use `web_fetch` on only those 1–2 URLs. If the first result answers the question, stop — no need to fetch more.
4. **Save the discovery results.** Use `save-web-research.ts` to persist the full search results for reproducibility, even if you only deep-read a subset.

**Anti-pattern:**
```text
❌ web_search → read all 5 full results → try to synthesize from 5 noisy pages
✅ web_search → scan titles + snippets → select 1-2 best → web_fetch → synthesize
```

**When to fetch more:** If the top 2 results don't answer the question, expand to results 3–5. If none do, refine the search query or move to Firecrawl Phase 2. If results answer the broad question but reveal a more specific question, chain follow-up searches (see **Research Methodology → Research Chaining**). See **Research Methodology → Research Sufficiency** for stopping criteria by query type.

For a direct command lookup, see [Quick Commands](#quick-commands) below.

## Relationship to firecrawl

`research-online/SKILL.md` is the workflow and archival layer; `firecrawl` is the low-level CLI primer.

- Use `research-online/SKILL.md` when the task is to run an end-to-end research session: initialize a timestamped `.researches/<timestamp>/` directory, collect multi-source evidence, consolidate findings, and publish a reproducible artifact set.
- Use `firecrawl` when the task is to look up exact Firecrawl CLI command syntax, flag semantics, install/auth steps, or version-specific behavior in isolation.

A research session typically loads `firecrawl` on-demand for command-level detail (see `Non-Negotiable Policy` item 8 and `REFINE_FIRECRAWL_WORKFLOW` in the routing options).

## When to Use This Skill

**TRIGGER when:**

- User asks for current web information, multi-source discovery, or site mapping.
- Task requires structured extraction from web pages or autonomous research.
- Research involves comparing documentation across multiple sites.
- Need to verify a claim against live web sources.
- Working with GitHub repository documentation that needs faithful archival.

**SKIP when:**

- The question can be answered from the local codebase or committed documentation.
- The user explicitly asks for opinion or creative writing without factual grounding.
- A sibling expert skill (e.g., `firecrawl`) already covers the specific tool surface.

## Common Misconceptions

| # | Misconception | Correction | Key concept |
|---|---------------|------------|-------------|
| 1 | Firecrawl should always be tried before built-in web tools | Use the right tool for the task: built-in for quick discovery, Firecrawl for advanced research. Never block research waiting for Firecrawl setup. | Pragmatic tool selection |
| 2 | One documentation format is enough | Keep both markdown and HTML for documentation targets | Dual-representation contract |
| 3 | `firecrawl browser` shorthand is reliable | It is version-dependent and brittle; prefer explicit commands | Browser fallback fragility |
| 4 | GitHub blob-page markdown is clean source text | It includes GitHub chrome; use `raw.githubusercontent.com` or local clone | Hybrid archival pattern |
| 5 | Research sessions do not need to be published | Publish completed sessions by default unless the user says otherwise | Scoped artifact publish |
| 6 | Built-in web tools are inferior to Firecrawl | Built-in tools return full page content in one call, require zero setup, and are always available. They beat Firecrawl for simple queries. | Tool complementarity |
| 7 | All `web_search` results should be read in full | Scan titles and snippets first, then `web_fetch` only the 1-2 most relevant URLs. Reading all results in full wastes context and introduces noise. Use `save-web-research.ts` to persist all results for reproducibility. | Selective fetch |
| 8 | Search query quality doesn't matter — the tool returns the best results anyway | Query formulation is the single highest-leverage research skill. A specific, disambiguated query returns far more relevant results than a vague one. Reformulate before fetching more. | Query formulation |
| 9 | Any source that matches the topic is equally good | Source evaluation separates authoritative answers from noise. Prioritize official docs, GitHub repos, and version-qualified sources over forums and SEO blogs. | Source evaluation |
| 10 | If search fails, try a different search tool | If `web_search` returns poor results, `firecrawl search` with the same query will also return poor results. Reformulate the query first, then consider switching tools. | Query reformulation |
| 11 | More searches always produce better results | After 2-3 failed reformulations, continuing to search wastes context and credits. Follow the Research Dead End Protocol: classify the failure, switch strategies, document the gap. | Dead end protocol |
| 12 | More sources always produce better syntheses | 2 independent sources that agree is sufficient for most questions. 3+ sources confirming the same answer is confirmation, not improvement. Stop when you have convergent evidence, an official source, or a version-qualified answer. See Research Methodology → Research Sufficiency. | Research sufficiency |
| 13 | Research should start with a search | Research should start with a plan. Without a one-sentence research question, knowledge of what you already know, and a stopping rule, searches are unfocused and results are noisy. See Research Planning. | Research planning |
| 14 | One search is always enough | Complex questions often require chained follow-up searches where initial results reveal a more specific question ("How does X work?" → "How does X handle Y?"). Carry forward version numbers and key terms from initial results into follow-up queries. See Research Methodology → Research Chaining. | Research chaining |

## Quick Commands

**Hybrid discovery pattern (recommended for most research):**

1. Discover with `web_search`, then deep-read with `web_fetch` or Firecrawl:

```
web_search: "What changed in Next.js 15?"
→ scan titles + snippets (don't read all results in full)
→ select 1-2 most relevant URLs
web_fetch: top URL for deep content
→ if structured extraction or archival is needed:
   firecrawl scrape "<url>" --only-main-content --format markdown
```

Initialize a research session:

```bash
npm run research:session:init -- --query "What changed in Next.js 15?"
```

Search first, then deep-dive:

```bash
export FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"
firecrawl search "site:nextjs.org Next.js 15" --scrape --limit 10 --json \
  -o "$FIRECRAWL_OUTPUT_DIR/search.json"
```

Scrape documentation in both markdown and HTML:

```bash
firecrawl scrape "https://docs.nextjs.org/14" --format markdown \
  -o ".researches/<timestamp>/documentation/markdown/nextjs-14.md"
firecrawl scrape "https://docs.nextjs.org/14" --format html \
  -o ".researches/<timestamp>/documentation/html/nextjs-14.html"
```

Consolidate with session auto-discovery (recommended — picks up firecrawl, web-search, web-fetch, and web-research dirs automatically):

```bash
npx tsx skills/research-online/scripts/consolidate-research.ts \
  --session-dir .researches/<timestamp> \
  --query "What changed in Next.js 15?" \
  --format thematic

# Content cleaning is enabled by default during consolidation.
# Use --no-clean to disable it when raw content is needed:
npx tsx skills/research-online/scripts/consolidate-research.ts \
  --session-dir .researches/<timestamp> \
  --query "What changed in Next.js 15?" \
  --format thematic \
  --no-clean

# Or consolidate the latest session automatically:
npx tsx skills/research-online/scripts/consolidate-research.ts \
  --auto-session \
  --query "What changed in Next.js 15?" \
  --format thematic
```

Consolidate from specific directories (legacy, Firecrawl-only):

```bash
npx tsx skills/research-online/scripts/consolidate-research.ts \
  --input-dir .researches/<timestamp>/firecrawl/reports \
  --query "What changed in Next.js 15?" \
  --format thematic
```

Save built-in web tool results into a session:

```bash
# Save web_search results
npx tsx skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source search \
  --content '{"results": [...]}'

# Save web_fetch content (content cleaning enabled by default for fetch sources)
npx tsx skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source fetch \
  --content "$(cat page.md)" \
  --url "https://orm.drizzle.team/docs/connect-overview"

# Save web_fetch content with raw content preserved (--no-clean)
npx tsx skills/research-online/scripts/save-web-research.ts \
  --query "Drizzle ORM connection pooling" \
  --source fetch \
  --content "$(cat page.md)" \
  --url "https://orm.drizzle.team/docs/connect-overview" \
  --no-clean
```

For the full command surface, see `references/tool-selection.md`.

## Command Decision Guide

| Scenario | Best tool | Reasoning |
|----------|-----------|----------|
| Quick fact lookup or discovery | `web_search` | Zero setup, full content, fast |
| Known URL to read | `web_fetch` | Clean extraction, no credits |
| Do not know exact URLs, need targeted search | `web_search` then `web_fetch` for deeper reads | Full content in one call |
| Need site structure | `firecrawl map` | No built-in equivalent |
| Deep-dive a docs section | `firecrawl crawl` with `--limit` and `--max-depth` | Structured crawl with depth control |
| Extract structured fields | `firecrawl agent --schema` | JSON schema extraction |
| Complex autonomous exploration | `firecrawl agent --wait` | Multi-step web navigation |
| JS-heavy or interactive page | `firecrawl browser` | Headless browser rendering |
| Multi-source archival for repo docs | `archive-github-repo-docs.ts` | Hybrid markdown + HTML capture |
| Reproducible research session | Firecrawl CLI + `.researches/` | Session management, consolidation |
| Need current facts, Firecrawl unavailable | `web_search` | Always-available fallback |

**Rule of thumb:** Use the simplest tool that suffices. `web_search`/`web_fetch` for quick discovery; `firecrawl` for advanced research requiring crawling, mapping, or structured extraction.

## Quick Decision Guide

| Scenario | Recommended path | Trade-off |
|----------|------------------|----------|
| Need current facts from web | `web_search` first; `firecrawl search` if Firecrawl is available and you need targeted results | `web_search` is zero-setup; `firecrawl` is more targeted but requires install |
| Deep docs extraction | `web_fetch` for single pages; `firecrawl map` then `firecrawl scrape` for multi-page sites | Built-in for speed; Firecrawl for reproducibility |
| Structured data from known pages | `firecrawl agent --schema` | Requires Firecrawl; best for JSON extraction |
| JS-heavy or interactive page | `firecrawl browser` | Slowest; only when other modes fail |
| GitHub repo docs | `archive-github-repo-docs.ts` | Avoids blob-page markdown noise |
| Quick question, no session needed | `web_search` | Fastest path to an answer |
| Systematic multi-source research | Firecrawl CLI + `.researches/` session | Reproducibility, consolidation, archival |
| Compose discovery + deep extraction | Phase 1: `web_search` for URL discovery → Phase 2: `firecrawl scrape` for clean extraction | Best of both: zero-setup discovery, targeted deep extraction |

## Research Methodology

Research quality depends on three factors beyond tool selection: **query formulation**, **source evaluation**, and **synthesis discipline**. This section provides concrete heuristics for each.

### Query Formulation

The quality of search results depends directly on query construction. Follow these principles:

**For the full quick-reference card with reformulation techniques, domain-specific patterns, and anti-pattern examples, load `references/query-formulation.md`.**

1. **Start specific, broaden if needed.** Frame the query around the exact technical concept, API, or error message. If results are sparse, generalize one term at a time.

   ```text
   ❌ "how to use drizzle"          → too broad, returns marketing pages
   ❌ "drizzle orm"                → returns overview, not specifics
   ✅ "drizzle ORM connection pooling postgres"  → targets the exact topic
   ✅ "drizzle pgPool2 connection config"          → uses the specific API name
   ```

2. **Include context keywords that disambiguate.** "Auth" could mean many things; "Better Auth Next.js session cookie" disambiguates.

   ```text
   ❌ "authentication setup"
   ✅ "Better Auth Next.js App Router session configuration"
   ```

3. **Use version and year for time-sensitive topics.** Frameworks and APIs change; version-qualified queries surface current answers.

   ```text
   ❌ "Next.js App Router changes"
   ✅ "Next.js 15 App Router changes 2025"
   ```

4. **Quote exact error messages.** When debugging, use the exact error string (or its most unique fragment) as the query.

5. **Include the technology name.** Generic terms like "connection pooling" return irrelevant results; "pg-pool connection pooling Node.js" narrows the domain.

6. **Avoid question words.** Queries starting with "how to", "what is", or "why does" dilute the search signal. Lead with the technical noun phrase.

7. **Iterate: reformulate, don't just fetch more.** If the first query returns low-quality results, reformulate with different terminology before fetching additional pages.

### Source Evaluation

Not all results are equal. Apply these heuristics when scanning `web_search` results or selecting URLs for `web_fetch`:

**For the full quick-reference card with domain authority cheat sheet, red flags, and reformulation guidance, load `references/source-evaluation.md`.**

| Signal | Strong source | Weak source |
|--------|--------------|-------------|
| **Domain** | Official docs, GitHub repos, `.dev` sites | Forums, SEO-heavy blogs, content mills |
| **Recency** | Dated within last 12 months, or version-qualified | Undated, no version reference |
| **Depth** | Code examples, API signatures, migration guides | High-level overviews, marketing copy |
| **Authority** | First-party (author = maintainer or official team) | Third-party tutorials with no official reference |
| **Canonical** | References to RFCs, specs, or official changelogs | Paraphrased summaries without source links |

**Prioritization rule:** If a result matches 3+ strong signals, deep-read it first. If no result matches 2+ strong signals, reformulate the query.

### Synthesis Quality

A research synthesis should be a **structured answer**, not a concatenation of snippets:

1. **Lead with the direct answer.** State the finding in the first sentence, then support it with evidence.
2. **Attribute every claim.** Include the source URL and date for each factual statement.
3. **Call out conflicts.** If two sources disagree, note both and resolve using the Conflict Resolution priority (Official > Community, Recent > Outdated, Primary > Secondary, Consensus > Outlier, Verifiable > Unverifiable).
4. **Mark gaps explicitly.** If no source answered the question fully, say so — don't extrapolate.
5. **Distinguish facts from opinions.** If the only available evidence is a forum post or blog opinion, label it as such.
6. **Provide version context.** When research covers a fast-moving library or API, note which version the findings apply to.

### Conflict Resolution

When two or more sources disagree, resolve using this priority:

1. **Official documentation > Community content.** If official docs say X and a Stack Overflow answer says Y, prefer official docs — unless the official docs are outdated (check the publish date).
2. **Recent > Outdated.** If a 2025 article contradicts a 2023 article for a fast-moving library, prefer the 2025 article. Always note the version or date.
3. **Primary > Secondary.** If the original source (RFC, spec, first-party docs) says X and a third-party tutorial says Y, prefer the primary source.
4. **Consensus > Outlier.** If 4 sources say X and 1 says Y, note the outlier but follow the consensus — unless the outlier is an official source.
5. **Verifiable > Unverifiable.** If one source provides code examples, reproducible steps, or links to primary sources, and another makes unsupported claims, prefer the verifiable source.

If after applying these rules the conflict remains unresolved, present both positions in the Conflicting Evidence section of the synthesis and explain why neither can be definitively preferred.

### Iterative Refinement Pattern

When the initial query does not return useful results:

```text
Step 1: Classify the failure
  - No results → query too specific or uses uncommon terminology
  - Irrelevant results → query too broad or ambiguous
  - Outdated results → add version/year qualifiers
  - Low-authority results → add technology name or scope qualifier

Step 2: Reformulate using one tactic at a time
  - Generalize: remove the most specific term
  - Rephrase: swap in synonyms or alternate terminology
  - Scope: add technology/framework name as context
  - Version: add year or version number
  - Error-quote: use exact error message

Step 3: Stop after 2-3 reformulations
  - If still unsuccessful, note the gap in the synthesis
  - Consider whether the information exists online at all
  - Suggest alternative research angles if appropriate
```

### Research Chaining

When an initial search succeeds but reveals a more specific question, chain follow-up searches rather than starting from scratch:

1. **Extract the specific question.** The initial results answered the broad question but revealed a narrower, deeper question ("How does X work?" → "How does X handle Y specifically?"). Write the follow-up as a new one-sentence research question.
2. **Carry forward what you already know.** Include version numbers, framework names, and key terms from the initial results in the follow-up query. This makes follow-up queries more specific and more likely to return relevant results.
3. **Apply a tighter sufficiency rule.** You're now in the second or third search. One authoritative source that directly answers the follow-up question is sufficient \u2014 you don't need to rediscover the broad context.

```text
Chain example:
  Search 1: "Next.js App Router" → reveals Server Components are the key concept
  Search 2: "Next.js 15 Server Components data fetching" → reveals caching behavior
  Search 3: "Next.js fetch cache revalidation" → targeted answer found, stop
```

**When to chain vs. when to stop:** Chain when the initial answer is incomplete or reveals a dependency you didn't anticipate. Stop when you have a direct, version-qualified answer to your original question.

**Avoid over-chaining:** If you've chained 3+ times without converging on a direct answer, the original question may be too broad or the information may not exist online. Follow the Dead End Protocol instead of chaining further.

### Research Dead End Protocol

When 2-3 query reformulations still return poor results, follow this protocol instead of continuing to search:

1. **Classify the dead end:**
   - **Topic too niche:** The information may not be publicly documented. Switch to first-party sources (official docs, GitHub repos, RFCs).
   - **Topic too new:** The information may not have been published yet. Search for pre-release docs, GitHub issues, or discussion forums.
   - **Topic too ambiguous:** Broaden the question and research the domain, then narrow back to the specific question.
   - **Language barrier:** The information may only be available in a different language. Try `web_search` with translated keywords.

2. **Switch strategies, not tools:**
   - If `web_search` returns poor results, don't switch to `firecrawl search` with the same query — **the query is the problem, not the tool.**
   - Try **site-qualified search** first: `site:docs.example.com <topic>` targets official docs directly.
   - Try **version-qualified search**: `"<library> <version>" <feature>` targets release-specific information.
   - Try **error-quote search**: Paste the exact error message or its most unique fragment.

3. **Document the dead end in the synthesis:**
   - State what was searched and what failed.
   - Note the queries that returned poor results.
   - Mark the gap explicitly: "No authoritative source found for [topic]."
   - Suggest follow-up actions: "Check official docs directly at [URL]" or "Ask the maintainer via GitHub issues."

4. **Escalate rather than extrapolate:**
   - Never fabricate an answer from weak evidence.
   - If partial information exists, present it with appropriate confidence qualifiers.
   - If no information exists, say so. An honest "I don't know" is better than a confident wrong answer.


### Research Sufficiency

Knowing when to stop researching is as important as knowing how to research. Over-research wastes context and credits; under-research yields unreliable syntheses.

**Stop when you have:**

1. **Convergent evidence.** 2+ independent sources agree on the same answer. One source is a hint; two is a signal; three is confirmation.
2. **An official source.** If official documentation directly answers the question, stop. No need for secondary confirmation unless the official docs are outdated.
3. **A version-qualified answer.** If the answer includes a version number and date (e.g., "Next.js 15, 2025"), the evidence is time-stamped and unlikely to be contradicted by newer search results.
4. **Coverage of all sub-questions.** If the original research question has 3 aspects and you've answered all 3, stop — even if you could find more sources for aspect 1.

**Keep researching when:**

- Sources contradict each other (follow Conflict Resolution).
- The only sources are forums, blog posts, or AI-generated content (find official or primary sources).
- The answer is version-dependent and no version is cited (add version qualifiers to queries).
- You've only found indirect evidence (no source directly answers the question).

**Practical stopping rules by query type:**

| Query type | Stop after | Never stop before |
|-----------|-----------|-------------------|
| Simple fact lookup | 1 authoritative source confirms | 1 source confirms |
| Version-qualified question | 1 official source with version | Version is cited |
| How-to / configuration | 1 official doc + 1 working example | Both doc and example match the stated version |
| Comparison / tradeoff | 2+ sources with different perspectives | All perspectives are represented |
| Error diagnosis | 1 confirmed fix (verified by version) | Fix is version-matched |

## Non-Negotiable Policy

1. **Choose the right tool for the task.** Use built-in `web_search`/`web_fetch` for quick discovery and simple queries. Use Firecrawl CLI for site mapping, crawling, structured extraction, and reproducible sessions. Never block research waiting for Firecrawl when built-in tools can answer the question.
2. **If Firecrawl is needed, verify CLI readiness** with `firecrawl --status` before starting. If it fails, fall back to built-in web tools immediately — do not attempt to install or authenticate Firecrawl mid-research.
3. Use `references/tool-selection.md` to locate the right Firecrawl command before broad reading; never reconstruct CLI flags or setup steps from memory.
4. Start with the least expensive workflow (`web_search` for discovery, `firecrawl search`/`scrape` before `agent`/`browser`).
5. Load only the subset of `references/` the task requires. Do not read every file by default.
6. Save research sessions under `.researches/<timestamp>/`; keep both markdown and HTML representations for documentation targets.
7. Keep source attribution in every synthesis and consolidate with `scripts/consolidate-research.ts` before publishing.
8. For any answer about Firecrawl CLI pricing, models, or current version: treat bundled data as likely stale and verify with `firecrawl --help` or `firecrawl` before stating specifics with high confidence.
9. **When using built-in web tools for a Firecrawl-class task** (crawling, structured extraction, session archival), note the limitation in your synthesis and suggest a follow-up with Firecrawl when available.

## Workflow

0. **Plan before searching.** Answer the 3 Research Planning questions: (1) What's your one-sentence research question? (2) What do you already know? (3) Which Research Sufficiency stopping rule applies? Do not skip to step 1 without a clear question.

1. **Classify the research complexity.**
   - **Simple** (quick lookup, single fact, comparison): Use `web_search` / `web_fetch` directly. Skip to step 7.
   - **Advanced** (multi-source, structured extraction, site mapping, reproducible archival): Continue to step 2.
2. **Verify Firecrawl availability** with `firecrawl --status`.
   - If **available**: proceed with Firecrawl CLI.
   - If **not available**: fall back to `web_search`/`web_fetch`. Note the limitation in your synthesis.
3. Initialize the research session:

   ```bash
   npm run research:session:init -- --query "<research question>"
   ```

4. Classify the task and load the minimum useful references (see table below).
5. Collect data with the chosen tool targeting the active session folder.
   - **Formulate queries carefully** (see Research Methodology > Query Formulation). Start specific, broaden only if needed, and reformulate rather than fetch more on poor results.
   - **Evaluate sources** before deep-reading (see Research Methodology > Source Evaluation). Prioritize results matching 3+ strong signals (official docs, recent, code examples, authoritative, canonical).
   - **Firecrawl**: Set `FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"`.
   - **Built-in web tools**: Capture results into `.researches/<timestamp>/documentation/markdown/` and `html/`.
   - For documentation pages, keep both markdown and HTML representations.
   - For GitHub repository files, use `scripts/archive-github-repo-docs.ts` (see `references/github-repository-doc-archival.md`).
6. If command details are unclear, consult `firecrawl` before expanding scope.
7. Parallelize independent sources with harness workers when context or fan-out is high (see `references/harness-patterns.md`).
8. Consolidate findings with `scripts/consolidate-research.ts`.
   - Content cleaning is on by default; use `--no-clean` to preserve raw content.
   - Use `--auto-session` for automatic session discovery.
   - Check the cleaning stats in the consolidated output to verify chrome was removed.
9. Return concise synthesis with explicit gaps and confidence notes.
   - Apply synthesis discipline (see Research Methodology > Synthesis Quality): lead with the direct answer, attribute every claim, call out conflicts, mark gaps, distinguish facts from opinions, and provide version context.
   - Verify against the Research Quality Checklist (see Completion Output Contract > Research Quality Checklist) before delivering.
   - If 2–3 query reformulations failed, follow the Research Dead End Protocol (see Research Methodology > Research Dead End Protocol) instead of continuing to search.

### Reference Loading by Task Type

For diagnostic requests, run `firecrawl --status` before loading any reference files. Load only the subset the task needs.

| Task type | Load these files | Skip |
|-----------|-----------------|------|
| Choose Firecrawl command | `tool-selection.md` | `consolidation-patterns.md` |
| Parallelize research across sources | `harness-patterns.md` | `github-repository-doc-archival.md` |
| Archive GitHub repository docs | `github-repository-doc-archival.md` | `harness-patterns.md` |
| Consolidate subagent results | `consolidation-patterns.md` | `tool-selection.md` |
| Evaluate source credibility | `source-evaluation.md` | `consolidation-patterns.md` |
| Formulate effective queries | `query-formulation.md` + `source-evaluation.md` | `github-repository-doc-archival.md` |
| Improve poor search results | `query-formulation.md` (reformulation techniques) | `source-evaluation.md` |
| Diagnostic / inspection-first | Run `firecrawl --status` | All reference files |
| Quick research (built-in tools only) | `tool-selection.md` (decision tree section) | `harness-patterns.md`, `github-repository-doc-archival.md` |
| Save and consolidate artifacts | `consolidation-patterns.md` (session discovery) | `source-evaluation.md` |

## Completion Output Contract

### Synthesis Format

Deliver research results using this structure:

```markdown
## [Topic]

**Answer:** [Direct answer to the research question — 1–3 sentences]

### Key Findings
1. [Finding 1 with attribution — `source URL (date)`]
2. [Finding 2 with attribution]

### Conflicting Evidence
- [Conflict: Source A says X, Source B says Y. Resolved: prefer A because (official docs > community / recent > outdated / primary > secondary)]

### Gaps
- [Explicitly state what could not be determined]

### Sources
- [Source 1: URL — version/date — signal score]
- [Source 2: URL — version/date — signal score]
```

Omit sections with no content (e.g., no conflicting evidence → omit that section).

After a research session is complete, include `Next steps:` followed by options in this format:

- `ACTION_NAME_IN_SCREAMING_SNAKE_CASE`: Description of what will be done if chosen.

Required base option:

- `CREATE_RESEARCH_DERIVED_EXPERT_SKILL`: Create a reusable expert skill from this research topic using the exact `.researches/<timestamp>/` payload (`consolidated.md`, `consolidated.json`, `firecrawl/raw`, `firecrawl/reports`, and `metadata.json`).

Cross-skill routing options (generate dynamically based on surfaced signals):

- `PREPARE_IMPLEMENTATION_PLAN`: Route to `plan/SKILL.md` when findings are implementation-ready.
- `DEEPEN_RESEARCH_WITH_ONLINE_STUDY`: Route to `study/SKILL.md` when material unknowns remain.
- `RESOLVE_COMPETING_APPROACHES`: Route to `decisions/SKILL.md` when tradeoffs are unresolved.
- `SYNC_GUIDANCE_DOCUMENTATION`: Route to the `documentation-sync` workflow when policy or docs must be updated.
- `REFINE_FIRECRAWL_WORKFLOW`: Route to `firecrawl` when CLI gaps or retrieval misses are found.
- `VALIDATE_RESEARCH_CLAIMS_IN_UI`: Route to the `playwright-cli` workflow when findings have user-facing behavior implications.
- `TARGET_PRIMARY_DOC_RESEARCH`: Continue with `research-online/SKILL.md` using a tighter scope when source conflict or low confidence remains.

### Research Quality Checklist

Before finalizing any research synthesis, verify every item:

| # | Check | Why it matters |
|---|-------|---------------|
| 1 | **Direct answer first** — does the synthesis lead with the finding, not the source? | Readers should see the answer before the evidence |
| 2 | **Every claim attributed** — is each factual statement paired with its source URL and date? | Unattributed claims are unverifiable and potentially wrong |
| 3 | **Conflicts resolved** — if two sources disagree, are both noted with a resolution using the conflict priority (Official > Community, Recent > Outdated, Primary > Secondary, Consensus > Outlier, Verifiable > Unverifiable)? | Ignoring conflicts creates false confidence |
| 4 | **Gaps marked explicitly** — are unanswered questions labeled as gaps, not extrapolated? | Gaps are more honest than fabricated answers |
| 5 | **Facts vs. opinions distinguished** — are forum posts and blog opinions labeled as such? | Not all sources carry equal weight |
| 6 | **Version context provided** — are version numbers and dates included for fast-moving libraries? | Answers without versions expire quickly |
| 7 | **Sources evaluated** — do the cited sources score 3+ on the 5-signal heuristic? | Low-quality sources undermine the entire synthesis |
| 8 | **Queries were reformulated** — if initial results were poor, were queries improved before fetching more? | Bad queries produce bad research, regardless of tool choice |
| 9 | **Content cleaned** — was navigation chrome stripped from fetched pages (default in save-web-research and consolidate)? | Noisy content degrades synthesis quality |
| 10 | **Artifacts saved** — are all results persisted in `.researches/<timestamp>/` for reproducibility? | Unsaved results cannot be verified or re-analyzed |

## Session Storage

Use a timestamped session folder under `.researches/`:

```text
.researches/
└── 2026-02-11T134626Z/
    ├── documentation/
    │   ├── html/
    │   ├── markdown/
    │   └── screenshots/
    │       └── full-page/
    ├── firecrawl/
    │   ├── raw/
    │   └── reports/
    ├── web-search/          ← web_search result artifacts (JSON)
    ├── web-fetch/           ← web_fetch result artifacts (markdown, HTML)
    ├── web-research/        ← hybrid search+fetch artifacts
    ├── metadata.json
    ├── subagent-reports/
    ├── consolidated.md
    └── consolidated.json
```

Keep `.researches/.gitkeep` committed and publish completed generated session folders.

## Common Pitfalls

1. **Blocking research waiting for Firecrawl setup.** If Firecrawl is not installed, use built-in web tools immediately. Don't stop research to install and authenticate a CLI.
2. **Using Firecrawl for simple lookups.** `web_search` returns full page content in one call with zero setup — use it for quick facts and discovery.
3. **Keeping only markdown documentation without HTML backup.** Documentation targets require both representations for source fidelity.
4. **Trusting GitHub blob-page scrape as canonical source text.** Blob-page markdown includes GitHub chrome; use `raw.githubusercontent.com` or a local clone for canonical text.
5. **Forgetting to set `FIRECRAWL_OUTPUT_DIR` before batch commands.** Set it once per session to keep outputs organized.
6. **Using `firecrawl agent` for simple searches.** `search` and `scrape` are cheaper and faster for known targets.
7. **Not scoping crawls with `--limit` and `--max-depth`.** Unbounded crawls are expensive and may hit rate limits.
8. **Assuming built-in web tools are always inferior.** They are the right choice for quick discovery, single-page reads, and when Firecrawl is unavailable.
9. **Using vague or overly broad search queries.** "How to use X" returns marketing pages; "X v2 API configuration" returns targeted docs. Query formulation is the highest-leverage research skill.
10. **Treating all sources as equally credible.** Official docs and GitHub repos outweigh random blog posts. Evaluate source strength before deep-reading.
11. **Continuing to search after 2-3 failed reformulations.** If multiple reformulations return poor results, classify the dead end (too niche, too new, too ambiguous, language barrier) and either switch strategy or document the gap. Never waste credits or context on a failing approach.
12. **Switching tools instead of reformulating queries.** If web_search returns poor results, firecrawl search with the same query will also return poor results. The query is the problem, not the tool — reformulate first, switch tools second.
13. **Over-researching after finding convergent evidence.** 2 independent sources that agree is sufficient for most questions. Continuing to search for 5+ sources on the same point wastes context and credits. See Research Methodology → Research Sufficiency for stopping criteria.
14. **Skipping research planning and starting with a search.** Without a one-sentence research question, knowledge of what you already know, and a stopping rule, your first search is likely too broad. See Research Planning for the 3-question pre-search checklist.
15. **Restarting from scratch on follow-up searches.** When initial results reveal a more specific question, chain the follow-up search carrying forward version numbers and key terms — don't discard what you already know. See Research Methodology → Research Chaining.

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|---------------------|
| `firecrawl --status` fails or command not found | Firecrawl CLI is not installed. **Fall back to built-in web tools immediately.** Do not block research for setup. |
| `firecrawl scrape` markdown includes UI noise | Add `--only-main-content`. For GitHub repos, switch to raw URLs or the archival helper. |
| `firecrawl browser` shorthand fails | Use explicit `firecrawl browser execute --node ...` instead of shorthand syntax. |
| Screenshot capture returns no URL | Confirm the installed CLI supports `--format screenshot`. Escalate to browser mode if needed. |
| Consolidation produces empty output | Verify the input directory contains `.json` or `.md` files and that `--query` is provided. |
| Session folder does not auto-publish | The output must be inside `.researches/` with a valid `metadata.json`. Use `--no-publish` to skip intentionally. |
| `web_search` or `web_fetch` returns no results | Try alternative query terms. For deep research, switch to Firecrawl `search --scrape` if available. |
| `web_search` returns irrelevant results | Reformulate the query: add technology name, version/year qualifiers, or use exact error messages. See Research Methodology > Query Formulation. |
| Need to evaluate source credibility | Prioritize official docs, GitHub repos, and version-qualified sources. See Research Methodology > Source Evaluation for the 5-signal heuristic. |
| Multiple reformulations return poor results | Classify the dead end (too niche, too new, too ambiguous) and follow the Research Dead End Protocol. Do not continue searching with the same strategy. |
| `web_search` and `firecrawl search` both return poor results | The query is the problem, not the tool. Reformulate with site-qualified, version-qualified, or error-quote searches before switching tools. |
| Need structured extraction but Firecrawl unavailable | Use `web_fetch` to get page content, then parse manually. Note the gap in the synthesis. |

## Reliability and Cost Guardrails

1. **Start with the simplest tool that answers the question.** `web_search` for quick facts; `firecrawl search` for targeted discovery.
2. Use `--max-age` for cache hits during iterative debugging.
3. Scope crawls aggressively (`--limit`, `--include-paths`, `--exclude-paths`).
4. Use `firecrawl agent --schema` only when structured output is required.
5. Treat `firecrawl agent` as a last resort and include timeout fallback logic.
6. When using built-in web tools, save results to `.researches/<timestamp>/` for reproducibility.
7. If Firecrawl is needed but unavailable, note the limitation and suggest follow-up with Firecrawl when available.
8. **Formulate queries before launching searches.** Specific, disambiguated queries return better results than vague ones. Reformulate rather than fetching more pages on poor results.
9. **Evaluate sources before deep-reading.** Prioritize official docs, GitHub repos, and recent version-qualified sources. Ignore forums and SEO blogs unless no better source exists.
10. **Stop searching after 2-3 failed reformulations.** Follow the Research Dead End Protocol: classify the failure, switch strategy (site-qualified search, error-quote, version-qualified), document the gap, and escalate rather than extrapolate. Never continue a failing approach.
11. **Reformulate queries before switching tools.** If `web_search` returns poor results, `firecrawl search` with the same query will also return poor results. The query is the problem, not the tool.

## Script Inventory

| Script | Purpose | Key flags |
|--------|---------|-----------|
| `scripts/init-research-session.ts` | Bootstrap a timestamped research session directory | `--query`, `--metadata` |
| `scripts/save-research.ts` | Import Firecrawl artifacts into a session | `--query`, `--results`, `--results-dir`, `--session-dir`, `--list` |
| `scripts/save-web-research.ts` | Import web_search/web_fetch results into a session; content cleaning enabled by default for fetch/hybrid (`--no-clean` disables) | `--query`, `--source`, `--results`, `--content`, `--url`, `--clean`, `--no-clean`, `--session-dir`, `--metadata` |
| `scripts/clean-web-content.ts` | Strip navigation chrome, cookie banners, footers, edit links, feedback prompts, copy buttons, pagination, inline TOCs, back-to-top links, sponsor sections, social prompts, newsletter CTAs from web content | `--content`, `--file`, `--output`, `--source`, `--no-cookie`, `--no-nav`, `--no-footer`, `--no-social`, `--no-newsletter`, `--no-edit-links`, `--no-feedback`, `--no-related`, `--no-copy-buttons`, `--no-pagination`, `--no-toc`, `--no-back-to-top`, `--no-sponsors`, `--no-whitespace` |
| `scripts/clean-web-content.test.ts` | Regression tests for content cleaning: 10 removal tests + 8 false-positive guards | Run: `npx tsx skills/research-online/scripts/clean-web-content.test.ts` |
| `scripts/consolidate-research.ts` | Deduplicate and merge reports into `consolidated.md` + `consolidated.json`. Content cleaning enabled by default; use `--no-clean` for raw output. Auto-discovers all artifact dirs with `--session-dir` or `--auto-session` | `--session-dir`, `--auto-session`, `--input-dir`, `--input-file`, `--query`, `--format`, `--no-clean`, `--no-dedupe`, `--no-publish`, `--output` |
| `scripts/finalize-research-session.ts` | Publish a completed session with a scoped commit/push | `--session-dir`, `--latest`, `--dry-run` |
| `scripts/archive-github-repo-docs.ts` | Archive GitHub repo docs with canonical markdown + HTML + optional screenshots | `--session-dir`, `--github-repo`, `--branch`, `--repo-dir`, `--screenshot-mode`, `--file`, `--files-from` |
| `scripts/research-session.ts` | Library: session directory layout builders and helpers | Imported by other scripts |

## Local Corpus Layout

The `references/` directory contains 6 hand-authored synthesis files. No subfolders. No vendored upstream documentation pages.

| File | Purpose |
|------|---------|
| `consolidation-patterns.md` | Six consolidation strategies for merging subagent findings, plus deduplication and validation checklists |
| `github-repository-doc-archival.md` | Hybrid archival pattern for GitHub repo docs: canonical markdown, rendered HTML, and optional screenshots |
| `harness-patterns.md` | Ten harness-worker patterns: 6 Firecrawl patterns for parallelizing research, 4 hybrid patterns combining web_search/web_fetch discovery with Firecrawl deep extraction, plus session directory reference |
| `query-formulation.md` | Query formulation quick-reference: reformulation techniques, domain-specific patterns, query anatomy, anti-patterns, and phase-specific guidance |
| `source-evaluation.md` | Source evaluation quick-reference: 5-signal heuristic, domain authority cheat sheet, version-qualified query patterns, recency signals, red flags, and reformulation guidance |
| `tool-selection.md` | Firecrawl CLI command decision tree, flag summary, and 7 reusable command patterns with cost guardrails |

## Guidance Alignment

- Apply repository guidance consistently with `AGENTS.md`.
- If this skill file is updated, run `npm run skills:sync` so IDEs pick up the new version immediately.
- Snapshot verified: 2026-04-30. Verify Firecrawl CLI behavior with `firecrawl --help` before relying on command syntax for newly released versions.

## Temporary Files

If this skill needs to create temporary files, place them under `.tmp/research-online/YYYY-MM-DD-{subject}`. The root `.tmp/` directory is already gitignored. Do not create top-level dotfile temp directories.
