import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { AuthorizationError } from "../../src/server/auth/errors";
import {
  ImageValidationError,
  confirmProductImageUpload,
  moveProductImage,
  requestProductImageUpload,
  setPrimaryProductImage,
} from "../../src/server/catalog/product-images";
import type { StoragePort } from "../../src/lib/storage";
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

/** Fake storage: records the signed path, and reports objects as present. */
function fakeStorage(present = true): StoragePort {
  return {
    async createSignedUploadUrl(bucket, path) {
      return { signedUrl: `https://fake/${bucket}/${path}`, token: "tok", path };
    },
    async statObject() {
      return { exists: present, size: 500_000, contentType: "image/webp" };
    },
    async createSignedDownloadUrl(_b, path) {
      return `https://fake/download/${path}`;
    },
    async deleteObjects() {},
  };
}

async function activeAdmin(): Promise<AdminUser> {
  return db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com` },
  });
}

async function makeProduct() {
  return db.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: "p",
    },
  });
}

describe("requestProductImageUpload", () => {
  it("requires an active admin", async () => {
    const product = await makeProduct();
    await expect(
      requestProductImageUpload(
        { db, storage: fakeStorage(), admin: null },
        { productId: product.id, contentType: "image/webp" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("issues a server-derived path scoped to the product's catalog", async () => {
    const admin = await activeAdmin();
    const product = await makeProduct();
    const ticket = await requestProductImageUpload(
      { db, storage: fakeStorage(), admin },
      { productId: product.id, contentType: "image/webp" },
    );
    expect(ticket.path).toBe(`the-pooja-edit/${product.id}/${ticket.imageId}.webp`);
    expect(ticket.bucket).toBe("product-images");
  });
});

describe("confirmProductImageUpload", () => {
  it("persists a ProductImage row for a confirmed object", async () => {
    const admin = await activeAdmin();
    const product = await makeProduct();
    const ticket = await requestProductImageUpload(
      { db, storage: fakeStorage(), admin },
      { productId: product.id, contentType: "image/webp" },
    );

    const row = await confirmProductImageUpload(
      { db, storage: fakeStorage(true), admin },
      {
        productId: product.id,
        imageId: ticket.imageId,
        path: ticket.path,
        contentType: "image/webp",
        altText: "front",
        type: "PRIMARY",
        isPrimary: true,
        width: 1200,
        height: 1600,
      },
    );
    expect(row.path).toBe(ticket.path);
    expect(row.bucket).toBe("product-images");
    expect(await db.productImage.count()).toBe(1);
  });

  it("rejects a path that was not the one issued (no path takeover)", async () => {
    const admin = await activeAdmin();
    const product = await makeProduct();
    await expect(
      confirmProductImageUpload(
        { db, storage: fakeStorage(true), admin },
        {
          productId: product.id,
          imageId: randomUUID(),
          path: `thrift/${product.id}/evil.webp`,
          contentType: "image/webp",
          altText: "x",
        },
      ),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects when the object is not actually in storage", async () => {
    const admin = await activeAdmin();
    const product = await makeProduct();
    const ticket = await requestProductImageUpload(
      { db, storage: fakeStorage(), admin },
      { productId: product.id, contentType: "image/webp" },
    );
    await expect(
      confirmProductImageUpload(
        { db, storage: fakeStorage(false), admin },
        {
          productId: product.id,
          imageId: ticket.imageId,
          path: ticket.path,
          contentType: "image/webp",
          altText: "x",
        },
      ),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });
});

/** Images straight into the table, as the real upload flow leaves them. */
async function seedImages(
  productId: string,
  rows: { pos: number; primary?: boolean; type?: "PRIMARY" | "GALLERY" | "FLAW" }[],
) {
  const ids: string[] = [];
  for (const [i, r] of rows.entries()) {
    const im = await db.productImage.create({
      data: {
        productId,
        path: `the-pooja-edit/${productId}/${i}.webp`,
        altText: `photo ${i + 1}`,
        sortPosition: r.pos,
        isPrimary: r.primary ?? false,
        type: r.type ?? (r.primary ? "PRIMARY" : "GALLERY"),
      },
    });
    ids.push(im.id);
  }
  return ids;
}

async function gallery(productId: string) {
  const rows = await db.productImage.findMany({
    where: { productId },
    orderBy: { sortPosition: "asc" },
  });
  return rows.map((r) => ({
    alt: r.altText,
    pos: r.sortPosition,
    primary: r.isPrimary,
    type: r.type,
  }));
}

describe("setPrimaryProductImage", () => {
  it("moves the new primary to the front, keeps the rest in order, and demotes the old one", async () => {
    const product = await makeProduct();
    const [, , third] = await seedImages(product.id, [
      { pos: 0, primary: true },
      { pos: 1 },
      { pos: 2 },
      { pos: 3, type: "FLAW" },
    ]);
    await setPrimaryProductImage(db, product.id, third);
    expect(await gallery(product.id)).toEqual([
      { alt: "photo 3", pos: 0, primary: true, type: "PRIMARY" },
      { alt: "photo 1", pos: 1, primary: false, type: "GALLERY" },
      { alt: "photo 2", pos: 2, primary: false, type: "GALLERY" },
      { alt: "photo 4", pos: 3, primary: false, type: "FLAW" },
    ]);
  });

  it("leaves no two images sharing a position (the old code forced the primary to 0)", async () => {
    const product = await makeProduct();
    const [, second] = await seedImages(product.id, [
      { pos: 0, primary: true },
      { pos: 1 },
    ]);
    await setPrimaryProductImage(db, product.id, second);
    const positions = (await gallery(product.id)).map((g) => g.pos);
    expect(new Set(positions).size).toBe(positions.length);
  });
});

describe("moveProductImage", () => {
  it("swaps with the neighbour", async () => {
    const product = await makeProduct();
    const [, , third] = await seedImages(product.id, [
      { pos: 0, primary: true },
      { pos: 1 },
      { pos: 2 },
    ]);
    await moveProductImage(db, product.id, third, "up");
    expect((await gallery(product.id)).map((g) => g.alt)).toEqual([
      "photo 1",
      "photo 3",
      "photo 2",
    ]);
  });

  it("still moves an image whose position is shared with its neighbour", async () => {
    const product = await makeProduct();
    // What production had after "Primary" forced a photo to 0: a tie.
    const [first, second] = await seedImages(product.id, [
      { pos: 0 },
      { pos: 0, primary: true },
      { pos: 1 },
    ]);
    const before = (await gallery(product.id)).map((g) => g.alt);
    const lower = before[1] === "photo 1" ? first : second;
    await moveProductImage(db, product.id, lower, "up");
    const after = await gallery(product.id);
    expect(after.map((g) => g.alt)).toEqual([before[1], before[0], before[2]]);
    expect(after.map((g) => g.pos)).toEqual([0, 1, 2]);
  });

  it("is a no-op at either end", async () => {
    const product = await makeProduct();
    const [first, , last] = await seedImages(product.id, [
      { pos: 0, primary: true },
      { pos: 1 },
      { pos: 2 },
    ]);
    await moveProductImage(db, product.id, first, "up");
    await moveProductImage(db, product.id, last, "down");
    expect((await gallery(product.id)).map((g) => g.alt)).toEqual([
      "photo 1",
      "photo 2",
      "photo 3",
    ]);
  });
});
