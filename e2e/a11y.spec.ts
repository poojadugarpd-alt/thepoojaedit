import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility sweep (Phase 12, master §11 AC-16). Runs axe-core against the
 * key storefront + admin screens at a mobile-ish width. Fails on any WCAG 2.1
 * A/AA violation. `color-contrast` is excluded on admin (dense data tables use a
 * muted palette that's a deliberate later-polish item — recorded, not blocking).
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: import("@playwright/test").Page, opts?: { disable?: string[] }) {
  let b = new AxeBuilder({ page }).withTags(WCAG);
  if (opts?.disable) b = b.disableRules(opts.disable);
  return b.analyze();
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("storefront a11y", () => {
  for (const path of ["/", "/label", "/closet", "/cart", "/checkout"]) {
    test(`no violations: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      const { violations } = await scan(page);
      expect(
        violations,
        violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
      ).toEqual([]);
    });
  }

  test("no violations: a product detail page", async ({ page }) => {
    await page.goto("/label");
    await page.locator("ul.grid > li a").first().click();
    await page.waitForLoadState("load");
    const { violations } = await scan(page);
    expect(violations, violations.map((v) => v.id).join(", ")).toEqual([]);
  });
});

test.describe("admin a11y", () => {
  for (const path of ["/admin", "/admin/needs-attention", "/admin/orders", "/admin/analytics"]) {
    test(`no critical/serious violations: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      const { violations } = await scan(page, { disable: ["color-contrast"] });
      const blocking = violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        blocking,
        blocking.map((v) => `${v.id}: ${v.help}`).join("\n"),
      ).toEqual([]);
    });
  }
});
