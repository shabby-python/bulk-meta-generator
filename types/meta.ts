export type ResultStatus =
  | "pending"
  | "crawling"
  | "generating"
  | "completed"
  | "failed";

export type CrawlStatus = "success" | "failed";

export interface MetaResult {
  id: string;
  url: string;
  status: ResultStatus;
  httpStatus?: number;
  finalUrl?: string;
  canonicalUrl?: string;
  pageType?: string;
  primaryTopic?: string;
  secondaryConcepts?: string[];
  brandName?: string;
  existingTitle?: string;
  existingDescription?: string;
  recommendedTitle?: string;
  recommendedDescription?: string;
  titleLength?: number;
  descriptionLength?: number;
  titleChanged?: boolean;
  descriptionChanged?: boolean;
  seoScore?: number;
  warnings?: string[];
  error?: string;
  crawlStatus?: CrawlStatus;
  /** Extra columns preserved from an uploaded CSV, keyed by original header. */
  extraColumns?: Record<string, string>;
  selected?: boolean;
  updatedAt?: number;
}

export interface GenerateRequest {
  url: string;
}

export interface GenerateResponse {
  result: MetaResult;
}
