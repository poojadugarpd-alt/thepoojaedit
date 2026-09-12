import "server-only";

import { isDevelopment } from "./app-env";

/**
 * Dev-only page-level timing (admin-PWA speed audit, 2026-09-13). Wraps a
 * page's top-level data-fetching call and prints how long it took, bracketing
 * the individual Prisma query lines `src/lib/db.ts` logs in the same window —
 * together they answer "how many queries, parallel or sequential, how long
 * each" without adding any request-scoped machinery. No-op outside
 * development; never runs in production or against the live database.
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isDevelopment) return fn();
  const t0 = performance.now();
  console.log(`\n[perf] ▶ ${label}`);
  try {
    return await fn();
  } finally {
    console.log(`[perf] ◀ ${label} — ${(performance.now() - t0).toFixed(1)}ms wall`);
  }
}
