import "server-only";

/**
 * Bounded bulk runner (master §10 — "bounded selection … partial-success
 * results"). Each item is processed independently; a failure on one is captured,
 * not propagated. The caller has already checked `requireAdmin()`; per-item
 * authorization/eligibility lives inside `fn`.
 */
export const BULK_MAX = 50;

export interface BulkItemResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface BulkResult {
  attempted: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}

export async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<void>,
): Promise<BulkResult> {
  const unique = [...new Set(ids)].slice(0, BULK_MAX);
  const results: BulkItemResult[] = [];
  for (const id of unique) {
    try {
      await fn(id);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return {
    attempted: unique.length,
    succeeded,
    failed: unique.length - succeeded,
    results,
  };
}
