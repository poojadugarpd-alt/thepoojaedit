import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  compressProductPhoto,
  listUncompressedPhotoIds,
  photoCompressionStatus,
  type PhotoDeps,
} from "../../src/server/catalog/compress-photos";
import { makeClient, resetDb } from "./helpers";

/** Heavy Shopify-era photos are shrunk to 1600px under a new path (D-158). */

let db: PrismaClient;
let adminUserId: string;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  const a = await db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
  adminUserId = a.id;
});

// A noisy photo-like JPEG: compresses poorly at q95, like a camera original.
async function bigJpeg(width = 3000, height = 2000, orientation?: number) {
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251;
  let img = sharp(noise, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 });
  if (orientation) img = img.withMetadata({ orientation });
  return new Uint8Array(await img.toBuffer());
}

function fakeDeps(files: Record<string, Uint8Array>) {
  const puts: { bucket: string; path: string; bytes: Uint8Array }[] = [];
  const deps: PhotoDeps = {
    async fetchBytes(url) {
      const key = Object.keys(files).find((k) => url.endsWith(k));
      return key ? files[key] : null;
    },
    async put(bucket, path, bytes) {
      puts.push({ bucket, path, bytes });
    },
  };
  return { deps, puts };
}

async function makeImage(data: {
  bucket: string;
  path: string;
  publicUrl?: string | null;
}) {
  const p = await db.product.create({
    data: {
      catalog: "THE_POOJA_EDIT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: "Kurti",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  return db.productImage.create({
    data: { productId: p.id, altText: "Kurti", ...data },
  });
}

describe("compressProductPhoto", () => {
  it("shrinks an imported (legacy-import) photo to 1600px under a new path and audits it", async () => {
    const orig = "images/thepoojaedit/kurti-12/00-c2b054a070a4.jpg";
    const img = await makeImage({
      bucket: "legacy-import",
      path: "kurti-12/0",
      publicUrl: `https://old.supabase.co/storage/v1/object/public/product-images/${orig}`,
    });
    const big = await bigJpeg();
    const { deps, puts } = fakeDeps({ [orig]: big });

    const r = await compressProductPhoto(db, deps, { imageId: img.id, adminUserId });
    expect(r.outcome).toBe("compressed");
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      bucket: "product-images",
      path: "images/thepoojaedit/kurti-12/00-c2b054a070a4-1600.jpg",
    });
    const meta = await sharp(Buffer.from(puts[0].bytes)).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(puts[0].bytes.byteLength).toBeLessThan(big.byteLength * 0.8);

    const row = await db.productImage.findUniqueOrThrow({ where: { id: img.id } });
    expect(row).toMatchObject({
      bucket: "product-images",
      path: "images/thepoojaedit/kurti-12/00-c2b054a070a4-1600.jpg",
      publicUrl: null,
      widthPx: 1600,
      heightPx: 1067,
    });
    const audit = await db.adminActivityLog.findFirstOrThrow({
      where: { action: "product_image.compressed", entityId: img.id },
    });
    expect(audit.before).toMatchObject({ bucket: "product-images", path: orig });

    // Already done → skipped, nothing uploaded again.
    const again = await compressProductPhoto(db, deps, {
      imageId: img.id,
      adminUserId,
    });
    expect(again).toMatchObject({ outcome: "skipped", reason: "already compressed" });
    expect(puts).toHaveLength(1);
    expect(await listUncompressedPhotoIds(db)).toEqual([]);

    const status = await photoCompressionStatus(db);
    expect(status).toMatchObject({ total: 1, compressed: 1 });
    expect(status.savedBytes).toBeGreaterThan(0);
  });

  it("leaves small photos and missing files alone", async () => {
    const small = new Uint8Array(
      await sharp({
        create: { width: 800, height: 1000, channels: 3, background: "#ccc" },
      })
        .jpeg()
        .toBuffer(),
    );
    const a = await makeImage({ bucket: "product-images", path: "thrift/x/a.jpg" });
    const b = await makeImage({ bucket: "product-images", path: "thrift/x/gone.jpg" });
    const { deps, puts } = fakeDeps({ "thrift/x/a.jpg": small });

    expect(
      await compressProductPhoto(db, deps, { imageId: a.id, adminUserId }),
    ).toMatchObject({
      outcome: "skipped",
      reason: "already small",
    });
    expect(
      await compressProductPhoto(db, deps, { imageId: b.id, adminUserId }),
    ).toMatchObject({
      outcome: "skipped",
      reason: "file not reachable",
    });
    expect(puts).toHaveLength(0);
    const row = await db.productImage.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.path).toBe("thrift/x/a.jpg");
  });

  it("applies the photo's EXIF rotation so portrait shots stay portrait", async () => {
    // Stored 3000x2000 but tagged "rotate 90°" (orientation 6), as phones do.
    const img = await makeImage({
      bucket: "product-images",
      path: "the-pooja-edit/p/r.jpg",
    });
    const { deps, puts } = fakeDeps({
      "the-pooja-edit/p/r.jpg": await bigJpeg(3000, 2000, 6),
    });
    await compressProductPhoto(db, deps, { imageId: img.id, adminUserId });
    const meta = await sharp(Buffer.from(puts[0].bytes)).metadata();
    expect(meta.height).toBe(1600);
    expect(meta.width).toBe(1067);
  });
});
