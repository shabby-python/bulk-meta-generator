# Bulk Meta Title & Description Generator

Generates SEO-friendly meta titles and descriptions for hundreds of URLs at once — no keywords, brand, tone, or page type required from the user. Every page is crawled and analyzed automatically; the app is a bulk spreadsheet tool, not a chatbot.

## Architecture summary

```
URLs (paste or CSV) → crawl (SSRF-safe fetch + cheerio extraction)
                    → Claude analyzes page + writes title/description
                    → deterministic TypeScript SEO validation & scoring
                    → editable results table → CSV export
```

- **Crawling** (`lib/crawler/`) fetches each URL with SSRF protections (protocol allowlist, DNS re-resolution on every redirect hop blocking private/loopback/link-local/cloud-metadata ranges, timeout, redirect cap, response-size cap), then uses `cheerio` to strip nav/footer/scripts/cookie-banners and extract a condensed structured representation (title, meta description, H1/H2, OpenGraph, canonical, breadcrumb, product/category/brand name, JSON-LD) — never the raw HTML.
- **AI layer** (`lib/ai/`) sends only that condensed representation to Claude via a forced tool-call, so the response is structured JSON (`pageType`, `primaryTopic`, `title`, `description`, …) rather than free text. The provider is abstracted behind `AiProvider` so another model/vendor can be swapped in later. The Anthropic client and API key never leave the server.
- **SEO validation** (`lib/seo/`) is pure, deterministic TypeScript — Claude is never asked to score itself. It checks length, topic presence, keyword stuffing, excessive punctuation, unsupported claims, and duplicate titles/descriptions across the whole batch, then produces a 0–100 score.
- **Batch processing** (`lib/queue/`) runs a configurable-concurrency queue in the browser, calling `/api/generate` once per URL. Each URL is isolated — one failure never aborts the batch — and progress ("Processed 42/200") updates live. Cross-batch checks (duplicates) are recomputed client-side whenever any result changes, including manual edits.
- **CSV** (`lib/csv/`) auto-detects a `url` column (or falls back to the first column that looks like URLs), preserves any extra uploaded columns through to export, and uses `papaparse` for correct escaping.

## Files created

```
app/
  page.tsx                     # main UI: input, progress, summary cards, bulk actions, table
  layout.tsx                   # page metadata
  api/crawl/route.ts           # POST { url } → crawl-only (used for standalone crawl checks)
  api/generate/route.ts        # POST { url, id } → crawl + AI + validation, returns a MetaResult
components/
  UrlInput.tsx                 # paste-URLs textarea
  CsvUpload.tsx                 # drag/drop + browse CSV upload
  BulkProgress.tsx             # progress bar + succeeded/failed/remaining counts
  ResultsTable.tsx             # sticky-header spreadsheet table, horizontal scroll, row actions
  StatusBadge.tsx / ScoreBadge.tsx
  EditableMetaField.tsx        # click-to-edit title/description cell with live char count
lib/
  crawler/
    types.ts                   # ExtractedContent, CrawlError, CrawlOutcome
    security.ts                # SSRF allow/deny logic (protocols, IP ranges, DNS resolution)
    fetch-page.ts               # SSRF-safe fetch with redirect/timeout/size limits
    extract-content.ts          # cheerio-based boilerplate removal + structured extraction
    crawl.ts                    # combines fetch-page + extract-content, used by both API routes
  ai/
    types.ts                    # AiMetaInput / AiMetaOutput / AiProvider interface
    anthropic.ts                 # Claude implementation (forced tool-use for structured JSON)
    provider.ts                  # provider factory (server-only)
  seo/
    validate.ts                  # title/description/technical checks + evaluateBatch orchestrator
    score.ts                     # severity-weighted 0–100 scoring
    duplicates.ts                 # cross-batch duplicate detection
  csv/
    parse.ts                     # CSV → URLs (+ extra columns), plain-text URL parsing
    export.ts                    # MetaResult[] → CSV with correct escaping
  queue/
    batch.ts, types.ts            # configurable-concurrency batch runner
types/
  meta.ts                        # MetaResult, ResultStatus
```

## Environment variables

Create `.env.local` (see `.env.example`):

```
ANTHROPIC_API_KEY=your-key-here
# Optional
ANTHROPIC_MODEL=claude-sonnet-5
```

The key is read only inside `lib/ai/anthropic.ts` and `lib/ai/provider.ts` (both marked `import "server-only"`) and is never sent to the browser — all AI calls happen inside the `/api/generate` route handler.

## Installation

```bash
npm install
```

## Local development

```bash
npm run dev
```

Open http://localhost:3000, paste URLs or upload a CSV, and click **Generate Meta Data**.

## Quality checks

```bash
npx tsc --noEmit   # TypeScript
npx eslint .        # Lint
npm run build        # Production build
```

## Production deployment

1. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in your hosting provider's environment variables — never commit `.env.local`.
2. `npm run build` then `npm start`, or deploy directly to Vercel (or any Next.js-compatible host) with those env vars configured.
3. The `/api/crawl` and `/api/generate` routes run on the Node.js runtime (`export const runtime = "nodejs"`) since they need `dns`/`net`-level SSRF checks that aren't available on edge runtimes.

## Notes / known limitations

- SSRF protection re-validates DNS on every redirect hop and blocks private/loopback/link-local/cloud-metadata ranges, but does not pin the TCP connection to the resolved IP, so a theoretical DNS-rebinding race between validation and the actual `fetch()` is not fully closed. This is a reasonable trade-off for a server-side crawler behind normal rate limits; tightening further would require a custom low-level HTTP client.
- The deterministic SEO score is recomputed client-side whenever results change (edits, retries, new completions) so duplicate-title/description checks stay accurate across the whole batch; the "unsupported claim" check (which needs the crawled page text) only runs once, at generation time, since page text isn't persisted in the row after that.
