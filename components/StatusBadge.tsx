import type { ResultStatus } from "@/types/meta";

const STYLES: Record<ResultStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 border-zinc-200",
  crawling: "bg-blue-50 text-blue-700 border-blue-200",
  generating: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const LABELS: Record<ResultStatus, string> = {
  pending: "Pending",
  crawling: "Crawling",
  generating: "Generating",
  completed: "Completed",
  failed: "Failed",
};

export default function StatusBadge({ status }: { status: ResultStatus }) {
  const isBusy = status === "crawling" || status === "generating";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[status]}`}
    >
      {isBusy && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {LABELS[status]}
    </span>
  );
}
