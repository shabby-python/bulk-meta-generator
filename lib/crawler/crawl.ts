import { safeFetchPage, CrawlFailure } from "./fetch-page";
import { extractContent } from "./extract-content";
import type { CrawlOutcome } from "./types";

/** Fetches and extracts a single URL, converting any failure into a CrawlOutcome. */
export async function crawlOne(url: string): Promise<CrawlOutcome> {
  try {
    const { html, finalUrl, httpStatus } = await safeFetchPage(url);
    const data = extractContent(html, url, finalUrl, httpStatus);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof CrawlFailure) {
      return { ok: false, error: err.detail };
    }
    return { ok: false, error: { type: "unknown", message: (err as Error).message } };
  }
}
