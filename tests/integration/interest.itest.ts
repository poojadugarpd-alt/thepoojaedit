import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  interestCounts,
  InterestUnavailableError,
  listInterest,
  registerInterest,
} from "../../src/server/catalog/interest";
import { getPublishedProduct } from "../../src/server/catalog/queries";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;
beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
});

async function makePiece(opts: {
  notifyOnly: boolean;
  status?: "DRAFT" | "PUBLISHED";
}) {
  const status = opts.status ?? "PUBLISHED";
  return db.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug: `blouse-${randomUUID().slice(0, 6)}`,
      title: "Pink Halter Blouse",
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      notifyOnly: opts.notifyOnly,
      variants: {
        create: {
          sku: `SKU-${randomUUID().slice(0, 8)}`,
          size: "S",
          pricePaise: 250000,
          onHandQty: 1,
        },
      },
    },
  });
}

describe("Notify me (D-178)", () => {
  it("keeps one row per email per piece, lower-cased, with the UTM", async () => {
    const p = await makePiece({ notifyOnly: true });
    const target = { catalog: "THE_POOJA_EDIT" as const, slug: p.slug };
    await registerInterest(db, {
      ...target,
      email: "Asha@Example.com",
      utm: { source: "instagram", medium: "bio", campaign: "profile" },
    });
    await registerInterest(db, { ...target, email: "asha@example.com " });
    await registerInterest(db, { ...target, email: "ravi@example.com" });

    const rows = await listInterest(db, p.id);
    expect(rows.map((r) => r.email).sort()).toEqual([
      "asha@example.com",
      "ravi@example.com",
    ]);
    expect(rows.find((r) => r.email === "asha@example.com")?.utmSource).toBe(
      "instagram",
    );
    expect((await interestCounts(db)).get(p.id)).toBe(2);
  });

  it("refuses pieces that are on sale, unpublished or missing", async () => {
    const onSale = await makePiece({ notifyOnly: false });
    const draft = await makePiece({ notifyOnly: true, status: "DRAFT" });
    for (const slug of [onSale.slug, draft.slug, "no-such-piece"]) {
      await expect(
        registerInterest(db, { catalog: "THE_POOJA_EDIT", slug, email: "a@b.co" }),
      ).rejects.toBeInstanceOf(InterestUnavailableError);
    }
  });

  it("rejects a bad email", async () => {
    const p = await makePiece({ notifyOnly: true });
    await expect(
      registerInterest(db, { catalog: "THE_POOJA_EDIT", slug: p.slug, email: "nope" }),
    ).rejects.toThrow();
  });

  it("shows the piece as not buyable on the storefront", async () => {
    const p = await makePiece({ notifyOnly: true });
    const detail = await getPublishedProduct(db, "THE_POOJA_EDIT", p.slug);
    expect(detail?.notifyOnly).toBe(true);
    expect(detail?.variants.every((v) => !v.available && v.maxOrderQty === 0)).toBe(
      true,
    );
  });
});
