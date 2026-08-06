import Papa from "papaparse";
import type { MetaResult } from "@/types/meta";

const BASE_COLUMNS = [
  "url",
  "status_code",
  "page_type",
  "primary_topic",
  "existing_meta_title",
  "existing_meta_description",
  "recommended_meta_title",
  "recommended_meta_description",
  "title_length",
  "description_length",
  "seo_score",
  "warnings",
  "canonical_url",
  "crawl_status",
] as const;

export function resultsToCsv(results: MetaResult[]): string {
  const extraColumnNames = new Set<string>();
  for (const r of results) {
    if (r.extraColumns) {
      for (const key of Object.keys(r.extraColumns)) extraColumnNames.add(key);
    }
  }
  const extraColumns = Array.from(extraColumnNames);
  const columns = [...BASE_COLUMNS, ...extraColumns];

  const rows = results.map((r) => {
    const row: Record<string, string | number> = {
      url: r.url,
      status_code: r.httpStatus ?? "",
      page_type: r.pageType ?? "",
      primary_topic: r.primaryTopic ?? "",
      existing_meta_title: r.existingTitle ?? "",
      existing_meta_description: r.existingDescription ?? "",
      recommended_meta_title: r.recommendedTitle ?? "",
      recommended_meta_description: r.recommendedDescription ?? "",
      title_length: r.titleLength ?? "",
      description_length: r.descriptionLength ?? "",
      seo_score: r.seoScore ?? "",
      warnings: (r.warnings ?? []).join("; "),
      canonical_url: r.canonicalUrl ?? "",
      crawl_status: r.crawlStatus ?? (r.status === "failed" ? "failed" : ""),
    };
    for (const key of extraColumns) {
      row[key] = r.extraColumns?.[key] ?? "";
    }
    return row;
  });

  return Papa.unparse({ fields: columns, data: rows });
}
