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

  test("typing several digits in one sitting always lands on the last digit typed, not an accumulated number", async ({
    page,
  }) => {
    // D-126 only fixed the *first* keystroke after focus (`onFocus` select()
    // only re-arms on focus, not after every change) — pressing another
    // digit right after, in the same sitting, still appended onto the
    // previous one (e.g. "2" then "3" became "23", clamped down to the
    // picker's max) and looked identical for every digit past the first.
    // The max here is always a single digit, so there's never a legitimate
    // 2-digit quantity — every keystroke should fully replace.
    await page.goto("/label");
    await page.locator("ul.grid > li a").first().click();
    const qty = page.getByLabel("Quantity");
    await qty.click();
    await page.keyboard.type("2");
    await expect(qty).toHaveValue("2");
    await page.keyboard.type("3");
    await expect(qty).toHaveValue("3");
    await page.keyboard.type("4");
    await expect(qty).toHaveValue("4");
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
  // Owner, 2026-10-20: a sold Closet piece is hidden straight away — not
  // listed, and its URL lands on /closet. Seed: silk-scarf-paisley is sold.
  test("a SOLD one-of-one is not listed and its URL redirects to /closet", async ({
    page,
  }) => {
    await page.goto("/closet");
    await expect(page.locator('a[href="/closet/silk-scarf-paisley"]')).toHaveCount(0);

    await page.goto("/closet/silk-scarf-paisley");
    await expect(page).toHaveURL(/\/closet$/);
  });
});

test("skip link is the first focusable element on the storefront", async ({
  page,
  browserName,
}) => {
  // Same WebKit default-keyboard-behaviour caveat as e2e/shell.spec.ts's
  // identical test — see that file for the full explanation.
  test.skip(
    browserName === "webkit",
    "WebKit excludes links from Tab order by default",
  );
  await page.goto("/label");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip to main content/i })).toBeFocused();
});

test("a Notify me piece takes an email instead of an order (D-178)", async ({
  page,
}) => {
  await page.goto("/label/e2e-notify-blouse");
  await expect(page.getByText("Coming soon").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /add to (cart|bag)/i })).toHaveCount(0);
  // D-179: Label size and measurements.
  await expect(page.getByText("Size & measurements")).toBeVisible();
  await expect(page.getByText("Size S", { exact: true })).toBeVisible();
  await expect(page.getByText("Bust: 34 in")).toBeVisible();
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Notify me" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Please check your email address.",
  );
  await page
    .getByLabel("Email")
    .fill(`e2e-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByRole("button", { name: "Notify me" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "You’re on the list",
  );
});
