---
name: research-online
description: when configuring web research — multi-source discovery, site mapping, structured extraction, autonomous research. Save under .researches/. MCP-compatible. Not for offline research.
---

# GG → Research Online → Web Research

> Verify release-sensitive answers against live sources before responding with high confidence.

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
- A sibling expert skill already covers a specific tool surface in isolation (for example Firecrawl CLI syntax). This skill still owns the research session.

## Quick Start

**Tool names in this skill:** `web_search` and `web_fetch` mean whatever search and page-fetch tools the current harness exposes (built-in, MCP, CLI, or otherwise). Names vary (`web_search`/`web_fetch`, `WebSearch`/`WebFetch`, `open_page`, browser fetch). Use what is available now. Do not require Firecrawl or any other named vendor.

**Before searching, answer the 3 planning questions** in Research Planning below: what you need, what you already know, and what would be enough. Then follow these 5 steps:

1. **Discover** — Host `web_search` with a specific, disambiguated query. Scan titles+snippets first; don't read all results. If results reveal a more specific question, chain follow-up searches (see Research Methodology → Research Chaining).
2. **Deep-read** — Host `web_fetch` only the 1–2 most relevant URLs. Content cleaning is on by default.
3. **Evaluate** — Score each source on the 5-signal heuristic (official docs > GitHub repos > forums/blogs). See `references/source-evaluation.md`.
4. **Synthesize** — Lead with findings, attribute every claim, resolve conflicts using the priority (official > community, recent > outdated, primary > secondary, consensus > outlier, verifiable > unverifiable), mark gaps explicitly. Verify against the Research Quality Checklist before delivering.
5. **Save** — `save-web-research.ts` for artifacts, `consolidate-research.ts --auto-session` for deduped summary. Content cleaning is on by default.

If results are poor after 2–3 reformulations, follow the **Research Dead End Protocol** (classify the failure, switch strategies not tools, document the gap, escalate rather than extrapolate).

See **Research Methodology > Research Sufficiency** for when you have enough evidence to stop researching.

Host search/fetch is the default path. Specialized backends (Firecrawl CLI map/crawl/schema/browser, or any equivalent already available) are optional when host fetch cannot do the job. See Hybrid Two-Phase Research Pattern below.

## Research Planning

Before the first search, clarify three things. Thirty seconds of planning prevents thirty minutes of unfocused querying.

1. **What you need.** Write a one-sentence research question. If you can't, the query is too broad — narrow it until you can.
2. **What you already know.** List facts you're confident about and the version or date you know them for. This prevents re-discovering what you already have.
3. **What would be enough.** Which Research Sufficiency stopping rule applies? (1 authoritative source? 2 convergent sources? A version-qualified answer?) Set your target before searching so you know when to stop.

If you cannot answer #1, follow the Research Dead End Protocol: reformulate, switch strategy, document the gap. Do not launch a vague search hoping something useful turns up.

## Overview

Use this skill to run online research and return source-backed answers with reproducible artifacts.

**Tool selection follows a pragmatic decision tree, not a vendor preference.** Use any host search and fetch that can run now. Specialized backends (Firecrawl CLI or equivalent) are optional extras, never a prerequisite.

### Tool Selection Decision Tree

```
1. Is a host web search or page-fetch tool available?
   → YES: Use it (default path). Continue only if the task still needs more.
   → NO: Stop and report that no web search/fetch is available. Do not wait for a specialized backend.

2. Does the task need site mapping, multi-page crawl, schema extraction, or JS browser automation that host fetch cannot do?
   → NO: Stay on host search/fetch. Save artifacts. Done.
   → YES: continue

3. Is a specialized backend (Firecrawl CLI or equivalent) already available?
   → YES: Use it for those advanced steps only.
   → NO: Complete with host tools; note the capability gap in the synthesis. Do not install or authenticate a backend mid-research.

4. Need reproducible artifacts?
   → Always save via save-web-research.ts / session scripts. Firecrawl output dirs are only for Firecrawl runs.
```

**Key principle:** The best tool is the one that's available and sufficient. Never block research waiting for Firecrawl (or any other backend) when host search/fetch can answer the question.

### Hybrid Two-Phase Research Pattern

**Phase 1 — Discovery.** Search with host tools, shortlist 2–5 sources, and deep-read the best 1–2. Save the full search results. Expand to results 3–5 if needed, then refine the query if they still miss. Read [selective fetch](references/harness-patterns.md#search-then-selective-fetch-key-efficiency-pattern) when search results include full page content.

**Phase 2 — Deep extraction.** Use an available specialized backend only if host tools cannot provide clean extraction, mapping, crawling, structured JSON, dual-representation archival, or interactive browser work. Save all outputs in the active session. Read [tool selection](references/tool-selection.md) when you need backend commands and examples.

For a direct command lookup, see [Quick Commands](#quick-commands) below.

## Relationship to specialized backends

`research-online/SKILL.md` is the workflow and archival layer. It does not depend on Firecrawl.

- Use this skill when the task is to run an end-to-end research session: initialize a timestamped `.researches/<timestamp>/` directory, collect multi-source evidence with **any** available search/fetch, consolidate findings, and publish a reproducible artifact set.
- If the backend is already available, consult its public CLI reference on demand for command syntax. For Firecrawl, use the [Firecrawl CLI reference](https://github.com/firecrawl/cli).
- Absence of Firecrawl is not a blocker. Host search/fetch is a complete default path.

## Quick Commands

Read [session commands](references/session-commands.md) when you need CLI examples or flags for initializing, saving, consolidating, or publishing.

For the full Firecrawl command surface, read [tool selection](references/tool-selection.md) when that backend is already available.

## Research Methodology

Research quality depends on three factors beyond tool selection: **query formulation**, **source evaluation**, and **synthesis discipline**. This section provides concrete heuristics for each.

### Query Formulation

The quality of search results depends directly on query construction. Follow these principles:

**For the full quick-reference card with reformulation techniques, domain-specific patterns, and anti-pattern examples, load `references/query-formulation.md`.**

1. **Start specific, broaden if needed.** Frame the query around the exact technical concept, API, or error message. If results are sparse, generalize one term at a time.
2. **Include context keywords that disambiguate.** "Auth" could mean many things; "Better Auth Next.js session cookie" disambiguates.
3. **Use version and year for time-sensitive topics.** Frameworks and APIs change; version-qualified queries surface current answers.
4. **Quote exact error messages.** When debugging, use the exact error string (or its most unique fragment) as the query.
5. **Include the technology name.** Generic terms like "connection pooling" return irrelevant results; "pg-pool connection pooling Node.js" narrows the domain.
6. **Avoid question words.** Queries starting with "how to", "what is", or "why does" dilute the search signal. Lead with the technical noun phrase.
7. **Iterate: reformulate, don't just fetch more.** If the first query returns low-quality results, reformulate with different terminology before fetching additional pages.

### Source Evaluation

Not all results are equal. Apply these heuristics when scanning `web_search` results or selecting URLs for `web_fetch`:

**For the full quick-reference card with domain authority cheat sheet, red flags, and reformulation guidance, load `references/source-evaluation.md`.**

Score domain, recency, depth, author authority, and links to canonical sources.

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

When initial results are poor, diagnose whether they are absent, irrelevant, outdated, or low-authority. Change one query term or qualifier at a time. Read [query formulation](references/query-formulation.md#iterative-refinement-pattern) when you need a reformulation tactic.

### Research Chaining

When an initial search succeeds but reveals a more specific question, chain follow-up searches rather than starting from scratch:

1. **Extract the specific question.** The initial results answered the broad question but revealed a narrower, deeper question ("How does X work?" → "How does X handle Y specifically?"). Write the follow-up as a new one-sentence research question.
2. **Carry forward what you already know.** Include version numbers, framework names, and key terms from the initial results in the follow-up query. This makes follow-up queries more specific and more likely to return relevant results.
3. **Apply a tighter sufficiency rule.** You're now in the second or third search. One authoritative source that directly answers the follow-up question is sufficient — you don't need to rediscover the broad context.

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
   - If host `web_search` returns poor results, don't switch to another search backend with the same query — **the query is the problem, not the tool.**
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

1. **Host search/fetch is the default.** Use whatever `web_search`/`web_fetch` (or equivalent) the harness exposes. Specialized backends (Firecrawl CLI or equivalent) are optional for mapping, crawl, schema, and browser work they uniquely cover.
2. **Never block on backend setup.** Do not run `firecrawl --status` as a pre-flight for ordinary research. If a specialized step is needed and the backend is missing, complete with host tools and note the gap — do not install or authenticate mid-research.
3. Use `references/tool-selection.md` only when a specialized backend is already available and you need command syntax; never reconstruct CLI flags from memory.
4. Start with the least expensive workflow (host search, then selective fetch, then specialized `search`/`scrape` before `agent`/`browser` if a backend is present).
5. Load only the subset of `references/` the task requires. Do not read every file by default.
6. Save research sessions under `.researches/<timestamp>/`; keep both markdown and HTML representations for documentation targets.
7. Keep source attribution in every synthesis and consolidate with `scripts/consolidate-research.ts` before publishing.
8. For any answer about a specialized backend's pricing, models, or current version: treat bundled data as likely stale and verify with that tool's `--help` before stating specifics with high confidence.
9. **When host tools cannot cover mapping, crawl, schema, or JS-browser work,** note the limitation in the synthesis. Do not treat host-only research as incomplete.

## Workflow

0. **Plan before searching.** Answer the 3 Research Planning questions: (1) What's your one-sentence research question? (2) What do you already know? (3) Which Research Sufficiency stopping rule applies? Do not skip to step 1 without a clear question.

1. **Classify the research complexity.**
   - **Simple** (quick lookup, single fact, comparison): Use host `web_search` / `web_fetch` directly. Skip to step 7.
   - **Advanced** (multi-source, structured extraction, site mapping, reproducible archival): Continue to step 2 using host tools first.
2. **Use host search/fetch.** Specialized backends are optional: use them only if host tools cannot cover mapping/crawl/schema/browser **and** the backend is already available. Never pre-flight `firecrawl --status` for ordinary research.
3. Initialize the research session:

   ```bash
   npx tsx .agents/skills/research-online/scripts/init-research-session.ts \
     --query "<research question>"
   ```

4. Classify the task and load the minimum useful references from the [reference index](#local-corpus-layout).
5. Collect data with the chosen tool targeting the active session folder.
   - **Formulate queries carefully** (see Research Methodology > Query Formulation). Start specific, broaden only if needed, and reformulate rather than fetch more on poor results.
   - **Evaluate sources** before deep-reading (see Research Methodology > Source Evaluation). Prioritize results matching 3+ strong signals (official docs, recent, code examples, authoritative, canonical).
   - **Host web tools**: Capture results into `.researches/<timestamp>/` via `save-web-research.ts` (`web-search/`, `web-fetch/`, `documentation/markdown/` and `html/`).
   - **Specialized backend (optional):** If Firecrawl CLI is used, set `FIRECRAWL_OUTPUT_DIR=".researches/<timestamp>/firecrawl/raw"`.
   - For documentation pages, keep both markdown and HTML representations.
   - For GitHub repository files, use `scripts/archive-github-repo-docs.ts` (see `references/github-repository-doc-archival.md`).
6. If specialized-backend command details are unclear, consult that sibling primer before expanding scope. Do not treat a missing primer as a research blocker.
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

Use the [reference index](#local-corpus-layout) to load only the files that match the task. Read [reference loading in harness patterns](references/harness-patterns.md#reference-loading-by-task-type) when choosing a combination for a multi-step workflow.

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

After a research session is complete, include `Next steps:` as `CHOOSEABLE_OPTIONS` presented per `chooseable-options/SKILL.md` (printed tokens **and** the harness Ask User picker when that tool is available):

- `ACTION_NAME_IN_SCREAMING_SNAKE_CASE`: Description of what will be done if chosen.

Required base option:

- `CREATE_RESEARCH_DERIVED_EXPERT_SKILL`: Create a reusable expert skill from this research topic using the exact `.researches/<timestamp>/` payload (`consolidated.md`, `consolidated.json`, `web-search/`, `web-fetch/`, `metadata.json`, and any `firecrawl/` dirs if a specialized backend was used).

Cross-skill routing options (generate dynamically based on surfaced signals):

- `PREPARE_IMPLEMENTATION_PLAN`: Route to `plan/SKILL.md` when findings are implementation-ready.
- `DEEPEN_RESEARCH_WITH_ONLINE_STUDY`: Route to `study/SKILL.md` when material unknowns remain.
- `RESOLVE_COMPETING_APPROACHES`: Route to `decisions/SKILL.md` when tradeoffs are unresolved.
- `SYNC_GUIDANCE_DOCUMENTATION`: Route to the `documentation-sync` workflow when policy or docs must be updated.
- `REFINE_SPECIALIZED_BACKEND`: Route to a sibling primer (`firecrawl` or equivalent) only when that backend was used and command gaps remain.
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
    ├── firecrawl/           ← only if a Firecrawl backend was used
    │   ├── raw/
    │   └── reports/
    ├── web-search/          ← host search artifacts (JSON)
    ├── web-fetch/           ← host fetch artifacts (markdown, HTML)
    ├── web-research/        ← hybrid search+fetch artifacts
    ├── metadata.json
    ├── subagent-reports/
    ├── consolidated.md
    └── consolidated.json
```

Keep `.researches/.gitkeep` committed and publish completed generated session folders.

## Common Pitfalls

1. **Blocking research waiting for Firecrawl (or any specialized backend).** Host search/fetch is the default. Don't stop research to install and authenticate a CLI.
2. **Requiring a specialized backend for simple lookups.** Host `web_search` is the default for quick facts and discovery.
3. **Keeping only markdown documentation without HTML backup.** Documentation targets require both representations for source fidelity.
4. **Trusting GitHub blob-page scrape as canonical source text.** Blob-page markdown includes GitHub chrome; use `raw.githubusercontent.com` or a local clone for canonical text.
5. **Forgetting to set `FIRECRAWL_OUTPUT_DIR` before Firecrawl batch commands.** Only relevant when that CLI is actually used; set it once per session.
6. **Using `firecrawl agent` for simple searches.** If Firecrawl is in use, `search` and `scrape` are cheaper and faster for known targets. Host search is cheaper still.
7. **Not scoping crawls with `--limit` and `--max-depth`.** Unbounded crawls are expensive and may hit rate limits.
8. **Treating host web tools as a fallback.** They are the default for discovery, single-page reads, and full research sessions. Specialized backends are extras.
9. **Using vague or overly broad search queries.** "How to use X" returns marketing pages; "X v2 API configuration" returns targeted docs. Query formulation is the highest-leverage research skill.
10. **Treating all sources as equally credible.** Official docs and GitHub repos outweigh random blog posts. Evaluate source strength before deep-reading.
11. **Continuing to search after 2-3 failed reformulations.** If multiple reformulations return poor results, classify the dead end (too niche, too new, too ambiguous, language barrier) and either switch strategy or document the gap. Never waste credits or context on a failing approach.
12. **Switching tools instead of reformulating queries.** If host search returns poor results, another search backend with the same query will also return poor results. The query is the problem, not the tool — reformulate first, switch tools second.
13. **Over-researching after finding convergent evidence.** 2 independent sources that agree is sufficient for most questions. Continuing to search for 5+ sources on the same point wastes context and credits. See Research Methodology → Research Sufficiency for stopping criteria.
14. **Skipping research planning and starting with a search.** Without a one-sentence research question, knowledge of what you already know, and a stopping rule, your first search is likely too broad. See Research Planning for the 3-question pre-search checklist.
15. **Restarting from scratch on follow-up searches.** When initial results reveal a more specific question, chain the follow-up search carrying forward version numbers and key terms — don't discard what you already know. See Research Methodology → Research Chaining.

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|---------------------|
| No host search or fetch tool is available | Report the gap. Do not block on installing Firecrawl or any other backend. |
| `firecrawl` command not found (only relevant if you intended to use it) | Skip the specialized step. Continue with host search/fetch. |
| `firecrawl scrape` markdown includes UI noise | Add `--only-main-content`. For GitHub repos, switch to raw URLs or the archival helper. |
| `firecrawl browser` shorthand fails | Use explicit `firecrawl browser execute --node ...` instead of shorthand syntax. |
| Screenshot capture returns no URL | Confirm the installed CLI supports `--format screenshot`. Escalate to browser mode if needed. |
| Consolidation produces empty output | Verify the input directory contains `.json` or `.md` files and that `--query` is provided. |
| Session folder does not auto-publish | The output must be inside `.researches/` with a valid `metadata.json`. Use `--no-publish` to skip intentionally. |
| Host `web_search` or `web_fetch` returns no results | Try alternative query terms. Do not switch search backends with the same query. |
| Host `web_search` returns irrelevant results | Reformulate the query: add technology name, version/year qualifiers, or use exact error messages. See Research Methodology > Query Formulation. |
| Need to evaluate source credibility | Prioritize official docs, GitHub repos, and version-qualified sources. See Research Methodology > Source Evaluation for the 5-signal heuristic. |
| Multiple reformulations return poor results | Classify the dead end (too niche, too new, too ambiguous) and follow the Research Dead End Protocol. Do not continue searching with the same strategy. |
| Two different search backends both return poor results | The query is the problem, not the tool. Reformulate with site-qualified, version-qualified, or error-quote searches before switching tools. |
| Need structured extraction but no specialized backend | Use host `web_fetch` to get page content, then parse manually. Note the gap in the synthesis. |

## Reliability and Cost Guardrails

1. **Start with the simplest available tool that answers the question.** Host `web_search` for discovery; host `web_fetch` for known URLs.
2. Read [tool selection](references/tool-selection.md#additional-cost-and-reliability-guardrails) when setting up optional backend cache reuse, crawl scope, schema extraction, or timeout fallbacks.
3. Save host search/fetch results to `.researches/<timestamp>/` for reproducibility. Firecrawl dirs are optional.
4. If a specialized capability is needed but unavailable, note the gap and finish with host tools.
5. **Formulate queries before launching searches.** Specific, disambiguated queries return better results than vague ones. Reformulate rather than fetching more pages on poor results.
6. **Evaluate sources before deep-reading.** Prioritize official docs, GitHub repos, and recent version-qualified sources. Ignore forums and SEO blogs unless no better source exists.
7. **Stop searching after 2-3 failed reformulations.** Follow the Research Dead End Protocol: classify the failure, switch strategy (site-qualified search, error-quote, version-qualified), document the gap, and escalate rather than extrapolate. Never continue a failing approach.
8. **Reformulate queries before switching tools.** If host search returns poor results, another search backend with the same query will also return poor results. The query is the problem, not the tool.

## Local Corpus Layout

The `references/` directory contains seven hand-authored synthesis and command references. No subfolders. No vendored upstream documentation pages.

Read each reference when you need the guidance below.

| File | Read when you need |
|------|---------|
| [`consolidation-patterns.md`](references/consolidation-patterns.md) | Six consolidation strategies for merging subagent findings, plus deduplication and validation checklists |
| [`github-repository-doc-archival.md`](references/github-repository-doc-archival.md) | Hybrid archival pattern for GitHub repo docs: canonical markdown, rendered HTML, and optional screenshots |
| [`harness-patterns.md`](references/harness-patterns.md) | Harness-worker patterns: host search/fetch parallelization (default), optional specialized-backend patterns, plus session directory reference |
| [`query-formulation.md`](references/query-formulation.md) | Query formulation quick-reference: reformulation techniques, domain-specific patterns, query anatomy, anti-patterns, and phase-specific guidance |
| [`source-evaluation.md`](references/source-evaluation.md) | Source evaluation quick-reference: 5-signal heuristic, domain authority cheat sheet, version-qualified query patterns, recency signals, red flags, and reformulation guidance |
| [`tool-selection.md`](references/tool-selection.md) | Host-first tool decision tree; optional Firecrawl CLI command patterns and cost guardrails when that backend is present |
| [`session-commands.md`](references/session-commands.md) | CLI examples for saving, consolidating, or publishing a session, plus the full script and flag inventory |

## Guidance Alignment

- Apply repository guidance consistently with `AGENTS.md`.
- If this skill file is updated, run `npm run skills:sync` so IDEs pick up the new version immediately.
- Verify specialized-backend CLI behavior with that tool's `--help` before relying on command syntax for newly released versions. Only load that path when the backend is already available.

## Temporary Files

If this skill needs to create temporary files, place them under `.tmp/research-online/YYYY-MM-DD-{subject}`. The root `.tmp/` directory is already gitignored. Do not create top-level dotfile temp directories.

[^rt]: `npx tsx` accepts any standard runner — `bunx tsx`, `pnpm dlx tsx`, `deno run -A npm:tsx`, `node --import tsx`, or `yarn dlx tsx`. The first five auto-fetch `tsx` on demand; only `node --import tsx` requires `tsx` to be installed locally first (`npm i -D tsx`, or `npm i -g tsx` if you cannot reach the npm registry). Bun users can also skip `tsx` entirely and run TypeScript directly via `bun <script>`. Pick whichever your project ships.
