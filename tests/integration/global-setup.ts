import { execFileSync } from "node:child_process";

import { Client } from "pg";

import { TEST_DB_URL, adminUrlFor } from "./helpers";

/**
 * Provision a clean test database on the target PostgreSQL server and apply all
 * migrations with `prisma migrate deploy` (proves "migrate an empty database").
 * Runs once before the integration suite.
 */
export async function setup() {
  const testDbName = new URL(TEST_DB_URL).pathname.replace(/^\//, "");
  const admin = new Client({ connectionString: adminUrlFor(TEST_DB_URL) });

  try {
    await admin.connect();
  } catch {
    throw new Error(
      `Cannot reach PostgreSQL for integration tests at ${adminUrlFor(TEST_DB_URL)}. ` +
        "Run `npm run db:dev` in another terminal, or set INTEGRATION_DATABASE_URL.",
    );
  }

  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [testDbName],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  await admin.end();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, DIRECT_URL: TEST_DB_URL },
  });
}
