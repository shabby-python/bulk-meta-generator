import Papa from "papaparse";

export interface ParsedCsvUrl {
  url: string;
  extraColumns: Record<string, string>;
}

export interface ParseCsvResult {
  urls: ParsedCsvUrl[];
  urlColumn: string | null;
  totalRows: number;
  skippedRows: number;
}

const URL_COLUMN_CANDIDATES = ["url", "urls", "link", "page url", "page_url"];

function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * Parses a CSV of URLs. Looks for a column named "url" (case-insensitive,
 * a few common aliases accepted); if none exists, falls back to the first
 * column whose values are mostly valid URLs. Any other columns are kept as
 * extraColumns so they can be preserved in the export.
 */
export function parseCsvUrls(csvText: string): ParseCsvResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const rows = parsed.data;

  let urlColumn = fields.find((f) => URL_COLUMN_CANDIDATES.includes(f.trim().toLowerCase())) ?? null;

  if (!urlColumn && fields.length > 0) {
    for (const field of fields) {
      const sample = rows.slice(0, 25).map((r) => r[field] ?? "");
      const validCount = sample.filter(looksLikeUrl).length;
      if (sample.length > 0 && validCount / sample.length >= 0.6) {
        urlColumn = field;
        break;
      }
    }
  }

  if (!urlColumn) {
    return { urls: [], urlColumn: null, totalRows: rows.length, skippedRows: rows.length };
  }

  const urls: ParsedCsvUrl[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const raw = (row[urlColumn] ?? "").trim();
    if (!looksLikeUrl(raw)) {
      skippedRows++;
      continue;
    }
    const extraColumns: Record<string, string> = {};
    for (const field of fields) {
      if (field !== urlColumn) extraColumns[field] = row[field] ?? "";
    }
    const normalized = raw.includes("://") ? raw : `https://${raw}`;
    urls.push({ url: normalized, extraColumns });
  }

  return { urls, urlColumn, totalRows: rows.length, skippedRows };
}

/** Parses a plain textarea of one-URL-per-line input. */
export function parsePlainTextUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.includes("://") ? line : `https://${line}`));
}
