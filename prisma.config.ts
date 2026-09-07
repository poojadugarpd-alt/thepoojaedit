import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 CLI configuration.
 *
 * v7 no longer auto-loads `.env`, and `directUrl` was removed — the CLI datasource
 * URL now lives here (master spec §3: "put the CLI datasource URL in
 * prisma.config.ts"). We load `.env.local` first (dev, gitignored) then `.env`;
 * dotenv does not overwrite already-set vars, so `.env.local` wins.
 *
 * `DIRECT_URL` is the session-mode / direct connection used for migrations and
 * Studio. `DATABASE_URL` (the Supavisor transaction pooler in production) is used
 * by the runtime client via `@prisma/adapter-pg` — see src/lib/db.ts. Locally,
 * with embedded PostgreSQL, the two URLs are identical.
 */
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
