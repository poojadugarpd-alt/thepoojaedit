import { expect, test } from "@playwright/test";

test.describe("application shell", () => {
  test("homepage offers both catalogue entrances", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /one brand, two ways to shop/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /shop the pooja edit/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /shop thrift store/i })).toBeVisible();
  });

  test("primary navigation reaches both catalogues", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "The Pooja Edit", exact: true })
      .click();
    await expect(page).toHaveURL(/\/the-pooja-edit$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "The Pooja Edit" }),
    ).toBeVisible();

    await page.goto("/thrift");
    await expect(
      page.getByRole("heading", { level: 1, name: "Thrift Store" }),
    ).toBeVisible();
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
