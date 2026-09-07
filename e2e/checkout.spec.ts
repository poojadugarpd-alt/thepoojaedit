import { expect, test } from "@playwright/test";

/**
 * Checkout journey (Phase 7). Runs on the legacy dev dataset — requires the dev
 * DB (`npm run db:dev` + seed + legacy import) and a build.
 *
 * Prepaid needs Razorpay test keys, which are not set in local/CI env, so the
 * UI correctly disables online payment and this spec drives the COD path
 * end-to-end. A COD order must never be shown as paid (master §7, AC-09).
 */

test("guest COD checkout places an order that is never shown as paid", async ({
  page,
}) => {
  // add an in-stock item
  await page.goto("/the-pooja-edit");
  await page.locator("ul.grid > li a").first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  // online payment is unavailable without keys → radio disabled, note shown
  const prepaid = page.getByRole("radio").first();
  await expect(prepaid).toBeDisabled();
  await expect(page.getByText(/not available in this environment/i)).toBeVisible();

  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Phone").fill("+919812345678");
  await page.getByLabel("Address", { exact: true }).fill("12 Test Lane");
  await page.getByLabel("City").fill("Jaipur");
  await page.getByLabel("State").selectOption({ label: "Rajasthan" });
  await page.getByLabel("PIN code").fill("302001");

  await page.getByText("Cash on delivery").click();
  await page.getByRole("button", { name: /review order/i }).click();

  // server-computed quote appears
  await expect(page.getByText("Review & pay")).toBeVisible();
  await expect(page.getByText(/^Total$/)).toBeVisible();

  await page.getByRole("button", { name: /place order \(cash on delivery\)/i }).click();

  // landed on the order page
  await expect(page).toHaveURL(/\/order\/PE-[A-Z0-9-]+/);
  await expect(page.getByRole("heading", { name: /Order PE-/ })).toBeVisible();
  await expect(
    page.getByText("PENDING CONFIRMATION", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/we'll message you to confirm/i)).toBeVisible();

  // COD is never "paid"
  const body = await page.textContent("body");
  expect(body).toMatch(/COD PENDING/i);
  expect(body).not.toMatch(/\bPAID\b/);
  await expect(page.getByText("Cash on delivery")).toBeVisible();
});

test("checkout with an empty cart invites you to shop", async ({ page }) => {
  await page.goto("/cart");
  // ensure cart is empty for this context
  await page.evaluate(() => localStorage.removeItem("pe-cart-v1"));
  await page.goto("/checkout");
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});
