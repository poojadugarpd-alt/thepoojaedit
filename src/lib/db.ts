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

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
