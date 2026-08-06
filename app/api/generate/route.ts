import { NextResponse } from "next/server";
import { crawlOne } from "@/lib/crawler/crawl";
import { getAiProvider } from "@/lib/ai/provider";
import { checkTitle, checkDescription, checkTechnical } from "@/lib/seo/validate";
import { scoreFromWarnings } from "@/lib/seo/score";
import type { MetaResult } from "@/types/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalize(text: string | undefined): string {
  return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const MAX_DESCRIPTION_LENGTH = 160;

/** Safety net in case the model exceeds the hard length cap despite the prompt instruction. */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return cut.replace(/[\s,;:.!?-]+$/, "").trim();
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { url?: unknown; id?: unknown; extraColumns?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const id = typeof body.id === "string" && body.id ? body.id : crypto.randomUUID();
  const extraColumns =
    body.extraColumns && typeof body.extraColumns === "object"
      ? (body.extraColumns as Record<string, string>)
      : undefined;

  if (!url) {
    return NextResponse.json({
      result: {
        id,
        url: String(body.url ?? ""),
        status: "failed",
        crawlStatus: "failed",
        error: "Missing or empty URL",
        warnings: ["Missing or empty URL"],
        seoScore: 0,
        extraColumns,
      },
    });
  }

  const crawled = await crawlOne(url);

  if (!crawled.ok) {
    const warnings = checkTechnical({ crawlStatus: "failed" }).map((w) => w.message);
    const result: MetaResult = {
      id,
      url,
      status: "failed",
      crawlStatus: "failed",
      error: crawled.error.message,
      httpStatus: crawled.error.httpStatus,
      warnings,
      seoScore: 0,
      extraColumns,
    };
    return NextResponse.json({ result });
  }

  const page = crawled.data;

  try {
    const provider = getAiProvider();
    const ai = await provider.generateMeta({
      url: page.finalUrl,
      existingTitle: page.existingTitle,
      existingDescription: page.existingDescription,
      h1: page.h1,
      headings: page.headings,
      ogTitle: page.ogTitle,
      ogDescription: page.ogDescription,
      mainText: page.mainText,
      siteName: page.siteName,
      canonical: page.canonicalUrl,
      breadcrumb: page.breadcrumb,
      productName: page.productName,
      categoryName: page.categoryName,
      brandName: page.brandName,
    });

    const description = truncateAtWordBoundary(ai.description, MAX_DESCRIPTION_LENGTH);

    const titleChanged = normalize(page.existingTitle) !== normalize(ai.title);
    const descriptionChanged = normalize(page.existingDescription) !== normalize(description);

    const sourceText = [page.mainText, page.existingTitle, page.existingDescription].filter(Boolean).join(" ");
    const warnings = [
      ...checkTechnical({
        crawlStatus: "success",
        existingTitle: page.existingTitle,
        existingDescription: page.existingDescription,
        canonicalUrl: page.canonicalUrl,
        finalUrl: page.finalUrl,
      }),
      ...checkTitle(ai.title, ai.primaryTopic),
      ...checkDescription(description, ai.primaryTopic, sourceText),
    ];

    const result: MetaResult = {
      id,
      url,
      status: "completed",
      httpStatus: page.httpStatus,
      finalUrl: page.finalUrl,
      canonicalUrl: page.canonicalUrl,
      pageType: ai.pageType,
      primaryTopic: ai.primaryTopic,
      secondaryConcepts: ai.secondaryConcepts,
      brandName: ai.brandName ?? page.brandName,
      existingTitle: page.existingTitle,
      existingDescription: page.existingDescription,
      recommendedTitle: ai.title,
      recommendedDescription: description,
      titleLength: ai.title.length,
      descriptionLength: description.length,
      titleChanged,
      descriptionChanged,
      seoScore: scoreFromWarnings(warnings),
      warnings: warnings.map((w) => w.message),
      crawlStatus: "success",
      extraColumns,
      updatedAt: Date.now(),
    };
    return NextResponse.json({ result });
  } catch (err) {
    const result: MetaResult = {
      id,
      url,
      status: "failed",
      httpStatus: page.httpStatus,
      finalUrl: page.finalUrl,
      canonicalUrl: page.canonicalUrl,
      existingTitle: page.existingTitle,
      existingDescription: page.existingDescription,
      error: `AI generation failed: ${(err as Error).message}`,
      warnings: ["AI generation failed"],
      seoScore: 0,
      crawlStatus: "success",
      extraColumns,
    };
    return NextResponse.json({ result });
  }
}
