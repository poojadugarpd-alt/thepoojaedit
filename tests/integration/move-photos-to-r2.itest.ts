import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import type { StoragePort } from "../../src/lib/storage";
import {
  listPhotosNotOnR2,
  moveHomeMediaToR2,
  moveProductPhotoToR2,
  r2MoveStatus,
  type MoveDeps,
} from "../../src/server/catalog/move-photos-to-r2";
import {
  confirmProductImageUpload,
  requestProductImageUpload,
} from "../../src/server/catalog/product-images";
import { getHomeContent } from "../../src/server/settings";
import { makeClient, resetDb } from "./helpers";

/** Public photos move from Supabase Storage to Cloudflare R2 (D-159). */

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

const SB = "https://proj.supabase.co/storage/v1/object/public";

function fakeDeps(files: Record<string, Uint8Array>) {
  const puts: { key: string; contentType: string; bytes: number }[] = [];
  const deps: MoveDeps = {
    async fetchBytes(url) {
      return files[url] ?? null;
    },
    async putR2(key, bytes, contentType) {
      puts.push({ key, contentType, bytes: bytes.byteLength });
    },
  };
  return { deps, puts };
}

async function makeProduct() {
  return db.product.create({
    data: {
      catalog: "THRIFT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: "Saree",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
}

async function makeImage(data: { bucket: string; path: string; publicUrl?: string }) {
  const p = await makeProduct();
  return db.productImage.create({ data: { productId: p.id, altText: "x", ...data } });
}

describe("moveProductPhotoToR2", () => {
  it("copies a Supabase photo to R2 under <bucket>/<path>, repoints the row and audits it", async () => {
    const url = `${SB}/product-images/thrift/p1/a-1600.jpg`;
    const img = await makeImage({
      bucket: "product-images",
      path: "thrift/p1/a-1600.jpg",
      publicUrl: url,
    });
    const { deps, puts } = fakeDeps({ [url]: new Uint8Array(1234) });

    const r = await moveProductPhotoToR2(db, deps, {
      imageId: img.id,
      adminUserId: admin.id,
    });
    expect(r).toEqual({
      outcome: "moved",
      bytes: 1234,
      key: "product-images/thrift/p1/a-1600.jpg",
    });
    expect(puts).toEqual([
      {
        key: "product-images/thrift/p1/a-1600.jpg",
        contentType: "image/jpeg",
        bytes: 1234,
      },
    ]);
    expect(
      await db.productImage.findUniqueOrThrow({ where: { id: img.id } }),
    ).toMatchObject({
      bucket: "r2",
      path: "product-images/thrift/p1/a-1600.jpg",
      publicUrl: null,
    });
    const audit = await db.adminActivityLog.findFirstOrThrow({
      where: { action: "product_image.moved_to_r2", entityId: img.id },
    });
    expect(audit.before).toMatchObject({
      bucket: "product-images",
      path: "thrift/p1/a-1600.jpg",
    });

    // Second run: nothing copied again.
    expect(
      await moveProductPhotoToR2(db, deps, { imageId: img.id, adminUserId: admin.id }),
    ).toEqual({ outcome: "skipped", reason: "already on R2" });
    expect(puts).toHaveLength(1);
    expect(await listPhotosNotOnR2(db)).toEqual([]);
    expect(await r2MoveStatus(db)).toEqual({ total: 1, onR2: 1 });
  });

  it("uses the real object behind a legacy-import row, and skips files it can't fetch or that aren't on Supabase", async () => {
    const url = `${SB}/product-images/images/thepoojaedit/kurti-1/00-b.png`;
    const legacy = await makeImage({
      bucket: "legacy-import",
      path: "kurti-1/0",
      publicUrl: url,
    });
    const gone = await makeImage({
      bucket: "product-images",
      path: "thrift/p2/gone.jpg",
      publicUrl: `${SB}/product-images/thrift/p2/gone.jpg`,
    });
    const shopify = await makeImage({
      bucket: "legacy-import",
      path: "x/0",
      publicUrl: "https://cdn.shopify.com/s/files/x.jpg",
    });
    const { deps, puts } = fakeDeps({ [url]: new Uint8Array(10) });

    const run = (imageId: string) =>
      moveProductPhotoToR2(db, deps, { imageId, adminUserId: admin.id });
    expect(await run(legacy.id)).toMatchObject({
      outcome: "moved",
      key: "product-images/images/thepoojaedit/kurti-1/00-b.png",
    });
    expect(puts[0].contentType).toBe("image/png");
    expect(await run(gone.id)).toEqual({
      outcome: "skipped",
      reason: "file not reachable",
    });
    expect(await run(shopify.id)).toEqual({
      outcome: "skipped",
      reason: "not a Supabase Storage file",
    });
    expect(
      (await db.productImage.findUniqueOrThrow({ where: { id: gone.id } })).bucket,
    ).toBe("product-images");
  });
});

describe("moveHomeMediaToR2", () => {
  it("moves uploaded home media and leaves auto slots alone", async () => {
    const url = `${SB}/site-media/home/editorial/m1.jpg`;
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: {
          media: {
            editorial: {
              kind: "image",
              bucket: "site-media",
              path: "home/editorial/m1.jpg",
              url,
              alt: "Banner",
            },
            editorialMobile: { kind: "auto" },
          },
        },
      },
    });
    const { deps, puts } = fakeDeps({ [url]: new Uint8Array(99) });

    const r = await moveHomeMediaToR2(db, deps, admin.id);
    expect(r).toEqual({ moved: ["editorial"], skipped: [] });
    expect(puts.map((p) => p.key)).toEqual(["site-media/home/editorial/m1.jpg"]);

    const media = (await getHomeContent(db)).media;
    expect(media.editorial).toMatchObject({
      kind: "image",
      bucket: "r2",
      path: "site-media/home/editorial/m1.jpg",
      alt: "Banner",
    });
    expect(media.editorialMobile).toEqual({ kind: "auto" });

    // Already moved → nothing to do.
    expect(await moveHomeMediaToR2(db, deps, admin.id)).toEqual({
      moved: [],
      skipped: [],
    });
  });
});

describe("uploads when R2 is on", () => {
  const storage = (): StoragePort & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      async createSignedUploadUrl(bucket, path) {
        asked.push(`${bucket}:${path}`);
        return { signedUrl: `https://r2/${path}`, token: "", path };
      },
      async statObject(bucket) {
        asked.push(`stat:${bucket}`);
        return { exists: true, size: 200_000, contentType: "image/webp" };
      },
      async createSignedDownloadUrl() {
        return "";
      },
      async deleteObjects() {},
    };
  };

  it("a new product photo goes to R2 with no Supabase URL cached", async () => {
    const p = await makeProduct();
    const s = storage();
    const deps = {
      db,
      storage: s,
      admin,
      supabaseUrl: "https://proj.supabase.co",
      onR2: true,
    };
    const ticket = await requestProductImageUpload(deps, {
      productId: p.id,
      contentType: "image/webp",
    });
    expect(ticket.bucket).toBe("r2");
    expect(ticket.path).toBe(`product-images/thrift/${p.id}/${ticket.imageId}.webp`);

    const row = await confirmProductImageUpload(deps, {
      productId: p.id,
      imageId: ticket.imageId,
      path: ticket.path,
      contentType: "image/webp",
      altText: "Saree",
    });
    expect(row).toMatchObject({ bucket: "r2", path: ticket.path, publicUrl: null });
    expect(s.asked).toEqual([`r2:${ticket.path}`, "stat:r2"]);
  });
});
