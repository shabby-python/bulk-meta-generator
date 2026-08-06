interface BulkProgressProps {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  isRunning: boolean;
}

export default function BulkProgress({ total, processed, succeeded, failed, isRunning }: BulkProgressProps) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700">
          {isRunning ? "Processing" : processed === total && total > 0 ? "Done" : "Progress"} {processed} of {total} URLs
        </span>
        <span className="text-zinc-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isRunning ? "bg-blue-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-zinc-500">
        <span>
          <span className="font-medium text-emerald-600">{succeeded}</span> succeeded
        </span>
        <span>
          <span className="font-medium text-red-600">{failed}</span> failed
        </span>
        <span>
          <span className="font-medium text-zinc-600">{Math.max(0, total - processed)}</span> remaining
        </span>
      </div>
    </div>
  );
}
