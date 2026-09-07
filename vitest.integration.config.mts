import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const emptyModule = fileURLToPath(
  new URL("./src/test/empty-module.ts", import.meta.url),
);

/**
 * Integration tests run against a REAL PostgreSQL (embedded on port 5433 —
 * `npm run db:dev`; CI overrides via INTEGRATION_DATABASE_URL). They prove
 * transactions, uniqueness, CHECK constraints, triggers and row-lock
 * concurrency, which SQLite / a mocked client cannot (playbook §2.4).
 */
const TEST_DB_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5433/poojaedit_test";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: emptyModule },
      { find: /^client-only$/, replacement: emptyModule },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.itest.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    // One shared database → test files must not run in parallel. Concurrency
    // *inside* a test uses multiple Prisma clients (real connections) and is
    // unaffected by this.
    fileParallelism: false,
    env: {
      LOG_LEVEL: "silent",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      INTEGRATION_DATABASE_URL: TEST_DB_URL,
      DATABASE_URL: TEST_DB_URL,
      DIRECT_URL: TEST_DB_URL,
    },
  },
});
