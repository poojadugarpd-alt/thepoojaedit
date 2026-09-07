import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { AuthorizationError } from "../../src/server/auth/errors";
import {
  ImageValidationError,
  confirmProductImageUpload,
  requestProductImageUpload,
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
