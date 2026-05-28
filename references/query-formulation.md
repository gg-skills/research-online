# Query Formulation Quick Reference

> **Snapshot age:** 2026-05-18. Verify relevance against current search engine behavior before relying on specific query patterns.

Use this reference when formulating search queries for `web_search` and Firecrawl `search`. Apply the principles from SKILL.md → Research Methodology → Query Formulation, then use the patterns and examples below to construct effective queries.

## Core Principles

1. **Start specific, broaden if needed.** Frame queries around exact technical concepts, API names, or error messages.
2. **Include context keywords that disambiguate.** Add technology names, version numbers, and domain qualifiers.
3. **Use version and year for time-sensitive topics.** Frameworks change; version-qualified queries surface current answers.
4. **Quote exact error messages.** Use the most unique fragment of an error string as the query.
5. **Include the technology name.** Generic terms return irrelevant results; domain-specific terms narrow the scope.
6. **Avoid question words.** Lead with the technical noun phrase, not "how to" or "what is".
7. **Iterate: reformulate, don't just fetch more.** Different terminology often surfaces completely different results.

## Reformulation Techniques

When the initial query returns poor results, apply one technique at a time:

| Technique | When to use | Example |
|-----------|-------------|---------|
| **Generalize** | No results at all; query too specific | `"pgPool2 drizzle connection config"` → `"drizzle connection pooling postgres"` |
| **Rephrase** | Irrelevant results; wrong domain | `"authentication setup"` → `"Better Auth Next.js session configuration"` |
| **Add scope** | Ambiguous results; multiple meanings | `"connection pooling"` → `"connection pooling Node.js postgres"` |
| **Add version** | Outdated results | `"Next.js App Router changes"` → `"Next.js 15 App Router changes 2025"` |
| **Error-quote** | Debugging; exact error available | `"something went wrong"` → `"'Cannot read properties of undefined' Next.js App Router"` |

## Domain-Specific Query Patterns

### JavaScript/TypeScript Libraries

```text
❌ "how to use react hooks"
✅ "React useServerAction App Router error handling"

❌ "drizzle orm tutorial"
✅ "drizzle ORM v0.30 many-to-many relations postgres"

❌ "next auth setup"
✅ "Better Auth v0.5 Next.js App Router session cookie configuration"
```

### Node.js/Backend

```text
❌ "express middleware"
✅ "Express 5 middleware TypeScript async error handling"

❌ "node cache"
✅ "Node.js in-memory cache LRU eviction TTL"

❌ "docker compose networking"
✅ "docker compose v2 network bridge DNS resolution"
```

### Database

```text
❌ "postgres performance"
✅ "PostgreSQL 16 query plan index-only scan performance"

❌ "mongodb aggregate"
✅ "MongoDB 7 $lookup pipeline aggregation performance"

❌ "redis pubsub"
✅ "Redis 7 pub/sub cluster pattern message ordering"
```

### DevOps/Infrastructure

```text
❌ "k8s deployment"
✅ "Kubernetes 1.30 rolling deployment strategyConfig maxSurge"

❌ "terraform error"
✅ "terraform plan 'Provider instance not found' AWS region"

❌ "github actions cache"
✅ "GitHub Actions cache v4 action restore-keys matrix"
```

## Query Anatomy

A well-formed query has these parts (some optional):

```text
[technology] [version] [specific-feature-or-api] [qualifier] [error-or-context]

Example: "Drizzle ORM v0.30 many-to-many relations postgres"
         ─────────── ──── ─────────────────── ────────
         technology   version  specific feature   qualifier

Example: "'Cannot read properties of undefined' Next.js App Router"
         ─────────────────────────────── ──────── ─────────
         error-quote (exact fragment)     technology  context
```

## Anti-Patterns

| Anti-pattern | Why it fails | Fix |
|-------------|--------------|-----|
| `"how to do X"` | Question words dilute search signal; "how to" matches blog noise | Lead with the technical noun: `"X configuration"` |
| `"X tutorial"` | Returns beginner content, often outdated | Specify version: `"X v2 migration guide"` |
| `"X vs Y"` | Returns comparison marketing pages | Specify the comparison dimension: `"X vs Y performance benchmarks 2025"` |
| `"best X for Y"` | Returns affiliate lists, not technical docs | Specify the constraint: `"X TypeScript type safety"` |
| `"X not working"` | Too vague; every framework has "not working" posts | Quote the error: `"'ECONNREFUSED' X Docker network"` |

## Reformulation Decision Flow

```text
Initial query → web_search → Evaluate results

No results?
  → Generalize one term at a time
  → Try alternate terminology (e.g., "orm" → "query builder")

Irrelevant results?
  → Add technology name as context qualifier
  → Add version number
  → Rephrase with more specific API/concept name

Outdated results?
  → Add year (e.g., "2025")
  → Add version number (e.g., "v15", "7.x")
  → Try site-qualified search (e.g., "site:docs.example.com")

Low authority?
  → Add "site:docs.*" or "site:github.com/*"
  → Add "official" or "reference" qualifier
  → Switch to Firecrawl for targeted extraction

After 2-3 reformulations with no improvement:
  → Note the gap in synthesis
  → Consider whether the information exists online
  → Suggest alternative research angles
```

## Reformulation Example Chains

Real-world examples of failed queries, diagnosis, reformulation, and outcome:

### Example 1: Too broad → Specific

```text
Query:      "how to use drizzle"
Diagnosis:  Too broad; returns marketing pages and tutorials
Reformulate: "drizzle ORM v0.30 many-to-many relations postgres"
Outcome:    Targeted API docs and GitHub issues surface directly
```

### Example 2: Missing version → Version-qualified

```text
Query:      "Next.js App Router changes"
Diagnosis:  Outdated; returns Next.js 13 and 14 answers mixed with 15
Reformulate: "Next.js 15 App Router changes 2025"
Outcome:    Current answers from release notes and migration guides
```

### Example 3: Wrong terminology → Correct API name

```text
Query:      "Better Auth session cookie setup"
Diagnosis:  Ambiguous; "setup" returns installation guides, not configuration
Reformulate: "Better Auth Next.js App Router session cookie configuration v0.5"
Outcome:    Exact configuration docs and GitHub discussions about session cookies
```

### Example 4: Error message → Error-quote

```text
Query:      "Next.js hydration error"
Diagnosis:  Too vague; returns hundreds of generic hydration error pages
Reformulate: "'Text content does not match server-rendered HTML' Next.js App Router"
Outcome:    Specific GitHub issues and Stack Overflow answers with exact fixes
```

### Example 5: Dead end → Site-qualified switch

```text
Query:      "TypeScript discriminated unions tutorial"
Diagnosis:  Low authority; returns blog spam and beginner tutorials
Reformulate: "site:typescriptlang.org discriminated unions narrowing"
Outcome:    Official TypeScript handbook directly with canonical examples
```

## Phase-Specific Guidance

### Phase 1 (web_search discovery)

- Use 2-3 specific terms (e.g., `"drizzle pgPool2 config"`)
- Scan titles and snippets before deep-reading
- Select the 1-2 most relevant URLs for `web_fetch`
- Save all results with `save-web-research.ts` for reproducibility

### Phase 2 (Firecrawl deep extraction)

- Target specific pages identified in Phase 1
- Use `firecrawl scrape <url> --only-main-content` for clean extraction
- Use `firecrawl map <site-root> --search "<topic>"` for site structure
- Save outputs to `.researches/<timestamp>/firecrawl/`

## Cross-Reference

- For query formulation principles, see SKILL.md → Research Methodology → Query Formulation.
- For iterative refinement patterns, see SKILL.md → Research Methodology → Iterative Refinement Pattern.
- For source evaluation heuristics, see `references/source-evaluation.md`.
- For Firecrawl command syntax, see `references/tool-selection.md`.
- For conflict resolution when sources disagree, see SKILL.md → Research Methodology → Conflict Resolution.
- For chaining follow-up searches when initial results reveal a more specific question, see SKILL.md → Research Methodology → Research Chaining.