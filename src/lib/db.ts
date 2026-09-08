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
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supavisor's transaction pooler does not support session-level prepared
    // statements; the pg adapter uses unnamed statements, which is compatible.
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
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
