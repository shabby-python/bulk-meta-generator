import { findDuplicateIds } from "./duplicates";
import { scoreFromWarnings } from "./score";

export type WarningSeverity = "minor" | "moderate" | "major";

export interface SeoWarning {
  code: string;
  message: string;
  severity: WarningSeverity;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "this", "that",
  "from", "into", "of", "a", "an", "to", "in", "on", "at", "is", "it", "as",
  "by", "or", "we", "us", "all", "best",
]);

const CLAIM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b\d{1,3}%\s*(off|discount)\b/i, label: "percentage discount" },
  { pattern: /\bfree\s+shipping\b/i, label: "free shipping" },
  { pattern: /\bmoney[-\s]?back\s+guarantee\b/i, label: "money-back guarantee" },
  { pattern: /\blifetime\s+warranty\b/i, label: "lifetime warranty" },
  { pattern: /\b#1\b/i, label: "#1 ranking claim" },
  { pattern: /\baward[-\s]?winning\b/i, label: "award-winning claim" },
  { pattern: /\b(certified|guaranteed)\b/i, label: "guarantee/certification claim" },
  { pattern: /\b\d+%\s*(off|savings?)\b/i, label: "percentage savings" },
];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function hasKeywordStuffing(text: string, maxRepeats: number): string | undefined {
  const counts = new Map<string, number>();
  for (const w of words(text)) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const [word, count] of counts) {
    if (count > maxRepeats) return word;
  }
  return undefined;
}

function hasExcessivePunctuation(text: string): boolean {
  if (/[!?]{2,}/.test(text)) return true;
  if (/\.{4,}/.test(text)) return true;
  const capsWords = text.split(/\s+/).filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  return capsWords.length > 2;
}

function topicPresent(text: string | undefined, primaryTopic: string | undefined): boolean {
  if (!primaryTopic) return true;
  if (!text) return false;
  const topicWords = words(primaryTopic);
  if (topicWords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return topicWords.some((w) => lowerText.includes(w));
}

export function checkTitle(title: string | undefined, primaryTopic: string | undefined): SeoWarning[] {
  const warnings: SeoWarning[] = [];
  if (!title || !title.trim()) {
    warnings.push({ code: "title_missing", message: "Recommended title is missing", severity: "major" });
    return warnings;
  }
  const len = title.length;
  if (len < 30) {
    warnings.push({ code: "title_too_short", message: `Title is short (${len} chars)`, severity: "minor" });
  } else if (len > 70) {
    warnings.push({ code: "title_too_long", message: `Title may be truncated in search results (${len} chars)`, severity: "moderate" });
  }
  if (!topicPresent(title, primaryTopic)) {
    warnings.push({ code: "title_missing_topic", message: "Title does not clearly reflect the page's main topic", severity: "moderate" });
  }
  const stuffed = hasKeywordStuffing(title, 2);
  if (stuffed) {
    warnings.push({ code: "title_keyword_stuffing", message: `Possible keyword stuffing in title ("${stuffed}" repeated)`, severity: "moderate" });
  }
  if (hasExcessivePunctuation(title)) {
    warnings.push({ code: "title_excessive_punctuation", message: "Title has excessive punctuation or all-caps words", severity: "minor" });
  }
  return warnings;
}

export function checkDescription(
  description: string | undefined,
  primaryTopic: string | undefined,
  sourceText?: string
): SeoWarning[] {
  const warnings: SeoWarning[] = [];
  if (!description || !description.trim()) {
    warnings.push({ code: "description_missing", message: "Recommended description is missing", severity: "major" });
    return warnings;
  }
  const len = description.length;
  if (len < 70) {
    warnings.push({ code: "description_too_short", message: `Description is short (${len} chars)`, severity: "minor" });
  } else if (len > 160) {
    warnings.push({ code: "description_too_long", message: `Description exceeds the 160 character guideline (${len} chars)`, severity: "moderate" });
  }
  if (!topicPresent(description, primaryTopic)) {
    warnings.push({ code: "description_missing_topic", message: "Description does not clearly reflect the page's main topic", severity: "moderate" });
  }
  const stuffed = hasKeywordStuffing(description, 3);
  if (stuffed) {
    warnings.push({ code: "description_keyword_stuffing", message: `Possible keyword stuffing in description ("${stuffed}" repeated)`, severity: "moderate" });
  }
  if (sourceText) {
    const haystack = sourceText.toLowerCase();
    for (const { pattern, label } of CLAIM_PATTERNS) {
      if (pattern.test(description) && !pattern.test(haystack)) {
        warnings.push({
          code: "description_unsupported_claim",
          message: `Description may contain an unsupported claim (${label})`,
          severity: "major",
        });
      }
    }
  }
  return warnings;
}

export interface TechnicalCheckInput {
  crawlStatus: "success" | "failed";
  existingTitle?: string;
  existingDescription?: string;
  canonicalUrl?: string;
  finalUrl?: string;
}

export function checkTechnical(input: TechnicalCheckInput): SeoWarning[] {
  const warnings: SeoWarning[] = [];
  if (input.crawlStatus === "failed") {
    warnings.push({ code: "crawl_failed", message: "URL could not be crawled", severity: "major" });
    return warnings;
  }
  if (!input.existingTitle) {
    warnings.push({ code: "existing_title_missing", message: "Existing page has no <title> tag", severity: "moderate" });
  }
  if (!input.existingDescription) {
    warnings.push({ code: "existing_description_missing", message: "Existing page has no meta description", severity: "moderate" });
  }
  if (input.canonicalUrl && input.finalUrl) {
    try {
      const canonical = new URL(input.canonicalUrl);
      const final = new URL(input.finalUrl);
      if (canonical.origin + canonical.pathname.replace(/\/$/, "") !== final.origin + final.pathname.replace(/\/$/, "")) {
        warnings.push({ code: "canonical_mismatch", message: "Canonical URL differs from the crawled URL", severity: "minor" });
      }
    } catch {
      // ignore malformed canonical
    }
  }
  return warnings;
}

export interface EvaluatableResult {
  id: string;
  crawlStatus: "success" | "failed";
  existingTitle?: string;
  existingDescription?: string;
  recommendedTitle?: string;
  recommendedDescription?: string;
  primaryTopic?: string;
  canonicalUrl?: string;
  finalUrl?: string;
  mainText?: string;
}

export interface EvaluationOutcome {
  warnings: string[];
  seoScore: number;
}

/**
 * Runs every deterministic SEO check across a full batch, including checks
 * that only make sense with cross-batch context (duplicate current/recommended
 * titles and descriptions). Safe to re-run on the client whenever the result
 * set changes (e.g. after edits, retries, or regeneration).
 */
export function evaluateBatch(results: EvaluatableResult[]): Map<string, EvaluationOutcome> {
  const duplicateExistingTitles = findDuplicateIds(results.map((r) => ({ id: r.id, value: r.existingTitle })));
  const duplicateExistingDescriptions = findDuplicateIds(
    results.map((r) => ({ id: r.id, value: r.existingDescription }))
  );
  const duplicateRecommendedTitles = findDuplicateIds(
    results.map((r) => ({ id: r.id, value: r.recommendedTitle }))
  );
  const duplicateRecommendedDescriptions = findDuplicateIds(
    results.map((r) => ({ id: r.id, value: r.recommendedDescription }))
  );

  const outcomes = new Map<string, EvaluationOutcome>();

  for (const result of results) {
    const warnings: SeoWarning[] = [];
    warnings.push(...checkTechnical(result));

    if (result.crawlStatus === "success") {
      warnings.push(...checkTitle(result.recommendedTitle, result.primaryTopic));
      warnings.push(...checkDescription(result.recommendedDescription, result.primaryTopic, result.mainText));

      if (duplicateExistingTitles.has(result.id)) {
        warnings.push({ code: "duplicate_existing_title", message: "Existing title is duplicated across URLs in this batch", severity: "minor" });
      }
      if (duplicateExistingDescriptions.has(result.id)) {
        warnings.push({ code: "duplicate_existing_description", message: "Existing description is duplicated across URLs in this batch", severity: "minor" });
      }
      if (duplicateRecommendedTitles.has(result.id)) {
        warnings.push({ code: "duplicate_recommended_title", message: "Recommended title duplicates another URL's recommended title", severity: "moderate" });
      }
      if (duplicateRecommendedDescriptions.has(result.id)) {
        warnings.push({ code: "duplicate_recommended_description", message: "Recommended description duplicates another URL's recommended description", severity: "moderate" });
      }
    }

    outcomes.set(result.id, {
      warnings: warnings.map((w) => w.message),
      seoScore: scoreFromWarnings(warnings),
    });
  }

  return outcomes;
}
