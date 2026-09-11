import { expect, test } from "@playwright/test";

/**
 * Checkout journey (Phase 7; COD storefront removal 2026-09-11).
 * Runs on the legacy dev dataset — requires the dev DB (`npm run db:dev` +
 * seed + legacy import) and a build.
 *
 * Cash on delivery is no longer offered at web checkout (owner decision,
 * `CHECKOUT_COD_ENABLED` in `src/server/checkout/index.ts`) — this spec
 * asserts it stays that way, and drives the online-payment path as far as
 * completing a real third-party payment allows in e2e: opening Razorpay
 * Checkout. When Razorpay test keys are absent (CI), online payment is
 * disabled and that — and the resulting "no payment method available"
 * message on submit — is asserted instead.
 */

test("checkout offers online payment only — Cash on delivery is not shown", async ({
  page,
}) => {
  // add an in-stock item
  await page.goto("/the-pooja-edit");
  await page.locator("ul.grid > li a").first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  // COD is gone from the payment method list entirely.
  await expect(page.getByText("Cash on delivery")).toHaveCount(0);

  const prepaid = page.getByRole("radio").first();
  const prepaidEnabled = !(await prepaid.isDisabled());
  if (!prepaidEnabled) {
    await expect(
      page.getByText(/not available in this environment/i),
    ).toBeVisible();
  }

  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Phone").fill("+919812345678");
  await page.getByLabel("Address", { exact: true }).fill("12 Test Lane");
  await page.getByLabel("City").fill("Jaipur");
  await page.getByLabel("State").selectOption({ label: "Rajasthan" });
  await page.getByLabel("PIN code").fill("302001");

  await page.getByRole("button", { name: /review order/i }).click();

  // server-computed quote appears regardless of payment configuration
  await expect(page.getByText("Review & pay")).toBeVisible();
  await expect(page.getByText(/^Total$/)).toBeVisible();
  // the review still never mentions COD
  await expect(page.getByText("Cash on delivery")).toHaveCount(0);

  if (prepaidEnabled) {
    // Real third-party checkout — go as far as opening it, not completing a
    // real payment (that needs live Razorpay test-card entry, out of scope
    // for e2e).
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(page.getByText(/secured by razorpay/i)).toBeVisible();
  } else {
    await page.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(
      page.getByText(/couldn't start the payment|not available/i),
    ).toBeVisible();
  }
});

test("checkout with an empty cart invites you to shop", async ({ page }) => {
  await page.goto("/cart");
  // ensure cart is empty for this context
  await page.evaluate(() => localStorage.removeItem("pe-cart-v1"));
  await page.goto("/checkout");
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});
