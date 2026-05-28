/**
 * @fileoverview Owns the scripted regression harness for `cleanWebContent()` in research-online: removal matrices
 * versus false-positive preservation cases backed by percent-length reduction and substring assertions.
 *
 * Verifies that cookie banners, navigation, footers, social prompts, and newsletter CTAs shrink materially while
 * technical prose about cookies, settings, scheduling, and copy-related APIs stays intact (no false positives).
 * Flow: build harness row -> cleanWebContent({ source: "fetch" }) -> measure reduction -> assert thresholds and substrings.
 *
 * @testing CLI: npx tsx skills/research-online/scripts/clean-web-content.test.ts
 * @see skills/research-online/scripts/clean-web-content.ts - Normalization implementation under test whose fetch-sourced stripping rules and heuristics these scenarios exercise end to end.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { cleanWebContent } from "./clean-web-content.ts";

/**
 * Declarative harness row describing one cleanWebContent() scenario and its assertions.
 *
 * @remarks
 * Rows are split into removal cases (expect meaningful shrink) versus false-positive cases
 * (expect minimal shrink). Optional substring lists guard against over-aggressive stripping.
 */
interface TestCase {
  name: string;
  input: string;
  /** For removal tests: minimum % reduction expected */
  minReduction?: number;
  /** For false-positive tests: maximum % reduction allowed (default 5) */
  maxReduction?: number;
  /** Substrings that must NOT appear in cleaned output */
  mustNotContain?: string[];
  /** Substrings that MUST appear in cleaned output */
  mustContain?: string[];
}

const REMOVAL_TESTS: TestCase[] = [
  {
    name: "Single-line cookie banner",
    input: `# My Research Page

This is the actual content.
We use cookies to give you the best experience.
More actual content.`,
    minReduction: 20,
    mustNotContain: ["We use cookies"],
    mustContain: ["actual content"],
  },
  {
    name: "Multi-line cookie consent block",
    input: `# My Research Page

This is the actual content about TypeScript generics.

We use cookies to give you the best experience on our website.
By continuing to use this site, you consent to the use of cookies
in accordance with our Cookie Policy. You can change your cookie
settings at any time.

Accept All Cookies  |  Manage Preferences  |  Reject All

More content about TypeScript generics here.`,
    minReduction: 40,
    mustNotContain: ["We use cookies", "By continuing", "Accept All", "Manage Preferences"],
    mustContain: ["TypeScript generics", "More content"],
  },
  {
    name: "GDPR consent block",
    input: `# API Documentation

This API supports rate limiting.
This site uses cookies and tracking technologies.
By clicking "Accept", you agree to the use of these cookies.
Only Necessary Cookies  |  Accept All

## Authentication

Use Bearer tokens for authentication.`,
    minReduction: 30,
    mustNotContain: ["This site uses cookies", "By clicking", "Only Necessary"],
    mustContain: ["rate limiting", "Bearer tokens"],
  },
  {
    name: "Repeated cookie lines (global flag)",
    input: `# Page Title

Content paragraph 1.
We use cookies to improve your experience.
We use cookies to improve your experience.
Content paragraph 2.
Accept All Cookies
Content paragraph 3.`,
    minReduction: 30,
    mustNotContain: ["We use cookies", "Accept All Cookies"],
    mustContain: ["Content paragraph 1", "Content paragraph 2", "Content paragraph 3"],
  },
  {
    name: "Complex consent block with got-it button",
    input: `# Documentation

Real content about APIs here.

We use cookies to personalize content and ads.
By continuing to use this site, you consent to our use of cookies
as described in our privacy policy. You can change your cookie
settings at any time.

Got it  |  Manage Settings

More real content.`,
    minReduction: 40,
    mustNotContain: ["We use cookies", "By continuing", "Got it", "Manage Settings"],
    mustContain: ["Real content", "More real content"],
  },
  {
    name: "Edit on GitHub links",
    input: `# Getting Started\n\n[Edit this page on GitHub](https://github.com/vercel/next.js/edit/main/docs/getting-started.md)\n\nThis is the actual documentation content.\n\n[Edit this page on GitHub](https://github.com/vercel/next.js/edit/main/docs/routing.md)`,
    minReduction: 20,
    mustNotContain: ["Edit this page on GitHub"],
    mustContain: ["actual documentation content"],
  },
  {
    name: "Feedback prompt removal",
    input: `# API Reference\n\nThis is the API reference content.\n\n## Was this helpful?\n\nLet us know if this page was helpful. Yes No\n\nMore API content.`,
    minReduction: 25,
    mustNotContain: ["Was this helpful", "Let us know"],
    mustContain: ["API reference content", "More API content"],
  },
  {
    name: "Documentation chrome (copy, pagination, back-to-top, sponsors)",
    input: `# Getting Started\n\n[Back to top](#getting-started)\n\nCreate a new app with:\n\nThe installation is simple.\n\nCopy\n\nPrevious: Installation | Next: API Routes\n\nGold sponsors: Vercel, AWS\n\nThis page was last updated on January 15, 2025.`,
    minReduction: 30,
    mustNotContain: ["Back to top", "Copy", "Previous: Installation", "Next: API Routes", "Gold sponsors", "last updated"],
    mustContain: ["Create a new app", "installation is simple"],
  },
  {
    name: "Related articles section",
    input: `# Documentation\n\nThis is the main content.\n\n## Related Articles\n\n- [Why Next.js](https://nextjs.org/docs/why)\n- [TypeScript Setup](https://nextjs.org/docs/typescript)\n\nEnd of page.`,
    minReduction: 25,
    mustNotContain: ["Related Articles"],
    mustContain: ["main content"],
  },
  {
    name: "Inline Table of Contents",
    input: `# Guide\n\nTable of Contents\n\n- Getting Started\n- Quick Start\n- Routing\n\nThis is the guide content.`,
    minReduction: 20,
    mustNotContain: ["Table of Contents"],
    mustContain: ["guide content"],
  },
];

const FALSE_POSITIVE_TESTS: TestCase[] = [
  {
    name: "Technical cookie documentation",
    input: `# Understanding HTTP Cookies

HTTP cookies are small pieces of data stored by the browser.
They are commonly used for session management, personalization, and tracking.

## Setting Cookies

Set-Cookie: sessionId=abc123; Path=/; HttpOnly

## Cookie Attributes

The HttpOnly flag prevents JavaScript access to the cookie.
The Secure flag ensures cookies are only sent over HTTPS.`,
    maxReduction: 5,
    mustContain: ["HTTP cookies", "Set-Cookie", "HttpOnly", "Secure flag"],
  },
  {
    name: "Scheduling 'at any time'",
    input: `# Scheduling

You can reschedule at any time.
The system allows changes at any time.
Feel free to contact us at any time.`,
    maxReduction: 5,
    mustContain: ["reschedule at any time", "changes at any time"],
  },
  {
    name: "Cookie configuration in technical docs",
    input: `# Configuration

You can change your display settings in the preferences panel.
Cookie settings for the application are defined in config.ts.`,
    maxReduction: 5,
    mustContain: ["display settings", "Cookie settings for the application", "config.ts"],
  },
  {
    name: "API cookie documentation",
    input: `# Browser Storage

These cookies are set by the authentication middleware and contain
session tokens. You must configure these cookies in your environment`,
    maxReduction: 5,
    mustContain: ["authentication middleware", "session tokens", "configure these cookies"],
  },
  {
    name: "Copy command in technical docs",
    input: `# Installation\n\nTo copy files between servers, use the scp command.\nYou can also copy directories with cp -r.\nThe copy module in Node.js provides file copying utilities.`,
    maxReduction: 5,
    mustContain: ["copy files between servers", "cp -r", "copy module"],
  },
  {
    name: "Related concepts in technical content",
    input: `# See Also\n\nFor related background on this approach, see the API documentation.\nRelated articles on caching strategies are discussed in Chapter 3.`,
    maxReduction: 10,
    mustContain: ["API documentation", "Chapter 3"],
  },
  {
    name: "Previous/Next in technical prose",
    input: `# Navigation\n\nThe previous section covered async/await.\nThe next section covers generators.\nPrevious versions of Node.js used callbacks.`,
    maxReduction: 5,
    mustContain: ["async/await", "generators", "Previous versions"],
  },
  {
    name: "Table of contents heading in docs",
    input: `# API Reference\n\n## Contents\n\nThis section covers the public API.\nExported functions are listed in the overview.`,
    maxReduction: 10,
    mustContain: ["public API", "Exported functions"],
  },
];

/**
 * Computes the percent length reduction between raw input and cleaned output.
 */
function cleanWebContentTest_computeReductionPercent(input: string, cleaned: string): number {
  return ((input.length - cleaned.length) / input.length) * 100;
}

/**
 * Validates reduction thresholds for a harness row and logs threshold failures.
 *
 * @remarks
 * I/O: writes failure lines to stdout when the row is a removal case below `minReduction` or a
 * false-positive case above `maxReduction`. Removal rows take precedence when `minReduction` is set.
 *
 * @returns true when the threshold check failed (caller should count the case and continue).
 */
function cleanWebContentTest_logReductionThresholdFailure(
  test: TestCase,
  reduction: number,
  cleaned: string,
): boolean {
  if (test.minReduction !== undefined) {
    if (reduction < test.minReduction) {
      console.log(`❌ ${test.name}: ${reduction.toFixed(1)}% reduction (minimum ${test.minReduction}%)`);
      console.log(`   Cleaned output:\n${cleaned}`);
      return true;
    }
    return false;
  }
  if (test.maxReduction !== undefined && reduction > test.maxReduction) {
    console.log(`❌ ${test.name}: ${reduction.toFixed(1)}% reduction (maximum ${test.maxReduction}%)`);
    console.log(`   False positive! Content was incorrectly removed.`);
    console.log(`   Cleaned output:\n${cleaned}`);
    return true;
  }
  return false;
}

/**
 * Evaluates substring presence rules for a harness row and logs each violation.
 *
 * @remarks
 * I/O: writes one line per forbidden substring still present or required substring missing.
 *
 * @returns true when at least one substring assertion failed.
 */
function cleanWebContentTest_logSubstringAssertionFailures(test: TestCase, cleaned: string): boolean {
  let testFailed = false;
  if (test.mustNotContain) {
    for (const forbidden of test.mustNotContain) {
      if (cleaned.includes(forbidden)) {
        console.log(`❌ ${test.name}: Contains forbidden substring "${forbidden}"`);
        testFailed = true;
      }
    }
  }
  if (test.mustContain) {
    for (const required of test.mustContain) {
      if (!cleaned.includes(required)) {
        console.log(`❌ ${test.name}: Missing required substring "${required}"`);
        testFailed = true;
      }
    }
  }
  return testFailed;
}

/**
 * Runs removal and false-positive matrices and reports pass/fail counts to stdout.
 *
 * @remarks
 * I/O: logs per-test outcomes to the console. Exits the process with code 1 when any case fails.
 */
function runTests(): void {
  let passed = 0;
  let failed = 0;
  const allTests = [...REMOVAL_TESTS, ...FALSE_POSITIVE_TESTS];

  for (const test of allTests) {
    const cleaned = cleanWebContent(test.input, { source: "fetch" });
    const reduction = cleanWebContentTest_computeReductionPercent(test.input, cleaned);

    if (cleanWebContentTest_logReductionThresholdFailure(test, reduction, cleaned)) {
      failed++;
      continue;
    }

    const testFailed = cleanWebContentTest_logSubstringAssertionFailures(test, cleaned);

    if (testFailed) {
      console.log(`   Cleaned output:\n${cleaned}`);
      failed++;
    } else {
      console.log(`✅ ${test.name}: ${reduction.toFixed(1)}% reduction (${test.input.length} → ${cleaned.length} chars)`);
      passed++;
    }
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();