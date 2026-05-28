# Source Evaluation Quick Reference

> **Snapshot age:** 2026-05-18. Verify relevance against current web standards before relying on specific domain signals.

Use this reference when evaluating `web_search` and `web_fetch` results during research. Apply the 5-signal heuristic to decide which sources to deep-read and which to skip.

## 5-Signal Heuristic

Rate each source on five signals. Sources scoring **3 or more strong signals** are high-priority deep-reads. Sources scoring **fewer than 2 strong signals** should be skipped or re-queried.

| # | Signal | Strong ✅ | Weak ❌ | Weight |
|---|--------|-----------|---------|--------|
| 1 | **Domain authority** | Official docs, `.dev`/`.org` sites, GitHub repos, npmjs.com, MDN, RFCs | Forums (Reddit, SO), SEO blogs, content mills, Medium posts without author credentials | High |
| 2 | **Recency** | Dated within 12 months, version-qualified (e.g., "Next.js 15"), changelog entries | Undated, no version reference, pre-release docs for released features | High |
| 3 | **Depth** | Code examples, API signatures, migration guides, type definitions | High-level overviews, marketing copy, tutorials without runnable code | Medium |
| 4 | **Author authority** | First-party (maintainer, official team, RFC author) | Third-party tutorials, anonymous authors, AI-generated summaries without sources | Medium |
| 5 | **Canonical reference** | Links to RFCs, specs, changelogs, official announcements, source code | Paraphrased summaries without source links, secondary citations | Medium |

### Quick Scoring

```
3+ strong signals → deep-read immediately
2 strong signals → deep-read if relevant to the specific question
0–1 strong signals → skip or reformulate query
```

## Domain Authority Cheat Sheet

### High-Authority Domains (trust by default)

| Domain | Subject | Notes |
|--------|---------|-------|
| `developer.mozilla.org` | Web APIs, CSS, HTML, JS | MDN is the canonical web reference |
| `nodejs.org/docs` | Node.js APIs | Official docs; always version-qualified |
| `typescriptlang.org/docs` | TypeScript language | Official handbook and release notes |
| `nextjs.org/docs` | Next.js framework | Official App Router and Pages Router docs |
| `react.dev` | React library | Official React docs (new site) |
| `tailwindcss.com/docs` | Tailwind CSS | Official utility class reference |
| `docs.docker.com` | Docker | Official engine and compose docs |
| `kubernetes.io/docs` | Kubernetes | Official K8s documentation |
| `postgresql.org/docs` | PostgreSQL | Official PG docs; version-qualified |
| `mongoosejs.com/docs` | Mongoose ODM | Official guide and API reference |
| `drizzle.team/docs` | Drizzle ORM | Official docs; check version |

### Medium-Authority Domains (verify claims against primary sources)

| Domain | Subject | Risk |
|--------|---------|------|
| `stackoverflow.com` | All tech | Answers may be outdated; check date and upvotes |
| `dev.to` | All tech | Community posts; verify code examples work |
| `medium.com` | All tech | Variable quality; check author credentials |
| `freecodecamp.org/news` | All tech | Generally reliable tutorials; still verify version |
| `github.com` READMEs | All tech | May be outdated; check last commit date |

### Low-Authority Domains (skip unless no better source exists)

| Domain | Subject | Why weak |
|--------|---------|----------|
| `w3schools.com` | Web basics | Often outdated; prefer MDN |
| `geeksforgeeks.org` | All tech | Content-mill quality; variable accuracy |
| `tutorialspoint.com` | All tech | Surface-level; often outdated |
| `javatpoint.com` | All tech | Surface-level; SEO-first |
| `baeldung.com` (non-authoritative) | Java/Spring | Good when author is listed; otherwise generic |

## Version-Qualified Query Patterns

When searching for framework or library information, **always include the version** in your query:

```text
❌ "Next.js App Router routing"               → mixed versions, may be outdated
✅ "Next.js 15 App Router routing"             → version-qualified, current answers

❌ "Mongoose populate"                          → mixes v6, v7, v8 answers
✅ "Mongoose 8 populate"                         → targets current API

❌ "TypeScript generic constraints"             → answers from 5+ versions
✅ "TypeScript 5.5 generic constraints"         → current behavior
```

## Recency Signals

When evaluating a source's recency, check for:

| Signal | Strong recency | Weak recency |
|--------|---------------|-------------|
| Publication date | Clearly stated, within 12 months | No date, or older than 12 months |
| Version reference | "Works in v15.x", "Since v3.0" | "New feature", "Recently added" |
| API references | Matches current docs | References deprecated APIs |
| Code examples | Uses current API signatures | Uses legacy patterns (`componentWillMount`, etc.) |
| Dependency versions | Current major versions | Outdated major versions |

## Red Flags: Skip These Sources

Skip any source that exhibits these red flags:

1. **SEO-first structure**: The content is clearly structured for search engines, not for readers (keyword-stuffed headings, excessive internal links, ads interspersed with content).
2. **No dates or versions**: The article discusses a fast-moving library without specifying which version it covers.
3. **Copy-paste from official docs**: The content is a near-verbatim copy of official docs without adding context, examples, or clarification. Prefer the original.
4. **Contradicts official docs**: The source makes claims that conflict with official documentation (without explaining why the official docs are wrong or outdated). Resolve using the Conflict Resolution priority: Official > Community, Recent > Outdated, Primary > Secondary, Consensus > Outlier, Verifiable > Unverifiable. See SKILL.md → Research Methodology → Conflict Resolution.
5. **AI-generated without sources**: The content reads like AI output (generic phrasing, no specific code examples, no source links) and offers no way to verify claims.

## When to Reformulate Instead of Deep-Reading

If your top 3 search results all score below 2 strong signals, **stop and reformulate** before deep-reading any of them. Common reformulation tactics:

1. **Add the technology name**: `"authentication setup"` → `"Better Auth Next.js App Router session configuration"`
2. **Add the version**: `"Drizzle ORM relations"` → `"Drizzle ORM v0.30 relations"`
3. **Use the exact API name**: `"connection pooling"` → `"pgPool2 Drizzle connection config"`
4. **Quote the error**: Search for the exact error message or its most unique fragment.
5. **Switch to official docs**: Search for `"site:docs.example.com <topic>"` to target official documentation.

## Cross-Reference

- For query formulation principles, see SKILL.md → Research Methodology → Query Formulation.
- For iterative reformulation patterns, see SKILL.md → Research Methodology → Iterative Refinement Pattern.
- For tool selection guidance, see `references/tool-selection.md`.
- For conflict resolution when sources disagree, see SKILL.md → Research Methodology → Conflict Resolution.