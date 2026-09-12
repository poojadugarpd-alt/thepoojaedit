import "server-only";

/**
 * The one Prisma client for the process (master spec §3).
 *
 * Prisma 7 has no datasource URL in the schema — the client is constructed with
 * the `@prisma/adapter-pg` driver adapter over a `pg` pool. Pool size and
 * timeouts are deliberately conservative for serverless concurrency; we never
 * connect/disconnect per request. In production `DATABASE_URL` is the Supabase
 * Supavisor transaction pooler (port 6543); locally it is embedded PostgreSQL.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

import { requireEnv } from "./env";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: requireEnv("DATABASE_URL"),
    // Raised from 5 (speed audit, 2026-09-13): a single admin page can fan
    // out past 5 queries in one request (the order-detail page's
    // findUnique+include measured 18) — with a 5-connection ceiling, the
    // extras queue for a free connection instead of running concurrently,
    // each queued query then also paying a full Tokyo round trip serially.
    // 10 is a conservative bump, well under what Supabase's free-tier
    // Supavisor transaction-pooler allows per project; worth watching the
    // pooler's connection-count graph after this change, not assumed safe
    // forever if traffic grows.
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supavisor's transaction pooler does not support session-level prepared
    // statements; the pg adapter uses unnamed statements, which is compatible.
  });

  const dev = process.env.NODE_ENV === "development";
  const client = new PrismaClient({
    adapter,
    log: dev
      ? [{ emit: "event", level: "query" }, "warn", "error"]
      : ["error"],
  });

  // Dev-only query-timing log (admin speed audit, 2026-09-13) — one line per
  // round trip to Postgres, so bracketing a page's data-fetch with
  // `timed()` (src/lib/perf.ts) shows both the count and each query's own
  // duration in between. Never attached outside development; adds no
  // overhead and no PII exposure in production.
  if (dev) {
    // Prisma 7's generated types don't include the event-emitter overloads
    // for the driver-adapter client; the event shape itself is unchanged.
    (client as unknown as { $on(event: "query", cb: (e: { query: string; duration: number }) => void): void }).$on(
      "query",
      (e) => {
        const compact = e.query.replace(/\s+/g, " ").slice(0, 100);
        console.log(`  ↳ ${e.duration}ms  ${compact}`);
      },
    );
  }

  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Constructed on first use, not at import. `createPrismaClient()` calls
 * `requireEnv("DATABASE_URL")`, so an eager singleton would throw the moment any
 * module imported this file — including during `next build` page-data collection
 * on a deploy that has no database yet. Deferring construction lets callers that
 * tolerate a cold database (e.g. the homepage rails, the sitemap) catch the
 * failure at the query instead of at import.
 */
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
