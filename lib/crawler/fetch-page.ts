import { assertSafeDestination, SsrfBlockedError } from "./security";
import type { CrawlError } from "./types";

const USER_AGENT = "BulkMetaGeneratorBot/1.0 (+https://example.com/bot)";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3 MB

export interface SafeFetchResult {
  html: string;
  finalUrl: string;
  httpStatus: number;
}

export class CrawlFailure extends Error {
  detail: CrawlError;
  constructor(detail: CrawlError) {
    super(detail.message);
    this.detail = detail;
  }
}

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new CrawlFailure({
          type: "response_too_large",
          message: `Response exceeded ${MAX_RESPONSE_BYTES} bytes`,
        });
      }
      chunks.push(value);
    }
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

/**
 * Fetches a URL while enforcing SSRF protections at every redirect hop:
 * protocol allowlist, DNS re-resolution + private-range blocking, a
 * bounded redirect count, a request timeout, and a max response size.
 */
export async function safeFetchPage(rawUrl: string): Promise<SafeFetchResult> {
  let currentUrl: string;
  try {
    const validated = await assertSafeDestination(rawUrl);
    currentUrl = validated.toString();
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      throw new CrawlFailure({ type: "blocked_host", message: err.message });
    }
    throw new CrawlFailure({ type: "invalid_url", message: (err as Error).message });
  }

  const visited = new Set<string>();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (visited.has(currentUrl)) {
      throw new CrawlFailure({ type: "redirect_loop", message: `Redirect loop detected at ${currentUrl}` });
    }
    visited.add(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new CrawlFailure({
        type: isAbort ? "timeout" : "dns_error",
        message: isAbort
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `Network error: ${(err as Error).message}`,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new CrawlFailure({
          type: "http_error",
          message: `Redirect status ${res.status} without Location header`,
          httpStatus: res.status,
        });
      }
      if (hop === MAX_REDIRECTS) {
        throw new CrawlFailure({ type: "too_many_redirects", message: "Exceeded maximum redirect count" });
      }
      const nextUrl = new URL(location, currentUrl).toString();
      try {
        const validated = await assertSafeDestination(nextUrl);
        currentUrl = validated.toString();
      } catch (err) {
        if (err instanceof SsrfBlockedError) {
          throw new CrawlFailure({ type: "blocked_host", message: err.message });
        }
        throw new CrawlFailure({ type: "invalid_url", message: (err as Error).message });
      }
      continue;
    }

    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      throw new CrawlFailure({
        type: "http_error",
        message: `Request failed with status ${res.status}`,
        httpStatus: res.status,
      });
    }
    if (res.status === 404) {
      throw new CrawlFailure({ type: "http_error", message: "Page not found (404)", httpStatus: 404 });
    }
    if (res.status < 200 || res.status >= 300) {
      throw new CrawlFailure({
        type: "http_error",
        message: `Unexpected status ${res.status}`,
        httpStatus: res.status,
      });
    }

    const html = await readBodyWithLimit(res);
    if (!html || html.trim().length === 0) {
      throw new CrawlFailure({ type: "empty_page", message: "Page returned no content" });
    }

    return { html, finalUrl: currentUrl, httpStatus: res.status };
  }

  throw new CrawlFailure({ type: "too_many_redirects", message: "Exceeded maximum redirect count" });
}
