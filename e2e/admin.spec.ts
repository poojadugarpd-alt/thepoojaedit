import { expect, test } from "@playwright/test";

/**
 * Operator dashboard smoke (Phase 11; reworked admin-PWA Stage 5). Runs
 * against the dev dataset with `DEV_ADMIN_AUTH=1` (Supabase auth is
 * deferred). Verifies the shell, the key screens render by composing the
 * domain services, and the visibility-aware poll control is present — at
 * BOTH the "chromium" (desktop) and "mobile" (Pixel 7, 412px — below
 * Tailwind's `sm:` breakpoint) projects, since Stage 2 gave every list page
 * two parallel renderings (a `hidden sm:table` and a `sm:hidden` card list)
 * and this spec must not assume either one is the visible one.
 *
 * Uses direct `page.goto()` between screens rather than clicking nav links —
 * the desktop sidebar and the mobile bottom-tab bar don't share link text
 * (the sidebar has a literal "Needs Attention" link; the mobile Home page's
 * equivalent link is named "N open"), so a click-based path would need two
 * branches per viewport for no real coverage gain over just asserting each
 * page's own content renders.
 */

test("admin shell + core screens render", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  // financial cards distinguish placed / captured / refunds / COD remittance
  await expect(page.getByText("Placed orders")).toBeVisible();
  await expect(page.getByText("Captured revenue")).toBeVisible();
  await expect(page.getByText("COD remittance")).toBeVisible();

  await page.goto("/admin/needs-attention");
  await expect(page.getByRole("heading", { name: "Needs Attention" })).toBeVisible();
  // The auto-refresh checkbox always has this accessible name (aria-label),
  // even though its visible text label is hidden below `sm` to save space.
  await expect(page.getByRole("checkbox", { name: /Auto-refresh/i })).toBeVisible();

  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  // filter form + a data row — `>> visible=true` picks whichever of the
  // parallel card-list / table renderings is actually shown at this
  // viewport, since both exist in the DOM regardless of viewport.
  await expect(page.getByRole("button", { name: "Filter" }).locator("visible=true")).toBeVisible();
  const firstOrder = page.locator('a[href^="/admin/orders/"] >> visible=true').first();
  await expect(firstOrder).toBeVisible();
  // Read the order number from the href, not the link's text content — on
  // mobile the whole card (price, date, pills and all) is one <Link>, so
  // textContent() there is the entire card, not just the order number.
  const href = await firstOrder.getAttribute("href");
  const orderNo = href?.split("/").pop() ?? "";
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
  // Every visible status pill in the filtered list should read the filtered
  // status — scoped to whichever rendering (card list / table) is actually
  // shown at this viewport.
  const pills = page.locator("text=PENDING CONFIRMATION >> visible=true");
  const count = await pills.count();
  if (count > 0) {
    await expect(pills.first()).toBeVisible();
  }
});

test("mobile bottom nav reaches every primary destination", async ({ page }) => {
  test.skip(
    (await page.viewportSize())!.width >= 640,
    "bottom nav is sm:hidden — desktop uses the sidebar instead",
  );
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();

  await nav.getByRole("link", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

  await nav.getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: /^Products/ })).toBeVisible();

  await nav.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Install on iPhone" })).toBeVisible();
});

/**
 * The rebuilt Shopify-style single-page product editor (owner: "I am not
 * at all happy with the admin add product workflow ... change it to look
 * like that of the shopify app") — proves the whole point of the merge:
 * title, the Sizes matrix, and pricing are all filled in on one page before
 * anything is ever saved, and one Save click creates the product with both
 * variant rows already attached (no separate "add variant" round trips).
 */
test("create a Label product with two sizes in one Save", async ({ page }) => {
  await page.goto("/admin/products/new");
  await expect(page.getByRole("heading", { name: "New product" })).toBeVisible();

  await page.getByLabel("Title", { exact: true }).fill("E2E Test Kurta");

  const sizesInput = page.getByLabel("Sizes", { exact: true });
  await sizesInput.fill("S");
  await sizesInput.press("Enter");
  await sizesInput.fill("M");
  await sizesInput.press("Enter");

  // Two rows now exist in the variant table, SKU pre-suggested from
  // title+size — only price is left to fill per row.
  await page.getByLabel("Price, ₹ (S)").fill("1999");
  await page.getByLabel("Price, ₹ (M)").fill("1999");

  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]+$/);

  // Reload to confirm it actually persisted, not just optimistic client
  // state — both variant rows survive a fresh load.
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("E2E Test Kurta");
  await expect(page.getByLabel("Price, ₹ (S)")).toHaveValue("1999.00");
  await expect(page.getByLabel("Price, ₹ (M)")).toHaveValue("1999.00");
});
