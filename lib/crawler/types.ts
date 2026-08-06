export interface ExtractedContent {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  canonicalUrl?: string;
  existingTitle?: string;
  existingDescription?: string;
  h1?: string;
  headings: string[];
  ogTitle?: string;
  ogDescription?: string;
  mainText: string;
  siteName?: string;
  breadcrumb?: string;
  productName?: string;
  categoryName?: string;
  brandName?: string;
}

export type CrawlErrorType =
  | "invalid_url"
  | "blocked_host"
  | "dns_error"
  | "timeout"
  | "too_many_redirects"
  | "redirect_loop"
  | "http_error"
  | "empty_page"
  | "response_too_large"
  | "unknown";

export interface CrawlError {
  type: CrawlErrorType;
  message: string;
  httpStatus?: number;
}

export type CrawlOutcome =
  | { ok: true; data: ExtractedContent }
  | { ok: false; error: CrawlError };
