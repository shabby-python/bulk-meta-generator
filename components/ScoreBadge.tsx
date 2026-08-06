export default function ScoreBadge({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  const style =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 50
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${style}`}>
      {score}
    </span>
  );
}
