import { expect, test } from "@playwright/test";

/**
 * D-163: Pooja makes a Look in admin from her own pieces, previews the
 * draft, publishes it, and a shopper adds a piece to the cart from it.
 * Every project shares one database, so each run makes its own Look.
 */
test("create, publish and shop a Look", async ({ page }) => {
  const title = `E2E Look ${Math.random().toString(36).slice(2, 8)}`;

  await page.goto("/admin/looks");
  await expect(page.getByRole("heading", { name: "Looks", exact: true })).toBeVisible();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const editorUrl = page.url();

  // Add a seeded Label piece through the search box.
  await expect(async () => {
    await page.getByLabel("Add a piece").fill("Marigold");
    await expect(page.getByText("Marigold Cotton Kurta")).toBeVisible({
      timeout: 2000,
    });
  }).toPass();
  let reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await reloaded;
  await expect(page.getByRole("heading", { name: "Pieces (1)" })).toBeVisible();

  // The draft is visible to admin with a banner.
  const slug = (await page.getByLabel("Web address").inputValue()).trim();
  await page.goto(`/looks/${slug}`);
  await expect(page.getByText("Draft: only you can see this Look")).toBeVisible();

  await page.goto(editorUrl);
  reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Publish" }).click();
  await reloaded;
  await expect(page.getByRole("button", { name: "Back to draft" })).toBeVisible();
  await expect(page.getByLabel("Link for Instagram")).toHaveValue(
    new RegExp(
      `/looks/${slug}\\?utm_source=instagram&utm_medium=look&utm_campaign=${slug}$`,
    ),
  );

  await page.goto(`/looks/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Draft: only you can see this Look")).toHaveCount(0);
  const piece = page.getByRole("listitem").filter({ hasText: "Marigold Cotton Kurta" });
  await expect(async () => {
    await piece.getByRole("button", { name: "Add to cart" }).click();
    await expect(piece.getByText("Added to cart.")).toBeVisible({ timeout: 1000 });
  }).toPass();

  await page.goto("/looks");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
});

test("an unknown Look is a 404", async ({ page }) => {
  const res = await page.goto("/looks/no-such-look-here");
  expect(res?.status()).toBe(404);
});
