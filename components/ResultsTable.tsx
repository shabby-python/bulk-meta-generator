"use client";

import type { ReactNode } from "react";
import type { MetaResult } from "@/types/meta";
import StatusBadge from "./StatusBadge";
import ScoreBadge from "./ScoreBadge";
import EditableMetaField from "./EditableMetaField";

interface ResultsTableProps {
  results: MetaResult[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onUpdateResult: (id: string, patch: Partial<MetaResult>) => void;
  onRetry: (id: string) => void;
  onRegenerate: (id: string) => void;
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function CellText({ children }: { children: string | undefined }) {
  return (
    <div className="line-clamp-2 max-w-[300px] text-sm text-zinc-600" title={children}>
      {children || <span className="text-zinc-300">—</span>}
    </div>
  );
}

function IconButton({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function ResultsTable({
  results,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onUpdateResult,
  onRetry,
  onRegenerate,
}: ResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center text-sm text-zinc-400">
        No URLs processed yet. Paste URLs or upload a CSV, then click Generate Meta Data.
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] w-full overflow-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full min-w-[1600px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
          <tr>
            <th className="w-10 px-3 py-2.5">
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} aria-label="Select all rows" />
            </th>
            <th className="min-w-[220px] px-3 py-2.5">URL</th>
            <th className="min-w-[110px] px-3 py-2.5">Status</th>
            <th className="min-w-[130px] px-3 py-2.5">Page Type</th>
            <th className="min-w-[220px] px-3 py-2.5">Existing Meta Title</th>
            <th className="min-w-[260px] px-3 py-2.5">Existing Meta Description</th>
            <th className="min-w-[260px] px-3 py-2.5">Recommended Meta Title</th>
            <th className="min-w-[80px] px-3 py-2.5">Title Len</th>
            <th className="min-w-[300px] px-3 py-2.5">Recommended Meta Description</th>
            <th className="min-w-[80px] px-3 py-2.5">Desc Len</th>
            <th className="min-w-[80px] px-3 py-2.5">SEO Score</th>
            <th className="min-w-[220px] px-3 py-2.5">Warnings</th>
            <th className="min-w-[190px] px-3 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {results.map((r) => (
            <tr key={r.id} className="align-top hover:bg-zinc-50/60">
              <td className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(r.selected)}
                  onChange={() => onToggleSelect(r.id)}
                  aria-label={`Select ${r.url}`}
                />
              </td>
              <td className="max-w-[240px] px-3 py-2.5">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 break-all text-sm text-blue-600 hover:underline"
                  title={r.url}
                >
                  {r.url}
                </a>
                {r.error && <div className="mt-0.5 text-xs text-red-500" title={r.error}>{r.error}</div>}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2.5">
                <CellText>{r.pageType}</CellText>
              </td>
              <td className="px-3 py-2.5">
                <CellText>{r.existingTitle}</CellText>
              </td>
              <td className="px-3 py-2.5">
                <CellText>{r.existingDescription}</CellText>
              </td>
              <td className="px-3 py-2.5">
                <EditableMetaField
                  value={r.recommendedTitle ?? ""}
                  onChange={(value) =>
                    onUpdateResult(r.id, { recommendedTitle: value, titleLength: value.length })
                  }
                  placeholder="—"
                  minLength={45}
                  maxLength={65}
                  disabled={r.status !== "completed"}
                />
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-zinc-500">{r.titleLength ?? "—"}</td>
              <td className="px-3 py-2.5">
                <EditableMetaField
                  value={r.recommendedDescription ?? ""}
                  onChange={(value) =>
                    onUpdateResult(r.id, { recommendedDescription: value, descriptionLength: value.length })
                  }
                  placeholder="—"
                  minLength={120}
                  maxLength={160}
                  disabled={r.status !== "completed"}
                />
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-zinc-500">{r.descriptionLength ?? "—"}</td>
              <td className="px-3 py-2.5">
                <ScoreBadge score={r.seoScore} />
              </td>
              <td className="max-w-[240px] px-3 py-2.5">
                {r.warnings && r.warnings.length > 0 ? (
                  <ul className="space-y-0.5 text-xs text-amber-700">
                    {r.warnings.slice(0, 3).map((w, i) => (
                      <li key={i} className="line-clamp-1" title={w}>
                        • {w}
                      </li>
                    ))}
                    {r.warnings.length > 3 && (
                      <li className="text-zinc-400">+{r.warnings.length - 3} more</li>
                    )}
                  </ul>
                ) : (
                  <span className="text-xs text-zinc-300">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  <IconButton
                    title="Copy title"
                    onClick={() => copyToClipboard(r.recommendedTitle ?? "")}
                    disabled={!r.recommendedTitle}
                  >
                    Title
                  </IconButton>
                  <IconButton
                    title="Copy description"
                    onClick={() => copyToClipboard(r.recommendedDescription ?? "")}
                    disabled={!r.recommendedDescription}
                  >
                    Desc
                  </IconButton>
                  <IconButton
                    title="Copy row"
                    onClick={() =>
                      copyToClipboard(
                        [r.url, r.recommendedTitle ?? "", r.recommendedDescription ?? ""].join("\t")
                      )
                    }
                  >
                    Row
                  </IconButton>
                  {r.status === "failed" ? (
                    <IconButton title="Retry failed URL" onClick={() => onRetry(r.id)}>
                      Retry
                    </IconButton>
                  ) : (
                    <IconButton
                      title="Regenerate this row"
                      onClick={() => onRegenerate(r.id)}
                      disabled={r.status === "crawling" || r.status === "generating"}
                    >
                      Regen
                    </IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
