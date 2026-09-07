import { existsSync } from "node:fs";
import path from "node:path";

import {
  DEV_DB,
  PG_PORT,
  SHADOW_DB,
  createEmbeddedPostgres,
  dbUrl,
  ensureDatabase,
} from "./pg";

/**
 * Start a persistent local PostgreSQL and keep it running until Ctrl-C.
 * Run in one terminal, then use `npm run db:migrate` / `npm run dev` in another.
 *
 *   npm run db:dev
 */
async function main(): Promise<void> {
  const dataDir = path.resolve(".pgdata");
  const pg = createEmbeddedPostgres({ dataDir, persistent: true });

  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("initialising cluster at .pgdata …");
    await pg.initialise();
  }

  await pg.start();
  await ensureDatabase(pg, DEV_DB);
  await ensureDatabase(pg, SHADOW_DB);

  console.log(`\nembedded PostgreSQL 17 listening on 127.0.0.1:${PG_PORT}\n`);
  console.log("Put these in .env.local:\n");
  console.log(`  DATABASE_URL="${dbUrl(DEV_DB)}"`);
  console.log(`  DIRECT_URL="${dbUrl(DEV_DB)}"`);
  console.log(`  SHADOW_DATABASE_URL="${dbUrl(SHADOW_DB)}"\n`);
  console.log("Ctrl-C to stop.\n");

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} — stopping PostgreSQL …`);
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await new Promise<never>(() => {});
}

void main();
