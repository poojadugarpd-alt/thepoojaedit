import { expect, test } from "@playwright/test";

/**
 * Storefront journeys on the legacy dev dataset (Phase 4). Requires the dev DB
 * (`npm run db:dev` + `npm run db:seed` + the legacy import) and a build.
 */

test.describe("guest browse", () => {
  test("listing → product detail renders with price and add-to-cart", async ({
    page,
  }) => {
    await page.goto("/closet");
    await expect(
      page.getByRole("heading", { level: 1, name: "The Closet" }),
    ).toBeVisible();

    const firstCard = page.locator("ul.grid > li a").first();
    await firstCard.click();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/₹/).first()).toBeVisible();
  });

  test("no horizontal overflow at 360px on listing and PDP", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of ["/label", "/closet"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${path}`).toBe(false);
    }
    await page.goto("/closet");
    await page.locator("ul.grid > li a").first().click();
    const pdpOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(pdpOverflow).toBe(false);
  });
});

test.describe("quantity picker (D-126)", () => {
  test("typing a digit right after focusing replaces the pre-filled 1, doesn't append to it", async ({
    page,
  }) => {
    await page.goto("/label");
    await page.locator("ul.grid > li a").first().click();
    const qty = page.getByLabel("Quantity");
    await expect(qty).toHaveValue("1");
    // A bare click (not a select-all) used to leave the existing "1" in
    // place, so the very next digit typed appended onto it (e.g. "1" + "2"
    // = "12") and silently clamped down to the picker's max — which looked
    // identical no matter what digit was typed, exactly the owner's report
    // ("press 2, 3, 4 on the keyboard, it jumps to 9").
    await qty.click();
    await page.keyboard.type("2");
    await expect(qty).toHaveValue("2");
  });
});

test.describe("mixed cart (AC-01)", () => {
  test("holds items from both catalogues and survives a reload", async ({ page }) => {
    // add a THE_POOJA_EDIT item
    await page.goto("/label");
    await page.locator("ul.grid > li a").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    // add a THRIFT item
    await page.goto("/closet");
    const inStock = page
      .locator("ul.grid > li")
      .filter({ hasNot: page.getByText("SOLD") })
      .first();
    await inStock.locator("a").click();
    const addBtn = page.getByRole("button", { name: /add to cart/i });
    if (await addBtn.isEnabled()) await addBtn.click();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    const labelSection = page.getByRole("heading", { level: 2, name: "The Label" });
    await expect(labelSection).toBeVisible();
    await expect(page.getByText(/Subtotal \(\d+ items?\)/)).toBeVisible();
    // per-item return policy disclosure present
    await expect(
      page.getByText(/final sale|returns & exchanges/i).first(),
    ).toBeVisible();

    // reload — cart persists (localStorage)
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 2, name: "The Label" }),
    ).toBeVisible();
    await expect(page.getByText(/Subtotal \(\d+ items?\)/)).toBeVisible();
  });
});

test.describe("sold thrift (AC-02)", () => {
  test("a SOLD one-of-one URL resolves and offers no buyable control", async ({
    page,
  }) => {
    await page.goto("/closet");
    // Sold-out pieces are deliberately sorted to the end of the listing
    // (owner request, 2026-09-14), so on a catalog with more in-stock pieces
    // than fit on one page, a SOLD card only shows up after paging in —
    // "Load more" a bounded number of times rather than assuming page 1.
    const soldCard = page
      .locator("ul.grid > li")
      .filter({ has: page.getByText("SOLD") })
      .first();
    const loadMore = page.getByRole("button", { name: /load more/i });
    for (let i = 0; i < 6 && (await soldCard.count()) === 0; i++) {
      if (!(await loadMore.isVisible().catch(() => false))) break;
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/catalog/")),
        loadMore.click(),
      ]);
      await response.finished();
    }
    await expect(soldCard).toBeVisible();
    await soldCard.locator("a").click();

    await expect(page).toHaveURL(/\/closet\/[^/]+$/);
    await expect(page.getByText(/this piece has sold/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^add to cart$/i })).toHaveCount(0);
  });
});

test("skip link is the first focusable element on the storefront", async ({
  page,
  browserName,
}) => {
  // Same WebKit default-keyboard-behaviour caveat as e2e/shell.spec.ts's
  // identical test — see that file for the full explanation.
  test.skip(browserName === "webkit", "WebKit excludes links from Tab order by default");
  await page.goto("/label");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to main content/i })).toBeFocused();
});
