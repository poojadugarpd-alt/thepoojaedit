import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "/Users/poojadugar/.gemini/antigravity/brain/44473c94-b217-40cd-b87a-d277a231aa2f/screenshots";
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const viewports = [
    { name: "1900", width: 1900, height: 1200 },
    { name: "390", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    await page.goto("http://localhost:3123/preview/kitchen", {
      waitUntil: "networkidle",
    });

    // 1. Full page overview
    await page.screenshot({
      path: path.join(OUT_DIR, `overview-${vp.name}.png`),
      fullPage: true,
    });

    // 2. Receipt states from the comparison section
    const receiptStart = page.locator("#receipt-start");
    await receiptStart.scrollIntoViewIfNeeded();
    await receiptStart.screenshot({
      path: path.join(OUT_DIR, `receipt-start-${vp.name}.png`),
    });

    const receiptMid = page.locator("#receipt-mid");
    await receiptMid.scrollIntoViewIfNeeded();
    await receiptMid.screenshot({
      path: path.join(OUT_DIR, `receipt-mid-${vp.name}.png`),
    });

    const receiptFinal = page.locator("#receipt-final");
    await receiptFinal.scrollIntoViewIfNeeded();
    await receiptFinal.screenshot({
      path: path.join(OUT_DIR, `receipt-final-${vp.name}.png`),
    });

    // 3. Hold-to-delete states from comparison section
    const holdRest = page.locator("#hold-rest");
    await holdRest.scrollIntoViewIfNeeded();
    await holdRest.screenshot({
      path: path.join(OUT_DIR, `hold-rest-${vp.name}.png`),
    });

    const holdMid = page.locator("#hold-mid");
    await holdMid.scrollIntoViewIfNeeded();
    await holdMid.screenshot({
      path: path.join(OUT_DIR, `hold-mid-${vp.name}.png`),
    });

    const holdCompleted = page.locator("#hold-completed");
    await holdCompleted.scrollIntoViewIfNeeded();
    await holdCompleted.screenshot({
      path: path.join(OUT_DIR, `hold-completed-${vp.name}.png`),
    });

    const holdCancelled = page.locator("#hold-cancelled");
    await holdCancelled.scrollIntoViewIfNeeded();
    await holdCancelled.screenshot({
      path: path.join(OUT_DIR, `hold-cancelled-${vp.name}.png`),
    });

    // 4. Receipt edge states (Failure, On-Hold, Refund)
    await page.locator('button:has-text("2. Failed")').click();
    const failBox = page.locator("#receipt-failure");
    await failBox.scrollIntoViewIfNeeded();
    await failBox.screenshot({
      path: path.join(OUT_DIR, `receipt-failed-${vp.name}.png`),
    });

    await page.locator('button:has-text("3. On Hold")').click();
    const onHoldBox = page.locator("#receipt-onhold");
    await onHoldBox.scrollIntoViewIfNeeded();
    await onHoldBox.screenshot({
      path: path.join(OUT_DIR, `receipt-onhold-${vp.name}.png`),
    });

    await page.locator('button:has-text("4. Refunded")').click();
    const refundBox = page.locator("#receipt-refund");
    await refundBox.scrollIntoViewIfNeeded();
    await refundBox.screenshot({
      path: path.join(OUT_DIR, `receipt-refund-${vp.name}.png`),
    });

    await page.close();
  }

  await browser.close();
  console.log("All screenshots captured successfully in", OUT_DIR);
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
