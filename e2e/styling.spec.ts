import { expect, test } from "@playwright/test";

// The second test needs the page the first one publishes.
test.describe.configure({ mode: "serial" });

/**
 * D-162: Pooja fills in and publishes /styling from admin, a shopper sends an
 * enquiry, and it lands in Admin → Styling. Every project shares one
 * database, so each run saves the same page content and uses its own name.
 */
test("publish the Styling page, send an enquiry, see it in admin", async ({ page }) => {
  const name = `E2E Client ${Math.random().toString(36).slice(2, 8)}`;

  await page.goto("/admin/styling/edit");
  await expect(page.getByRole("heading", { name: "Styling page" })).toBeVisible();
  await page.getByRole("textbox", { name: "Title" }).first().fill("Wardrobe edit");
  await page
    .getByRole("textbox", { name: "What's included (one point per line)" })
    .first()
    .fill("A closet review\nA shopping list");
  await page.getByRole("textbox", { name: "Fee" }).first().fill("₹5,000");
  await page.getByLabel("Send enquiries to (email)").fill("pooja@example.com");
  // A successful save reloads the page (ActionForm reloadOnSuccess).
  let reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Save page" }).click();
  await reloaded;
  await expect(page.getByText("Add at least one offer.")).toHaveCount(0);
  // Publish, unless another project already did.
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  if (await publish.isVisible()) {
    reloaded = page.waitForEvent("load");
    await publish.click();
    await reloaded;
  }
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  await page.goto("/styling");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wardrobe edit" })).toBeVisible();
  await expect(page.getByText("₹5,000")).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Personal styling" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill("client@example.com");
  await page.getByLabel("City / country").fill("Dubai, UAE");
  await page.getByLabel("Service").selectOption("Wardrobe edit");
  await page
    .getByLabel("What are you looking for?")
    .fill("Help planning outfits for a wedding season.");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Enquiry sent",
  );

  await page.goto("/admin/styling");
  const row = page.getByRole("link", { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await page.goto((await row.getAttribute("href"))!);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(
    page.getByText("Help planning outfits for a wedding season."),
  ).toBeVisible();
});

test("the enquiry form shows field errors and keeps what was typed", async ({
  page,
}) => {
  await page.goto("/styling");
  // Skip on a fresh database where the page hasn't been published yet.
  test.skip((await page.getByRole("button", { name: "Send enquiry" }).count()) === 0);
  await page.getByLabel("Name").fill("Short Message");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("City / country").fill("Pune");
  await page.getByLabel("What are you looking for?").fill("hi");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Please check the highlighted fields",
  );
  await expect(page.getByText("Please check your email address.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Short Message");
});

test("the styling guides show live fees and link back to the enquiry form", async ({
  page,
}) => {
  await page.goto("/styling");
  // Skip on a fresh database where the page hasn't been published yet.
  test.skip((await page.getByRole("button", { name: "Send enquiry" }).count()) === 0);
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
  await page
    .getByRole("link", { name: "Shopping in India from abroad" })
    .first()
    .click();

  await expect(page).toHaveURL(/\/styling\/nri$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your personal shopper in India, wherever you live",
  );
  // The fee list comes from Admin → Styling (saved by the first test).
  await expect(page.getByRole("heading", { name: "Wardrobe edit" })).toBeVisible();
  await page.getByRole("link", { name: "Send an enquiry" }).first().click();
  await expect(page).toHaveURL(/\/styling#enquire$/);

  const missing = await page.goto("/styling/not-a-guide");
  expect(missing?.status()).toBe(404);
});
