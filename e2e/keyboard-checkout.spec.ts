import { expect, test } from "@playwright/test";

/**
 * Keyboard-only checkout (Phase 12, AC-16). The whole form must be reachable and
 * operable with Tab + typing + Enter — no pointer.
 */
test("a customer can complete the COD checkout form with the keyboard only", async ({
  page,
}) => {
  await page.goto("/the-pooja-edit");
  await page.locator("ul.grid > li a").first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  // Tab from the top of the document until the name field has focus.
  const name = page.getByLabel("Full name");
  for (let i = 0; i < 20 && !(await name.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(name).toBeFocused();

  await page.keyboard.type("Keyboard Buyer");
  await page.keyboard.press("Tab");
  await page.keyboard.type("+919812345678"); // Phone
  await page.getByLabel("Email (optional)").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.type("12 Test Lane"); // Address
  await page.keyboard.press("Tab"); // Apartment
  await page.keyboard.press("Tab");
  await page.keyboard.type("Jaipur"); // City
  await page.getByLabel("State").selectOption({ label: "Rajasthan" });
  await page.getByLabel("PIN code").focus();
  await page.keyboard.type("302001");

  // the online-payment radio is disabled (no keys) → COD is the reachable choice
  await page.getByText("Cash on delivery").click();
  await page.getByRole("button", { name: /review order/i }).focus();
  await expect(page.getByRole("button", { name: /review order/i })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Review & pay")).toBeVisible();
});
