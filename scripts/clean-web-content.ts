/**
 * @fileoverview Content cleaning utility that strips common web page chrome
 * (navigation, footers, cookie banners, edit links, feedback prompts, copy
 * buttons, pagination, inline TOCs, back-to-top links, sponsor sections,
 * social prompts, newsletter CTAs, excessive whitespace) from fetched content. Owned by the `research-online/SKILL.md` skill; used by
 * `save-web-research.ts` when the `--clean` flag is set, and available as a
 * standalone function for other scripts.
 *
 * The cleaner operates on plain text and markdown content using regex-based
 * heuristics — no HTML parser is required. It is deliberately conservative:
 * it removes only well-known boilerplate patterns and preserves all substantive
 * content. False negatives (missed boilerplate) are preferred over false
 * positives (removing real content). A few passes pair small regexes with
 * line-based scans (navigation bars, related-reading blocks, inline TOCs) to
 * keep matchers precise without oversized alternations.
 *
 * @example
 * ```ts
 * import { cleanWebContent } from "./clean-web-content";
 *
 * const cleaned = cleanWebContent(rawFetchOutput, { source: "fetch" });
 * console.log(`Reduced from ${rawFetchOutput.length} to ${cleaned.length} chars`);
 * ```
 *
 * @testing CLI manual: npx tsx skills/research-online/scripts/clean-web-content.ts
 * @see skills/research-online/scripts/save-web-research.ts - CLI that uses this module.
 * @see skills/research-online/SKILL.md - Skill workflow documentation.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

/**
 * Options controlling which cleaning passes to apply.
 *
 * @remarks
 * All passes are enabled by default. Set individual flags to `false` to skip
 * specific passes. The `source` field adjusts heuristics: `"fetch"` content
 * is typically full-page markdown from `web_fetch`, while `"search"` content
 * is structured JSON where only whitespace normalization is useful.
 */
export type CleanOptions = {
  /** Remove cookie/consent banner text. Default: true. */
  removeCookieBanners?: boolean;
  /** Remove footer sections (copyright, sitemap links). Default: true. */
  removeFooters?: boolean;
  /** Remove navigation/menu sections. Default: true. */
  removeNavigation?: boolean;
  /** Collapse excessive blank lines and trim trailing whitespace. Default: true. */
  normalizeWhitespace?: boolean;
  /** Remove common social media sharing prompts. Default: true. */
  removeSocialPrompts?: boolean;
  /** Content source type; adjusts heuristics. Default: "fetch". */
  source?: "fetch" | "search" | "hybrid";
  /** Remove newsletter/signup CTA sections. Default: true. */
  removeNewsletterCTAs?: boolean;
  /** Remove "Edit on GitHub" / "Improve this page" links. Default: true. */
  removeEditModeLinks?: boolean;
  /** Remove "Was this helpful?" / feedback sections. Default: true. */
  removeFeedbackPrompts?: boolean;
  /** Remove "Related Articles" / "See also" link sections. Default: true. */
  removeRelatedSections?: boolean;
  /** Remove "Copy" / "Copied!" buttons after code blocks. Default: true. */
  removeCopyButtons?: boolean;
  /** Remove pagination links (Previous/Next). Default: true. */
  removePagination?: boolean;
  /** Remove inline Table of Contents blocks. Default: true. */
  removeInlineTOC?: boolean;
  /** Remove "Back to top" scroll links. Default: true. */
  removeBackToTop?: boolean;
  /** Remove sponsor/credit sections. Default: true. */
  removeSponsors?: boolean;
};

/** Internal type for a named regex-based cleaning pass. */
type CleaningPass = {
  apply: boolean;
  name: string;
  pattern: RegExp;
  replacement: string;
};

/**
 * Splits content into lines while preserving the dominant newline separator.
 *
 * @remarks
 * Used by line-based cleaners so `\r\n` inputs stay `\r\n` when re-joined.
 */
function cleanWebContent_splitLinesPreserveSeparators(content: string): {
  lines: string[];
  separator: "\n" | "\r\n";
} {
  if (content.includes("\r\n")) {
    return { lines: content.split("\r\n"), separator: "\r\n" };
  }
  return { lines: content.split("\n"), separator: "\n" };
}

/** Removes whole lines when `drop` returns true for that physical line. */
function cleanWebContent_dropLinesWhen(content: string, drop: (line: string) => boolean): string {
  const { lines, separator } = cleanWebContent_splitLinesPreserveSeparators(content);
  return lines.filter((line) => !drop(line)).join(separator);
}

/**
 * Removes runs of consecutive lines matching `predicate` when the run length is
 * at least `minRun`; shorter runs are preserved verbatim.
 */
function cleanWebContent_dropConsecutiveLineRunsWhen(
  content: string,
  predicate: (line: string) => boolean,
  minRun: number,
): string {
  const { lines, separator } = cleanWebContent_splitLinesPreserveSeparators(content);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!predicate(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const runStart = i;
    let run = 0;
    while (i < lines.length && predicate(lines[i])) {
      run += 1;
      i += 1;
    }
    if (run < minRun) {
      for (let k = runStart; k < runStart + run; k += 1) {
        out.push(lines[k]);
      }
    }
  }
  return out.join(separator);
}

/** Detects single-line markdown link bars separated by `|`, `•`, or `·`. */
function cleanWebContent_lineLooksLikeMarkdownNavBar(line: string): boolean {
  const trimmedLeading = line.trimStart();
  const pieces = trimmedLeading.split(/\s*[|•·]\s*/);
  if (pieces.length < 2) {
    return false;
  }
  const oneMarkdownLink = /^\[\s*[^\]]+\s*\]\([^)]+\)$/;
  return pieces.every((piece) => oneMarkdownLink.test(piece.trim()));
}

/** Detects doc-site chrome links like `[Home](/)` on their own line. */
function cleanWebContent_lineLooksLikeDocsNavChromeLink(line: string): boolean {
  return /^.{0,80}\[(?:home|about|contact|blog|docs|documentation)\]\([^)]*\)[\s|]*$/i.test(line)
    || /^.{0,80}\[(?:pricing|features|sign in|log in|sign up|register|get started|menu)\]\([^)]*\)[\s|]*$/i.test(
      line,
    );
}

/**
 * Strips cookie/consent banner text from web content.
 *
 * @remarks
 * Matches common cookie consent phrases across multiple languages. Conservative:
 * only removes lines that are predominantly consent language, not content that
 * happens to mention "cookie" in a technical context.
 */
function removeCookieBanners(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "cookie-banner-line-a",
      // Global flag (g) is required to match ALL occurrences, not just the first.
      pattern: /^.*\b(?:we use cookies|this site uses cookies|this website uses cookies|by continuing|by clicking|accept cookies|accept all cookies|manage cookies)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-banner-line-b",
      pattern: /^.*\b(?:cookie preferences|privacy preferences|consent to cookies|use of cookies|our use of cookies|uses cookies to|cookie policy)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-banner-line-c",
      pattern: /^.*\b(?:privacy & cookies|cookies and tracking|this site uses tracking|our cookie|read our cookie|cookie consent|cookie notice|cookie statement)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-banner-line-d",
      pattern: /^.*\b(?:cookies einstellungen|cookies paramètres|cookies configuración|utilisation des cookies|uso de cookies|utiliziamo i cookie|nós usamos cookies)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-continuation-line-a",
      // Multi-line cookie consent blocks often have continuation lines that don't
      // contain the primary trigger words but are part of the consent block.
      // Match lines like "in accordance with our Cookie Policy",
      // "You can change your cookie settings at any time",
      // "For more information, see our Privacy Policy",
      // "by continuing to use this site, you consent",
      // "you agree to the use of these cookies".
      pattern: /^.*\b(?:in accordance with (?:our|the|your) (?:cookie|privacy|consent)|you can change your (?:cookie|consent|privacy)|you agree to the use of (?:these|our|the) cookies?)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-continuation-line-b",
      pattern: /^.*\bfor more information\b.*\b(?:privacy|cookie|policy)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-continuation-line-c",
      pattern: /^.*\b(?:your cookie settings|you consent to (?:the use of|our|these)|by continuing to use this site)\b.*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-remnant-line-a",
      // Short orphaned lines left after main cookie/consent lines are removed.
      // These are word-wrapped remnants like "settings at any time.",
      // "on our website.", "of cookies." that only appear as consent block remnants.
      // Must contain a consent-context clue to avoid false positives.
      // Note: "these cookies" removed — it matches legitimate technical docs
      // about cookie configuration (e.g., "You must configure these cookies").
      pattern: /^.{0,60}\b(?:cookie settings? at any time|privacy (?:policy|settings) at any time|on (?:our|this) (?:website|site)\.?)\b.{0,30}$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-remnant-line-b",
      pattern: /^.{0,60}\b(?:of cookies\.?|as described in our (?:privacy|cookie) (?:policy|notice)|in our (?:privacy|cookie) (?:policy|notice))\b.{0,30}$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "cookie-accept-button",
      pattern: /^.{0,30}\b(?:accept all|accept cookies|got it|i agree|i accept|dismiss|manage preferences|reject all|customize|only necessary|only necessary cookies)\b.*$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }

  return result;
}

/**
 * Removes navigation and menu sections from markdown content.
 *
 * @remarks
 * Matches markdown headings that look like navigation menus, and unordered/ordered
 * list blocks that are predominantly navigation links. Targets headings containing
 * "Navigation", "Menu", "Sidebar", "Breadcrumb", or "Skip to" prefixes.
 */
function removeNavigation(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "nav-heading",
      // Headings that are purely navigation chrome. Only match when followed by
      // link bars or standalone nav elements, not section headings about navigation concepts.
      // Conservative: match only common chrome patterns, not "# Navigation" as a prose section.
      pattern: /^#{1,6}\s+(?:main navigation|main menu|page navigation|breadcrumb|skip to content)\s*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "skip-to-content",
      pattern: /^.{0,40}skip to (?:main |primary )?content.{0,40}$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }

  result = cleanWebContent_dropLinesWhen(result, cleanWebContent_lineLooksLikeMarkdownNavBar);
  result = cleanWebContent_dropConsecutiveLineRunsWhen(result, cleanWebContent_lineLooksLikeDocsNavChromeLink, 2);

  return result;
}

/**
 * Removes footer sections from markdown content.
 *
 * @remarks
 * Matches markdown headings that look like footers, and common footer boilerplate
 * (copyright lines, "All rights reserved", sitemap references). Targets the
 * final footer section of a document, not every occurrence of footer-like text.
 */
function removeFooters(content: string): string {
  // Remove the last "Footer" or "Footer navigation" section to end of document
  // This handles cases where the footer is a distinct markdown section at the end
  let result = content;

  // Match a footer heading followed by everything until the next major heading or end
  result = result.replace(/^#{1,6}\s+(?:footer|footer navigation|site footer|colophon)\s*$/gim, "");

  // Remove copyright lines
  result = result.replace(/^.{0,30}©\s*\d{4}[\s\S]*?(?:all rights reserved|all rights reserved\.?)\s*$/gim, "");

  // Remove "All rights reserved." lines
  result = result.replace(/^.{0,20}all rights reserved\.?\s*$/gim, "");

  // Remove sitemap references in footers
  result = result.replace(/^.{0,20}sitemap\s*$/gim, "");

  // Remove "Powered by" lines
  result = result.replace(/^.{0,20}powered by.{0,40}$/gim, "");

  // Remove "Made with" lines
  result = result.replace(/^.{0,20}made with.{0,40}$/gim, "");

  // Remove "This page was last updated on..." lines
  result = result.replace(/^.{0,30}this (?:page|article|doc|post) was last updated on.{0,60}$/gim, "");

  // Remove standalone horizontal rules (3+ hyphens, asterisks, or underscores on their own line)
  // Matches both '---' and '* * *' style rules
  result = result.replace(/^\s*[-*_](\s*[-*_]){2,}\s*$/gm, "");

  return result;
}

/**
 * Removes social media sharing prompts and follow buttons.
 *
 * @remarks
 * Matches common social sharing patterns in markdown: "Share on X/Twitter",
 * "Follow us on", and social media icon/label lines.
 */
function removeSocialPrompts(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "share-on",
      pattern: /^.{0,30}(?:share (?:on|this)|share this article|share this post|share via)\b.{0,60}$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "follow-us",
      pattern: /^.{0,30}(?:follow us on|connect with us on|find us on)\b.{0,60}$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "social-links",
      pattern: /^.{0,10}\[(?:twitter|x|linkedin|facebook|github|youtube|reddit|discord|slack)\]\([^)]*\)\s*$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }

  return result;
}

/**
 * Removes newsletter and signup CTA sections.
 *
 * @remarks
 * Matches common newsletter signup prompts embedded in article content.
 */
function removeNewsletterCTAs(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "newsletter-heading",
      pattern: /^#{1,6}\s+(?:subscribe|newsletter|get notified|stay updated|join (?:our|the)\s+\w+)\s*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "newsletter-body",
      pattern: /^.{0,30}(?:subscribe to (?:our|the|this)\s+\w+|enter your email|email address|sign up for|get the latest|delivered to your inbox|join \d+ (?:developers|readers|subscribers))\b.{0,80}$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }

  return result;
}

/**
 * Removes "Edit on GitHub" / "Improve this page" links from documentation.
 *
 * @remarks
 * These links appear on nearly every documentation site and contribute no
 * informational value to research. Matches both markdown links and plain text.
 */
function removeEditModeLinks(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "edit-github-link",
      // [Edit this page](https://github.com/...) or [Edit on GitHub](https://github.com/...)
      pattern: /\[(?:edit (?:this page|on github|this page on github)|improve this page)\]\([^)]*github\.com[^)]*\)\s*\n?/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "edit-plain-text",
      // "Edit this page on GitHub" as plain text (no markdown link)
      pattern: /^\s*edit (?:this page)(?:\s+on\s+github)?\s*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "improve-plain-text",
      // "Improve this page" as plain text
      pattern: /^\s*improve this page\s*$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }
  return result;
}

/**
 * Removes "Was this helpful?" / feedback prompt sections.
 *
 * @remarks
 * Many documentation sites include thumbs-up/down or text feedback prompts
 * that are noise in research content.
 */
function removeFeedbackPrompts(content: string): string {
  let result = content;

  // Remove "Was this helpful?" heading + follow-up line (but only the next short line)
  // The (page|article|...) qualifier is optional since "Was this helpful?" alone is common
  result = result.replace(
    /^#{1,6}\s+was this (?:page|article|doc|content|guide|section)?\s*helpful\??\s*\n(?:^.{0,120}\n)?/gim,
    "",
  );

  // Standalone "Was this helpful?" without heading markers
  result = result.replace(
    /^.{0,30}was this (?:page|article|doc|content|guide)?\s*helpful\??.{0,40}$/gim,
    "",
  );

  // "Let us know if this page was helpful. Yes No" pattern
  result = result.replace(
    /^.{0,30}(?:let us know|tell us|please let us know) if this (?:page|article|doc|content) was helpful.{0,40}(?:yes|no)\s*(?:yes|no)?\s*$/gim,
    "",
  );

  return result;
}

/** Returns trimmed markdown heading text without leading `#` markers, or null when not a heading. */
function cleanWebContent_plainMarkdownHeadingText(line: string): string | null {
  const match = /^#{1,6}\s+(.+?)\s*$/i.exec(line);
  return match ? match[1].trim() : null;
}

/** True when a markdown heading line introduces a "related reading" link farm section. */
function cleanWebContent_isMarkdownRelatedArticlesHeadingLine(line: string): boolean {
  const text = cleanWebContent_plainMarkdownHeadingText(line);
  if (!text) {
    return false;
  }
  const t = text.toLowerCase();
  if (t === "see also" || t === "further reading" || t === "recommended reading") {
    return true;
  }
  if (t === "you might also like" || t === "you might also enjoy") {
    return true;
  }
  if (t === "more like this" || t === "more from" || t === "more articles" || t === "more posts") {
    return true;
  }
  if (t === "other articles" || t === "other resources" || t === "other posts") {
    return true;
  }
  if (t.startsWith("related ")) {
    const rest = t.slice("related ".length);
    return (
      rest === "article"
      || rest === "articles"
      || rest === "post"
      || rest === "posts"
      || rest === "content"
      || rest === "links"
      || rest === "resources"
    );
  }
  return false;
}

/** True when a line is a markdown bullet (`- `) with any non-empty body. */
function cleanWebContent_isRelatedArticlesBulletLine(line: string): boolean {
  return /^\s*-\s+.+$/.test(line);
}

/**
 * Removes a markdown "related articles" heading plus its following bullet list
 * (1–10 bullets), mirroring the legacy single-regex block matcher.
 */
function cleanWebContent_stripMarkdownRelatedArticlesSections(content: string): string {
  const { lines, separator } = cleanWebContent_splitLinesPreserveSeparators(content);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!cleanWebContent_isMarkdownRelatedArticlesHeadingLine(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    let j = i + 1;
    if (j < lines.length && lines[j].trim() === "") {
      j += 1;
    }
    let bulletCount = 0;
    while (j < lines.length && bulletCount < 10 && cleanWebContent_isRelatedArticlesBulletLine(lines[j])) {
      bulletCount += 1;
      j += 1;
    }
    if (bulletCount >= 1) {
      i = j;
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join(separator);
}

/**
 * Removes "Related Articles" / "See also" / "Further reading" sections.
 *
 * @remarks
 * These sections link to other pages but don't contain the content the agent
 * is researching. They add noise without informational value.
 */
function removeRelatedSections(content: string): string {
  return cleanWebContent_stripMarkdownRelatedArticlesSections(content);
}

/** True when heading text names a common inline table-of-contents chrome title. */
function cleanWebContent_isMarkdownTocHeadingText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "table of contents"
    || t === "contents"
    || t === "in this article"
    || t === "in this section"
    || t === "on this page"
    || t === "overview"
  );
}

/** Plain-text TOC title line (no `#` heading) for the non-anchor TOC pass. */
function cleanWebContent_isPlainTocTitleLine(line: string): boolean {
  const t = line.trim().toLowerCase();
  return (
    t === "table of contents"
    || t === "contents"
    || t === "in this article"
    || t === "in this section"
    || t === "on this page"
  );
}

/** True for `- [label](#anchor)` TOC bullets used under markdown TOC headings. */
function cleanWebContent_isTocAnchorLinkBulletLine(line: string): boolean {
  return /^\s*-\s+\[.+?\]\(#.+?\)\s*$/.test(line);
}

/** True for plain `- item` bullets consumed after a plain-text TOC title line. */
function cleanWebContent_isTocPlainBulletLine(line: string): boolean {
  return /^\s*-\s+.+$/.test(line);
}

/**
 * Removes markdown/plain TOC blocks that mirror the legacy regex passes:
 * - `#`..`###` TOC headings require 2–20 internal-anchor bullet lines.
 * - Plain TOC titles require 2–20 bullet lines (any text).
 */
function cleanWebContent_stripMarkdownInlineTocBlocks(content: string): string {
  const { lines, separator } = cleanWebContent_splitLinesPreserveSeparators(content);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const headingMatch = /^#{1,3}\s+(.+?)\s*$/i.exec(lines[i]);
    if (headingMatch && cleanWebContent_isMarkdownTocHeadingText(headingMatch[1])) {
      let j = i + 1;
      if (j < lines.length && lines[j].trim() === "") {
        j += 1;
      }
      let bullets = 0;
      while (j < lines.length && bullets < 20 && cleanWebContent_isTocAnchorLinkBulletLine(lines[j])) {
        bullets += 1;
        j += 1;
      }
      if (bullets >= 2) {
        i = j;
        continue;
      }
    }
    if (cleanWebContent_isPlainTocTitleLine(lines[i])) {
      let j = i + 1;
      if (j < lines.length && lines[j].trim() === "") {
        j += 1;
      }
      let bullets = 0;
      while (j < lines.length && bullets < 20 && cleanWebContent_isTocPlainBulletLine(lines[j])) {
        bullets += 1;
        j += 1;
      }
      if (bullets >= 2) {
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join(separator);
}

/**
 * Removes inline Table of Contents blocks.
 *
 * @remarks
 * Some pages render a markdown TOC as a list of internal links at the top.
 * These duplicate the document structure without adding research value.
 */
function removeInlineTOC(content: string): string {
  return cleanWebContent_stripMarkdownInlineTocBlocks(content);
}

/**
 * Removes "Copy" / "Copied!" buttons that appear after code blocks.
 *
 * @remarks
 * Many documentation sites render copy buttons as text in markdown output.
 * These lines contain only "Copy" or "Copied!" and add no value.
 */
function removeCopyButtons(content: string): string {
  // Standalone "Copy" or "Copied!" on its own line (common in docs sites)
  return content.replace(/^\s*(?:copy|copied!?)\s*$/gim, "");
}

/**
 * Removes pagination links (Previous/Next page navigation).
 *
 * @remarks
 * Many docs sites include "← Previous: X | Next: Y →" navigation at the bottom
 * of pages. These are site navigation, not research content.
 */
function removePagination(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "prev-next-arrows",
      // ← Previous: X | Next: Y → (with arrows)
      pattern: /^.{0,30}←\s*(?:previous|prev)[:\s]*[^|\n]*?(?:\|\s*(?:next)[:\s]*[^→\n]*→)?\s*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "prev-next-pipe",
      // Previous: X | Next: Y (without arrows)
      pattern: /^.{0,30}(?:previous|prev)[:\s]*[^\n]+?\|\s*(?:next)[:\s]*[^\n]+$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "next-page-heading",
      // "Next page" or "Previous page" as standalone lines
      pattern: /^\s*(?:next|previous|prev)\s+(?:page|chapter|section|article|post)\s*$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }
  return result;
}

/**
 * Removes "Back to top" scroll links.
 *
 * @remarks
 * These are anchor links that scroll to the top of the page.
 */
function removeBackToTop(content: string): string {
  return content.replace(
    /^\s*\[?back to top\]?[^\n]*$/gim,
    "",
  );
}

/**
 * Removes sponsor/credit sections from content.
 *
 * @remarks
 * Sponsor blocks and "Powered by" sections are marketing, not research content.
 */
function removeSponsors(content: string): string {
  const patterns: CleaningPass[] = [
    {
      apply: true,
      name: "sponsor-heading",
      pattern: /^#{1,6}\s+(?:sponsors?|backers?|supporters?|become a sponsor|our sponsors|gold sponsors|silver sponsors|bronze sponsors|special thanks)\s*$/gim,
      replacement: "",
    },
    {
      apply: true,
      name: "sponsor-line",
      // Sponsor listing lines like "Gold sponsors: Vercel, AWS"
      pattern: /^.{0,20}(?:gold|silver|bronze|platinum)\s+sponsors?:\s*.{1,100}$/gim,
      replacement: "",
    },
  ];

  let result = content;
  for (const pass of patterns) {
    if (pass.apply) {
      result = result.replace(pass.pattern, pass.replacement);
    }
  }
  return result;
}

/**
 * Normalizes whitespace: collapses excessive blank lines and trims trailing
 * whitespace from each line.
 *
 * @remarks
 * Preserves intentional paragraph breaks (one blank line) but collapses
 * sequences of 3+ blank lines to 2 (one blank line). Also strips trailing
 * spaces from each line.
 */
function normalizeWhitespace(content: string): string {
  let result = content;

  // Trim trailing whitespace from each line
  result = result.replace(/[ \t]+$/gm, "");

  // Collapse 3+ consecutive blank lines to 2 (one visual blank line)
  result = result.replace(/\n{3,}/g, "\n\n");

  // Remove leading blank lines
  result = result.replace(/^\n+/, "");

  // Remove trailing blank lines
  result = result.replace(/\n+$/, "");

  return result;
}

/**
 * Cleans web page content by stripping navigation chrome, cookie banners,
 * footers, social prompts, newsletter CTAs, and excessive whitespace.
 *
 * @remarks
 * The cleaner operates on plain text and markdown content using regex-based
 * heuristics. It is deliberately conservative: false negatives (missed
 * boilerplate) are preferred over false positives (removing real content).
 *
 * For structured JSON content (from `web_search`), only whitespace
 * normalization is applied unless explicitly requested.
 *
 * @param content - The raw web page content to clean.
 * @param options - Which cleaning passes to apply. Defaults to all passes enabled.
 * @returns The cleaned content string.
 */
export function cleanWebContent(content: string, options: CleanOptions = {}): string {
  // For search-result JSON, only normalize whitespace by default
  if (options.source === "search") {
    if (options.normalizeWhitespace !== false) {
      return normalizeWhitespace(content);
    }
    return content;
  }

  let result = content;

  if (options.removeCookieBanners !== false) {
    result = removeCookieBanners(result);
  }

  if (options.removeNavigation !== false) {
    result = removeNavigation(result);
  }

  if (options.removeFooters !== false) {
    result = removeFooters(result);
  }

  if (options.removeSocialPrompts !== false) {
    result = removeSocialPrompts(result);
  }

  if (options.removeNewsletterCTAs !== false) {
    result = removeNewsletterCTAs(result);
  }

  if (options.removeEditModeLinks !== false) {
    result = removeEditModeLinks(result);
  }

  if (options.removeFeedbackPrompts !== false) {
    result = removeFeedbackPrompts(result);
  }

  if (options.removeRelatedSections !== false) {
    result = removeRelatedSections(result);
  }

  if (options.removeCopyButtons !== false) {
    result = removeCopyButtons(result);
  }

  if (options.removePagination !== false) {
    result = removePagination(result);
  }

  if (options.removeInlineTOC !== false) {
    result = removeInlineTOC(result);
  }

  if (options.removeBackToTop !== false) {
    result = removeBackToTop(result);
  }

  if (options.removeSponsors !== false) {
    result = removeSponsors(result);
  }

  if (options.normalizeWhitespace !== false) {
    result = normalizeWhitespace(result);
  }

  return result;
}

/**
 * CLI entry point for standalone content cleaning.
 *
 * @remarks
 * Reads content from `--content` string or `--file` path, applies cleaning,
 * and writes to stdout or an output file. Useful for one-off cleaning of
 * fetched pages without a full research session.
 */
function main(): void {
  const { values } = parseArgs({
    options: {
      content: { type: "string", short: "c" },
      file: { type: "string", short: "f" },
      output: { type: "string", short: "o" },
      source: { type: "string", short: "s" },
      "no-cookie": { type: "boolean" },
      "no-nav": { type: "boolean" },
      "no-footer": { type: "boolean" },
      "no-social": { type: "boolean" },
      "no-newsletter": { type: "boolean" },
      "no-edit-links": { type: "boolean" },
      "no-feedback": { type: "boolean" },
      "no-related": { type: "boolean" },
      "no-copy-buttons": { type: "boolean" },
      "no-pagination": { type: "boolean" },
      "no-toc": { type: "boolean" },
      "no-back-to-top": { type: "boolean" },
      "no-sponsors": { type: "boolean" },
      "no-whitespace": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage:
  # Clean content from a file
  npx tsx skills/research-online/scripts/clean-web-content.ts \\
    --file /tmp/page.md --source fetch

  # Clean inline content
  npx tsx skills/research-online/scripts/clean-web-content.ts \\
    --source fetch --content "# Page Title\\nCookie Notice\\nWe use cookies..."

  # Clean and write to output file
  npx tsx skills/research-online/scripts/clean-web-content.ts \\
    --file /tmp/page.md --output /tmp/page-clean.md

Options:
  --content, -c      Inline string content to clean (alternative to --file)
  --file, -f         Path to a file to clean
  --output, -o       Path to write cleaned output (default: stdout)
  --source, -s       Content source: "fetch" (default), "search", or "hybrid"
  --no-cookie          Skip cookie banner removal
  --no-nav             Skip navigation removal
  --no-footer          Skip footer removal
  --no-social          Skip social prompt removal
  --no-newsletter      Skip newsletter CTA removal
  --no-edit-links      Skip "Edit on GitHub" link removal
  --no-feedback        Skip feedback prompt removal
  --no-related         Skip related articles removal
  --no-copy-buttons    Skip "Copy" button removal
  --no-pagination      Skip pagination removal
  --no-toc             Skip inline TOC removal
  --no-back-to-top     Skip "Back to top" removal
  --no-sponsors        Skip sponsor section removal
  --no-whitespace     Skip whitespace normalization
  --help, -h          Show this help
`);
    return;
  }

  let content: string;

  if (typeof values.file === "string") {
    const resolvedPath = path.resolve(values.file);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      throw new Error(`File not found: ${values.file}`);
    }
    content = fs.readFileSync(resolvedPath, "utf8");
  } else if (typeof values.content === "string") {
    content = values.content;
  } else {
    throw new Error("Either --content or --file is required");
  }

  const source = values.source === "search" || values.source === "hybrid"
    ? values.source as "search" | "hybrid"
    : "fetch";

  const options: CleanOptions = {
    source,
    removeCookieBanners: values["no-cookie"] !== true,
    removeNavigation: values["no-nav"] !== true,
    removeFooters: values["no-footer"] !== true,
    removeSocialPrompts: values["no-social"] !== true,
    removeNewsletterCTAs: values["no-newsletter"] !== true,
    removeEditModeLinks: values["no-edit-links"] !== true,
    removeFeedbackPrompts: values["no-feedback"] !== true,
    removeRelatedSections: values["no-related"] !== true,
    removeCopyButtons: values["no-copy-buttons"] !== true,
    removePagination: values["no-pagination"] !== true,
    removeInlineTOC: values["no-toc"] !== true,
    removeBackToTop: values["no-back-to-top"] !== true,
    removeSponsors: values["no-sponsors"] !== true,
    normalizeWhitespace: values["no-whitespace"] !== true,
  };

  const cleaned = cleanWebContent(content, options);

  const reduction = content.length - cleaned.length;
  const percent = content.length > 0 ? ((reduction / content.length) * 100).toFixed(1) : "0.0";

  if (typeof values.output === "string") {
    const outputPath = path.resolve(values.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, cleaned, "utf8");
    console.log(`Cleaned content saved to: ${outputPath}`);
  } else {
    process.stdout.write(cleaned);
  }

  console.error(`Reduced from ${content.length} to ${cleaned.length} chars (${reduction} removed, ${percent}% reduction)`);
}

try {
  // Only run CLI when executed directly, not when imported as a module
  if (process.argv[1]?.endsWith("clean-web-content.ts") || process.argv[1]?.endsWith("clean-web-content.js")) {
    main();
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}