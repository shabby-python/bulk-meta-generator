import * as cheerio from "cheerio";
import type { ExtractedContent } from "./types";

const MAIN_TEXT_CHAR_LIMIT = 4000;
const MAX_HEADINGS = 12;

const BOILERPLATE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='gdpr']",
  "[class*='newsletter']",
  "[class*='popup']",
  "[class*='modal']",
  ".sidebar",
  "#sidebar",
].join(", ");

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function absolutize(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return undefined;
  }
}

function extractJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") nodes.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])) {
          for (const item of (parsed as { "@graph": unknown[] })["@graph"]) {
            if (item && typeof item === "object") nodes.push(item as Record<string, unknown>);
          }
        } else {
          nodes.push(parsed as Record<string, unknown>);
        }
      }
    } catch {
      // Malformed JSON-LD is common on the open web; skip silently.
    }
  });
  return nodes;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return undefined;
}

function detectFromJsonLd(jsonLd: Record<string, unknown>[]) {
  let productName: string | undefined;
  let brandName: string | undefined;
  let categoryName: string | undefined;
  let breadcrumb: string | undefined;

  for (const node of jsonLd) {
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    const typeStr = types.filter((t) => typeof t === "string").join(",").toLowerCase();

    if (!productName && typeStr.includes("product")) {
      productName = firstString(node.name);
      if (!brandName && node.brand) brandName = firstString(node.brand);
      if (!categoryName && node.category) categoryName = firstString(node.category);
    }
    if (!brandName && typeStr.includes("organization")) {
      brandName = firstString(node.name);
    }
    if (!breadcrumb && typeStr.includes("breadcrumblist")) {
      const items = node.itemListElement;
      if (Array.isArray(items)) {
        const names = items
          .map((item) => firstString((item as Record<string, unknown>)?.name) ?? firstString(item))
          .filter((n): n is string => Boolean(n));
        if (names.length) breadcrumb = names.join(" > ");
      }
    }
  }

  return { productName, brandName, categoryName, breadcrumb };
}

export function extractContent(
  html: string,
  requestedUrl: string,
  finalUrl: string,
  httpStatus: number
): ExtractedContent {
  const $ = cheerio.load(html);

  const existingTitle = cleanText($("head > title").first().text()) || undefined;
  const existingDescription =
    $("meta[name='description']").attr("content")?.trim() ||
    $("meta[name='Description']").attr("content")?.trim() ||
    undefined;
  const canonicalUrl = absolutize($("link[rel='canonical']").attr("href"), finalUrl);
  const ogTitle = $("meta[property='og:title']").attr("content")?.trim() || undefined;
  const ogDescription = $("meta[property='og:description']").attr("content")?.trim() || undefined;
  const ogSiteName = $("meta[property='og:site_name']").attr("content")?.trim() || undefined;

  const jsonLd = extractJsonLd($);
  const fromJsonLd = detectFromJsonLd(jsonLd);

  // Strip boilerplate before pulling headings/body text so nav/footer/cookie
  // banners don't pollute what gets sent to the model.
  $(BOILERPLATE_SELECTORS).remove();

  const h1 = cleanText($("h1").first().text()) || undefined;
  const headings: string[] = [];
  $("h2").each((_, el) => {
    if (headings.length >= MAX_HEADINGS) return;
    const text = cleanText($(el).text());
    if (text) headings.push(text);
  });

  let breadcrumb = fromJsonLd.breadcrumb;
  if (!breadcrumb) {
    const candidate = $(
      "[class*='breadcrumb'], [id*='breadcrumb'], [aria-label='breadcrumb' i], nav[aria-label*='breadcrumb' i]"
    )
      .first()
      .text();
    const cleaned = cleanText(candidate);
    if (cleaned && cleaned.length < 300) breadcrumb = cleaned;
  }

  const productName =
    fromJsonLd.productName ||
    cleanText($("[class*='product-title'], [class*='product-name'], [itemprop='name']").first().text()) ||
    undefined;

  const brandName =
    fromJsonLd.brandName ||
    ogSiteName ||
    $("meta[name='application-name']").attr("content")?.trim() ||
    undefined;

  const categoryName =
    fromJsonLd.categoryName ||
    cleanText($("[class*='category-title'], [class*='category-name']").first().text()) ||
    undefined;

  const siteName = ogSiteName || brandName || new URL(finalUrl).hostname.replace(/^www\./, "");

  const bodyText = cleanText($("body").text());
  const mainText = bodyText.slice(0, MAIN_TEXT_CHAR_LIMIT);

  return {
    requestedUrl,
    finalUrl,
    httpStatus,
    canonicalUrl,
    existingTitle,
    existingDescription,
    h1,
    headings,
    ogTitle,
    ogDescription,
    mainText,
    siteName,
    breadcrumb,
    productName: productName || undefined,
    categoryName: categoryName || undefined,
    brandName,
  };
}
