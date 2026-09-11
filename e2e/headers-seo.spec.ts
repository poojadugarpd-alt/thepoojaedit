import { expect, test } from "@playwright/test";

/**
 * Cache isolation + SEO review (Phase 12, master §11 AC-16).
 *  - Public catalog data is shared-cacheable; anything customer- or admin-scoped
 *    is not (`private` / `no-store`) and is `noindex`.
 *  - robots.txt / sitemap.xml serve; canonical + OG + JSON-LD on PDPs.
 */

test("public catalog API is shared-cacheable; private surfaces are not", async ({
  request,
}) => {
  const api = await request.get("/api/catalog/label/products?limit=1");
  expect(api.ok()).toBeTruthy();
  const cc = api.headers()["cache-control"] ?? "";
  expect(cc).toMatch(/s-maxage|max-age/);
  expect(cc).not.toMatch(/no-store/);
  expect(cc).not.toMatch(/private/);
});

test("robots.txt and sitemap.xml serve and gate the right paths", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  const body = await robots.text();
  for (const p of ["/admin", "/cart", "/checkout", "/account"]) {
    expect(body).toContain(`Disallow: ${p}`);
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("<urlset");
});

test("cart / checkout / admin are noindex", async ({ page }) => {
  for (const path of ["/cart", "/checkout", "/admin"]) {
    await page.goto(path);
    const robots = page.locator('head meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  }
});

test("a PDP carries canonical, OG tags and Product JSON-LD", async ({ page }) => {
  await page.goto("/label");
  await page.locator("ul.grid > li a").first().click();
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toBeTruthy();
  expect(JSON.parse(ld!)["@type"]).toBe("Product");
});
