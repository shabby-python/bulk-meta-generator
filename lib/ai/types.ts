export interface AiMetaInput {
  url: string;
  existingTitle?: string;
  existingDescription?: string;
  h1?: string;
  headings: string[];
  ogTitle?: string;
  ogDescription?: string;
  mainText: string;
  siteName?: string;
  canonical?: string;
  breadcrumb?: string;
  productName?: string;
  categoryName?: string;
  brandName?: string;
}

export const PAGE_TYPES = [
  "Homepage",
  "Product",
  "Product Category",
  "Service",
  "Location",
  "Blog Article",
  "Guide",
  "Comparison",
  "Landing Page",
  "Other",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export interface AiMetaOutput {
  pageType: PageType;
  primaryTopic: string;
  secondaryConcepts: string[];
  brandName?: string;
  title: string;
  description: string;
}

export interface AiProvider {
  generateMeta(input: AiMetaInput): Promise<AiMetaOutput>;
}
