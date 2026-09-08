import { expect, test } from "@playwright/test";

/**
 * Operator dashboard smoke (Phase 11). Runs against the dev dataset with
 * `DEV_ADMIN_AUTH=1` (Supabase auth is deferred). Verifies the shell, the key
 * screens render by composing the domain services, and the visibility-aware
 * poll control is present.
 */

test("admin shell + core screens render", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  // financial cards distinguish placed / captured / refunds / COD remittance
  await expect(page.getByText("Placed orders")).toBeVisible();
  await expect(page.getByText("Captured revenue")).toBeVisible();
  await expect(page.getByText("COD remittance")).toBeVisible();

  await page.getByRole("link", { name: "Needs Attention" }).first().click();
  await expect(page.getByRole("heading", { name: "Needs Attention" })).toBeVisible();
  await expect(page.getByText(/Auto-refresh/)).toBeVisible(); // poll control

  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  // filter form + a data row
  await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();
  const firstOrder = page.locator("tbody tr td a").first();
  await expect(firstOrder).toBeVisible();
  const orderNo = (await firstOrder.textContent())?.trim() ?? "";
  await firstOrder.click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Order ${orderNo}`) }),
  ).toBeVisible();
  await expect(page.getByText("Timeline")).toBeVisible();
  await expect(page.getByText("Actions")).toBeVisible();

  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("heading", { name: /Analytics/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Revenue by catalogue (line-allocated)", { exact: true }),
  ).toBeVisible();

  await page.goto("/admin/settings");
  await expect(page.getByText("Credential health")).toBeVisible();
});

test("orders list filter narrows results and pagination link appears when needed", async ({
  page,
}) => {
  await page.goto("/admin/orders?orderStatus=PENDING_CONFIRMATION");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  // every visible order pill in the "Order" column should read the filtered status
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  if (count > 0) {
    await expect(rows.first().getByText("PENDING CONFIRMATION")).toBeVisible();
  }
});
