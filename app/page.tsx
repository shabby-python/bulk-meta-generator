"use client";

import { useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import UrlInput from "@/components/UrlInput";
import CsvUpload from "@/components/CsvUpload";
import BulkProgress from "@/components/BulkProgress";
import ResultsTable from "@/components/ResultsTable";
import { parsePlainTextUrls, type ParseCsvResult } from "@/lib/csv/parse";
import { resultsToCsv } from "@/lib/csv/export";
import { runBatchQueue } from "@/lib/queue/batch";
import { evaluateBatch } from "@/lib/seo/validate";
import type { MetaResult } from "@/types/meta";

const DEFAULT_CONCURRENCY = 5;

function withEvaluatedScores(list: MetaResult[]): MetaResult[] {
  const evaluatable = list.filter(
    (r): r is MetaResult & { crawlStatus: "success" | "failed" } => r.crawlStatus !== undefined
  );
  if (evaluatable.length === 0) return list;

  const outcomes = evaluateBatch(
    evaluatable.map((r) => ({
      id: r.id,
      crawlStatus: r.crawlStatus,
      existingTitle: r.existingTitle,
      existingDescription: r.existingDescription,
      recommendedTitle: r.recommendedTitle,
      recommendedDescription: r.recommendedDescription,
      primaryTopic: r.primaryTopic,
      canonicalUrl: r.canonicalUrl,
      finalUrl: r.finalUrl,
    }))
  );

  return list.map((r) => {
    const outcome = outcomes.get(r.id);
    if (!outcome) return r;
    return { ...r, warnings: outcome.warnings, seoScore: r.status === "failed" ? 0 : outcome.seoScore };
  });
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [urlText, setUrlText] = useState("");
  const [csvResult, setCsvResult] = useState<ParseCsvResult | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [results, setResults] = useState<MetaResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const cancelledRef = useRef(false);

  const summary = useMemo(() => {
    const total = results.length;
    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const scored = results.filter((r) => r.status === "completed" && typeof r.seoScore === "number");
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + (r.seoScore ?? 0), 0) / scored.length)
      : undefined;
    return { total, completed, failed, avgScore };
  }, [results]);

  const allSelected = results.length > 0 && results.every((r) => r.selected);

  async function processOne(id: string, url: string, extraColumns?: Record<string, string>) {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: "crawling" } : r)));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, id, extraColumns }),
      });
      const body = await res.json();
      const result: MetaResult = body.result ?? {
        id,
        url,
        status: "failed",
        error: "Unexpected server response",
        warnings: ["Unexpected server response"],
      };
      setResults((prev) => withEvaluatedScores(prev.map((r) => (r.id === id ? { ...result, selected: r.selected } : r))));
    } catch (err) {
      setResults((prev) =>
        withEvaluatedScores(
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "failed", error: `Network error: ${(err as Error).message}`, warnings: ["Network error"], seoScore: 0 }
              : r
          )
        )
      );
    }
  }

  async function runQueue(items: { id: string; url: string; extraColumns?: Record<string, string> }[]) {
    if (items.length === 0) return;
    cancelledRef.current = false;
    setIsRunning(true);
    setProcessed(0);
    setBatchTotal(items.length);
    await runBatchQueue(
      items,
      async (item) => {
        await processOne(item.id, item.url, item.extraColumns);
      },
      {
        concurrency,
        isCancelled: () => cancelledRef.current,
        onItemSettled: (completed) => setProcessed(completed),
      }
    );
    setIsRunning(false);
  }

  function collectPendingUrls(): { url: string; extraColumns?: Record<string, string> }[] {
    const seen = new Set<string>();
    const collected: { url: string; extraColumns?: Record<string, string> }[] = [];
    for (const existing of results) seen.add(existing.url.toLowerCase());

    if (csvResult) {
      for (const { url, extraColumns } of csvResult.urls) {
        const key = url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({ url, extraColumns });
      }
    }
    for (const url of parsePlainTextUrls(urlText)) {
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push({ url });
    }
    return collected;
  }

  async function handleGenerate() {
    const pending = collectPendingUrls();
    if (pending.length === 0) return;

    const stubs: MetaResult[] = pending.map(({ url, extraColumns }) => ({
      id: uuidv4(),
      url,
      status: "pending",
      extraColumns,
    }));
    setResults((prev) => [...prev, ...stubs]);
    await runQueue(stubs.map((s) => ({ id: s.id, url: s.url, extraColumns: s.extraColumns })));
  }

  function toggleSelect(id: string) {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  }

  function toggleSelectAll() {
    setResults((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  function updateResult(id: string, patch: Partial<MetaResult>) {
    setResults((prev) => withEvaluatedScores(prev.map((r) => (r.id === id ? { ...r, ...patch } : r))));
  }

  async function regenerateOne(id: string) {
    const target = results.find((r) => r.id === id);
    if (!target) return;
    await runQueue([{ id: target.id, url: target.url, extraColumns: target.extraColumns }]);
  }

  async function regenerateSelected() {
    const selected = results.filter((r) => r.selected);
    await runQueue(selected.map((r) => ({ id: r.id, url: r.url, extraColumns: r.extraColumns })));
  }

  async function retryFailed() {
    const failed = results.filter((r) => r.status === "failed");
    await runQueue(failed.map((r) => ({ id: r.id, url: r.url, extraColumns: r.extraColumns })));
  }

  function deleteSelected() {
    setResults((prev) => prev.filter((r) => !r.selected));
  }

  function exportCsv(scope: "all" | "selected") {
    const target = scope === "selected" ? results.filter((r) => r.selected) : results;
    if (target.length === 0) return;
    downloadCsv(resultsToCsv(target), `meta-results-${scope}-${Date.now()}.csv`);
  }

  const hasSelection = results.some((r) => r.selected);
  const hasFailed = results.some((r) => r.status === "failed");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-[1700px] px-6 py-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Bulk Meta Title &amp; Description Generator</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Generate SEO-friendly metadata automatically from hundreds of URLs.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-6 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row">
            <UrlInput value={urlText} onChange={setUrlText} disabled={isRunning} />
            <CsvUpload
              disabled={isRunning}
              onParsed={(result, fileName) => {
                setCsvResult(result);
                setCsvFileName(fileName);
              }}
            />
          </div>

          {csvResult && csvResult.urlColumn && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span>
                {csvFileName}: {csvResult.urls.length} URL{csvResult.urls.length === 1 ? "" : "s"} ready from column &quot;{csvResult.urlColumn}&quot;
              </span>
              <button
                type="button"
                className="font-medium underline"
                onClick={() => {
                  setCsvResult(null);
                  setCsvFileName(null);
                }}
              >
                Clear
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <label htmlFor="concurrency" className="whitespace-nowrap">
                Concurrency
              </label>
              <input
                id="concurrency"
                type="number"
                min={1}
                max={20}
                value={concurrency}
                disabled={isRunning}
                onChange={(e) => setConcurrency(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50"
              />
            </div>
            <div className="flex gap-2">
              {isRunning && (
                <button
                  type="button"
                  onClick={() => {
                    cancelledRef.current = true;
                  }}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isRunning || (!urlText.trim() && !csvResult)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isRunning ? "Generating…" : "Generate Meta Data"}
              </button>
            </div>
          </div>
        </section>

        {(isRunning || results.length > 0) && (
          <div className="mt-5">
            <BulkProgress
              total={batchTotal}
              processed={processed}
              succeeded={results.filter((r) => r.status === "completed").length}
              failed={results.filter((r) => r.status === "failed").length}
              isRunning={isRunning}
            />
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="URLs" value={summary.total} />
            <SummaryCard label="Completed" value={summary.completed} tone="emerald" />
            <SummaryCard label="Failed" value={summary.failed} tone="red" />
            <SummaryCard label="Average SEO Score" value={summary.avgScore ?? "—"} tone="blue" />
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={toggleSelectAll} className="toolbar-btn">
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <button type="button" onClick={regenerateSelected} disabled={!hasSelection || isRunning} className="toolbar-btn">
              Regenerate Selected
            </button>
            <button type="button" onClick={deleteSelected} disabled={!hasSelection} className="toolbar-btn text-red-600">
              Delete Selected
            </button>
            <button type="button" onClick={retryFailed} disabled={!hasFailed || isRunning} className="toolbar-btn">
              Retry Failed
            </button>
            <span className="mx-1 h-4 w-px bg-zinc-200" />
            <button type="button" onClick={() => exportCsv("selected")} disabled={!hasSelection} className="toolbar-btn">
              Export Selected
            </button>
            <button type="button" onClick={() => exportCsv("all")} className="toolbar-btn">
              Export All
            </button>
          </div>
        )}

        <div className="mt-5">
          <ResultsTable
            results={results}
            allSelected={allSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onUpdateResult={updateResult}
            onRetry={(id) => void regenerateOne(id)}
            onRegenerate={(id) => void regenerateOne(id)}
          />
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: "emerald" | "red" | "blue" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "blue" ? "text-blue-600" : "text-zinc-900";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
