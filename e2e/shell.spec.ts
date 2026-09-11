import { expect, test } from "@playwright/test";

test.describe("application shell", () => {
  test("homepage offers both catalogue entrances", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /one brand, two ways to shop/i }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /shop the label/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /shop the closet/i })).toBeVisible();
  });

  test("primary navigation reaches both catalogues", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Label", exact: true })
      .click();
    await expect(page).toHaveURL(/\/label$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "The Label" }),
    ).toBeVisible();

    await page.goto("/closet");
    await expect(
      page.getByRole("heading", { level: 1, name: "The Closet" }),
    ).toBeVisible();
  });

  test("old catalog URLs permanently redirect to the renamed ones (D-93)", async ({
    request,
  }) => {
    const cases: [string, string][] = [
      ["/the-pooja-edit", "/label"],
      ["/thrift", "/closet"],
      ["/thrift/vintage-denim-jacket", "/closet/vintage-denim-jacket"],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([301, 308], `${from} status`).toContain(res.status());
      expect(res.headers()["location"], `${from} location`).toContain(to);
    }
  });

  test("brand logo and icons (D-96)", async ({ page, request }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "The Pooja Edit by Pooja Dugar — home" }),
    ).toBeVisible();

    for (const path of [
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }

    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("skip link is the first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: /skip to main content/i }),
    ).toBeFocused();
  });

  test("health endpoint responds ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
