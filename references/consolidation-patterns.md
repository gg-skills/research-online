# Research Result Consolidation Patterns

Strategies for combining subagent research findings into coherent, source-backed outputs.

## Consolidation Pipeline

```text
Raw Results
    |
[Deduplicate] -> Remove exact and fuzzy overlaps
    |
[Normalize]   -> Standardize fields (source, title, content, date, category)
    |
[Synthesize]  -> Merge related points by chosen frame
    |
[Structure]   -> Organize by theme, source, or timeline
    |
[Validate]    -> Check completeness, contradictions, attribution
    |
[Format]      -> Final markdown + JSON outputs
```

## Pattern 1: Thematic Consolidation

Group findings by topic rather than by source.

**Use case:** Multiple sources covering similar subjects (feature comparisons, API docs).

**Output structure:**

```markdown
## Automation Features

Common across sources: Salesforce, HubSpot, Zoho

**Workflow automation**

- Salesforce: Advanced workflow builder with triggers
- HubSpot: Visual workflow designer, easy to use
- Zoho: Basic workflow automation included
```

## Pattern 2: Source-Based Consolidation

Keep organization by source with a cross-reference comparison matrix.

**Use case:** Comparing perspectives or maintaining strict source attribution.

**Output structure:**

```javascript
{
  summary: "Comparison of 3 CRM platforms",
  comparisonMatrix: {
    headers: ["Feature", "Salesforce", "HubSpot", "Zoho"],
    rows: [["Starting Price", "$25/user", "$0-45/user", "$0-20/user"]],
  },
  bySource: [...],
  recommendations: [...],
}
```

## Pattern 3: Hierarchical Synthesis

Build a knowledge tree from granular findings.

**Use case:** Deep research with many detailed findings (market research, technology surveys).

## Pattern 4: Timeline Consolidation

Organize findings chronologically.

**Use case:** Version history, news, event sequences.

**Output structure:**

```markdown
## Q1 2026

### January

- **Jan 15**: OpenAI releases GPT-5 [Source: TechCrunch]
  - Context window expanded to 2M tokens
```

## Pattern 5: Evidence-Based Consolidation

Weight findings by source reliability and evidence strength.

**Use case:** Source quality varies (forums vs. official docs).

**Approach:**

1. Define source reliability tiers (`official-docs`: 1.0, `reputable-news`: 0.9, `forum`: 0.4).
2. Score each finding: `reliabilityScore * evidenceStrength`.
3. Filter below threshold (e.g., 0.6).
4. Flag conflicting claims for manual verification.

## Pattern 6: Summary-Detail Consolidation

Provide an executive summary with drill-down details.

**Use case:** Comprehensive reports with readers at different depth needs.

**Output structure:**

```markdown
# Research Report: [Topic]

## Executive Summary

[2-3 paragraphs synthesizing key findings]

## Key Findings

1. **[Finding 1]** - Supported by 3 sources
2. **[Finding 2]** - Supported by 2 sources

## Detailed Analysis

<details>
<summary>Source 1: [Name]</summary>
[Full details]
</details>

## Methodology

- Sources researched: 5
- Pages scraped: 47
- Raw data: `.researches/2026-02-11T134626Z/`
```

## Deduplication Strategies

**Exact match:**

```javascript
function dedupeExact(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// By URL or content hash
dedupeExact(findings, (f) => f.url);
dedupeExact(findings, (f) => hashContent(f.content));
```

**Fuzzy match:** Group items by similarity (e.g., Jaccard on tokenized titles), then return the best representative from each group.

## Validation Checklist

Before returning consolidated results:

- [ ] **Completeness**: Did we answer the original question?
- [ ] **Consistency**: Are there contradictions between sources?
- [ ] **Attribution**: Can we trace claims back to sources?
- [ ] **Currency**: Is the information up-to-date?
- [ ] **Bias**: Have we represented all sources fairly?
- [ ] **Gaps**: Are there obvious missing pieces?

## Saving Consolidated Results

Always save to a timestamped folder:

```javascript
const timestamp = new Date().toISOString().replace(/[:.]/g, "");
const basePath = `.researches/${timestamp}`;

writeFile(`${basePath}/metadata.json`, JSON.stringify({ query, timestamp, toolsUsed }));
writeFile(`${basePath}/consolidated.md`, generateMarkdown(consolidated));
writeFile(`${basePath}/consolidated.json`, JSON.stringify(consolidated));
```
