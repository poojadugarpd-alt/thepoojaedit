import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma";

/**
 * Target database for the integration suite. Defaults to the local embedded
 * PostgreSQL (`npm run db:dev`); CI overrides with `INTEGRATION_DATABASE_URL`
 * pointing at a service container.
 */
export const TEST_DB_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5433/poojaedit_test";

/** The maintenance ("postgres") URL on the same server, for CREATE/DROP DATABASE. */
export function adminUrlFor(testUrl: string): string {
  const u = new URL(testUrl);
  u.pathname = "/postgres";
  return u.toString();
}

/** A fresh client with its own pool — use several to get independent connections. */
export function makeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DB_URL, max: 4 }),
  });
}

/** Truncate every application table. Fast reset between tests. */
export async function resetDb(client: PrismaClient): Promise<void> {
  const rows = await client.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await client.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
