import type { SeoWarning, WarningSeverity } from "./validate";

const SEVERITY_PENALTY: Record<WarningSeverity, number> = {
  minor: 5,
  moderate: 12,
  major: 25,
};

export function scoreFromWarnings(warnings: SeoWarning[]): number {
  const penalty = warnings.reduce((sum, w) => sum + SEVERITY_PENALTY[w.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
