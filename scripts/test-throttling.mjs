import { chromium } from "@playwright/test";

async function testThrottling() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  // Emulate "Fast 3G" network conditions
  // Latency: 150ms, Download: 1.6 Mbps (200 KB/s), Upload: 750 Kbps
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  const start = Date.now();
  await page.goto("http://localhost:3123/preview/kitchen", {
    waitUntil: "domcontentloaded",
  });
  const domLoaded = Date.now() - start;

  await page.waitForSelector('[data-testid="receipt-container"]');
  const receiptRendered = Date.now() - start;

  console.log(`[Throttled 3G Mobile Test] DOM Content Loaded: ${domLoaded}ms`);
  console.log(`[Throttled 3G Mobile Test] Receipt Rendered: ${receiptRendered}ms`);

  await browser.close();
}

testThrottling().catch(err => {
  console.error(err);
  process.exit(1);
});
