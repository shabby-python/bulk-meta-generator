/**
 * Given a list of (id, value) pairs, returns the set of ids whose value is
 * a case-insensitive, whitespace-normalized duplicate of another entry's.
 */
export function findDuplicateIds(entries: { id: string; value: string | undefined }[]): Set<string> {
  const seen = new Map<string, string[]>();
  for (const { id, value } of entries) {
    if (!value || !value.trim()) continue;
    const key = value.trim().toLowerCase().replace(/\s+/g, " ");
    const ids = seen.get(key) ?? [];
    ids.push(id);
    seen.set(key, ids);
  }
  const duplicateIds = new Set<string>();
  for (const ids of seen.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicateIds.add(id);
    }
  }
  return duplicateIds;
}
