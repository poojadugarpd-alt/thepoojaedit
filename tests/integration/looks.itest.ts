import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { ValidationError } from "../../src/server/catalog/admin";
import {
  addLookItem,
  createLook,
  getLookBySlug,
  listPublishedLooks,
  moveLookItem,
  removeLookItem,
  searchProductsForLook,
  setLookStatus,
  updateLookDetails,
} from "../../src/server/looks";
import { makeClient, resetDb } from "./helpers";

/** Looks — "Shop this Reel" pages (D-163). */

let db: PrismaClient;
let admin: AdminUser;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  admin = await db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
});

async function makeProduct(
  title: string,
  opts: { closet?: boolean; draft?: boolean } = {},
) {
  const tc = await db.taxClass.create({
    data: { code: `TC-${randomUUID().slice(0, 8)}`, name: "5%" },
  });
  return db.product.create({
    data: {
      catalog: opts.closet ? "THRIFT" : "THE_POOJA_EDIT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title,
      status: opts.draft ? "DRAFT" : "PUBLISHED",
      publishedAt: opts.draft ? null : new Date(),
      taxClassId: tc.id,
      variants: {
        create: {
          sku: `SKU-${randomUUID().slice(0, 8)}`,
          size: "M",
          pricePaise: 199_900,
          onHandQty: 2,
        },
      },
    },
  });
}

describe("Looks", () => {
  it("starts as a hidden draft with a slug from its title", async () => {
    const look = await createLook(db, admin, { title: "Diwali Linen Edit" });
    expect(look.slug).toBe("diwali-linen-edit");
    expect(look.status).toBe("DRAFT");
    expect(await getLookBySlug(db, look.slug)).toBeNull();
    expect(await getLookBySlug(db, look.slug, { includeDrafts: true })).not.toBeNull();
    const again = await createLook(db, admin, { title: "Diwali linen edit" });
    expect(again.slug).toBe("diwali-linen-edit-2");
  });

  it("won't publish without a published piece, then shows only live pieces in order", async () => {
    const look = await createLook(db, admin, { title: "Weekend" });
    await expect(setLookStatus(db, admin, look.id, true)).rejects.toBeInstanceOf(
      ValidationError,
    );

    const kurta = await makeProduct("Label kurta");
    const shirt = await makeProduct("Closet shirt", { closet: true });
    const draft = await makeProduct("Unreleased", { draft: true });
    for (const p of [kurta, shirt, draft]) await addLookItem(db, admin, look.id, p.id);
    await moveLookItem(db, admin, look.id, shirt.id, "up");
    await setLookStatus(db, admin, look.id, true);

    const pub = await getLookBySlug(db, look.slug);
    expect(pub?.products.map((p) => p.title)).toEqual(["Closet shirt", "Label kurta"]);
    expect(pub?.products[0].variants[0].available).toBe(true);
    expect(await listPublishedLooks(db)).toHaveLength(1);

    await removeLookItem(db, admin, look.id, shirt.id);
    expect((await getLookBySlug(db, look.slug))?.products).toHaveLength(1);
  });

  it("search finds published pieces from both catalogues, minus ones already added", async () => {
    const look = await createLook(db, admin, { title: "Mix" });
    const a = await makeProduct("Stripe kurta");
    await makeProduct("Stripe shirt", { closet: true });
    await makeProduct("Stripe draft", { draft: true });
    await addLookItem(db, admin, look.id, a.id);
    const found = await searchProductsForLook(db, look.id, "stripe");
    expect(found.map((f) => f.title)).toEqual(["Stripe shirt"]);
  });

  it("validates the Instagram link and keeps web addresses unique", async () => {
    const one = await createLook(db, admin, { title: "One" });
    const two = await createLook(db, admin, { title: "Two" });
    const base = { title: "Two", caption: "", coverAlt: "" };
    await expect(
      updateLookDetails(db, admin, two.id, {
        ...base,
        slug: "",
        reelUrl: "http://x.com",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateLookDetails(db, admin, two.id, { ...base, slug: one.slug, reelUrl: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
    const ok = await updateLookDetails(db, admin, two.id, {
      ...base,
      slug: "Two Again!",
      reelUrl: "https://www.instagram.com/reel/abc/",
    });
    expect(ok.slug).toBe("two-again");
    expect(ok.reelUrl).toBe("https://www.instagram.com/reel/abc/");
  });
});
