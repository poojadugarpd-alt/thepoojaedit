import { defineConfig, devices } from "@playwright/test";

/**
 * Browser test harness. Phase 1 has one smoke spec (the shell renders and is
 * navigable). Full journey coverage — guest/auth checkout, sold thrift, admin —
 * arrives from Phase 4 onward.
 *
 * The `webkit-iphone` project (admin-PWA Stage 5) runs WebKit — the actual
 * engine iOS Safari uses, not an emulation — at a real iPhone viewport
 * (`devices["iPhone 14"]`). "mobile" (Chromium/Pixel 7) stays for general
 * mobile-web coverage; webkit-iphone is what actually exercises WebKit-only
 * behaviour the admin PWA depends on (`navigator.standalone`, apple-specific
 * meta tags, Safari's own rendering quirks) — Chromium can't stand in for
 * it. It runs against the same routes as the other two projects (this file
 * has no admin-only project split); some admin-only specs additionally
 * restrict themselves with `test.skip` at the file/describe level where
 * WebKit's automation harness genuinely cannot exercise a browser API at
 * all (documented at each such skip — see e2e/admin-pwa.spec.ts).
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
    { name: "webkit-iphone", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
