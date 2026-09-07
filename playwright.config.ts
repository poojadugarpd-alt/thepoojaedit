import { defineConfig, devices } from "@playwright/test";

/**
 * Browser test harness. Phase 1 has one smoke spec (the shell renders and is
 * navigable). Full journey coverage — guest/auth checkout, sold thrift, admin —
 * arrives from Phase 4 onward.
 *
 * Run: `npm run test:e2e` (needs `npx playwright install` once for browsers).
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
