import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const emptyModule = fileURLToPath(
  new URL("./src/test/empty-module.ts", import.meta.url),
);

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
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    env: {
      LOG_LEVEL: "silent",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
