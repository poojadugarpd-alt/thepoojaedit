import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  deleteSupabasePhotosFromManifest,
  supabasePhotoBlockers,
  supabasePhotoCleanupStatus,
  writeSupabasePhotoManifest,
  type CleanupDeps,
  type Manifest,
} from "../../src/server/catalog/supabase-photo-cleanup";
import { makeClient, resetDb } from "./helpers";

/** Supabase copies of public photos are listed, backed up, then deleted (D-161). */

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

function fakeDeps() {
  const r2 = new Map<string, Uint8Array>();
  const removed: { bucket: string; names: string[] }[] = [];
  const deps: CleanupDeps = {
    storageBaseUrl: "https://proj.supabase.co/storage/v1/object/public",
    async listObjects() {
      return [
        { bucket: "site-media", name: "home/editorial/a.jpg", size: 10 },
        { bucket: "documents", name: "invoices/1.pdf", size: 99 },
        ...Array.from({ length: 150 }, (_, i) => ({
          bucket: "product-images",
          name: `thrift/p/${String(i).padStart(3, "0")}.jpg`,
          size: 2,
        })),
      ];
    },
    async putR2(key, bytes) {
      r2.set(key, bytes);
    },
    async readManifest(key) {
      const b = r2.get(key);
      return b ? (JSON.parse(new TextDecoder().decode(b)) as Manifest) : null;
    },
    async removeObjects(bucket, names) {
      removed.push({ bucket, names });
    },
  };
  return { deps, r2, removed };
}

async function photoOn(bucket: string) {
  const p = await db.product.create({
    data: {
      catalog: "THRIFT",
      slug: `p-${randomUUID().slice(0, 8)}`,
      title: "Top",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  return db.productImage.create({
    data: { productId: p.id, altText: "x", bucket, path: `k/${randomUUID()}.jpg` },
  });
}

describe("Supabase photo cleanup", () => {
  it("lists only public photo buckets, then deletes exactly that list in batches", async () => {
    await photoOn("r2");
    const { deps, r2, removed } = fakeDeps();

    const m = await writeSupabasePhotoManifest(db, deps, {
      adminUserId,
      now: new Date("2026-10-08T16:00:00.000Z"),
    });
    expect(m).toEqual({
      key: "backups/supabase-photos-2026-10-08T16-00-00-000Z.json",
      count: 151,
      totalBytes: 310,
    });
    const saved = await deps.readManifest(m.key);
    expect(saved?.objects.some((o) => o.bucket === "documents")).toBe(false);
    expect(saved?.storageBaseUrl).toBe(deps.storageBaseUrl);
    expect(r2.size).toBe(1);
    expect(await supabasePhotoCleanupStatus(db)).toEqual({
      manifest: m,
      deletedKey: null,
    });

    const r = await deleteSupabasePhotosFromManifest(db, deps, {
      manifestKey: m.key,
      adminUserId,
    });
    expect(r).toEqual({ outcome: "deleted", count: 151, totalBytes: 310 });
    expect(removed.map((x) => [x.bucket, x.names.length])).toEqual([
      ["product-images", 100],
      ["product-images", 50],
      ["site-media", 1],
    ]);
    expect(removed.flatMap((x) => x.names)).not.toContain("invoices/1.pdf");
    expect((await supabasePhotoCleanupStatus(db)).deletedKey).toBe(m.key);
  });

  it("refuses while any photo or home banner still reads from Supabase", async () => {
    await photoOn("product-images");
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: {
          media: {
            editorial: {
              kind: "image",
              bucket: "site-media",
              path: "home/editorial/a.jpg",
              alt: "x",
            },
          },
        },
      },
    });
    expect(await supabasePhotoBlockers(db)).toEqual([
      "1 product photo(s) not on R2",
      'home media "editorial" not on R2',
    ]);
    const { deps, removed } = fakeDeps();
    const m = await writeSupabasePhotoManifest(db, deps, { adminUserId });
    const r = await deleteSupabasePhotosFromManifest(db, deps, {
      manifestKey: m.key,
      adminUserId,
    });
    expect(r.outcome).toBe("refused");
    expect(removed).toEqual([]);
  });

  it("refuses an unknown list", async () => {
    const { deps, removed } = fakeDeps();
    expect(
      await deleteSupabasePhotosFromManifest(db, deps, {
        manifestKey: "backups/supabase-photos-nope.json",
        adminUserId,
      }),
    ).toEqual({ outcome: "refused", reason: "backup list not found" });
    expect(removed).toEqual([]);
  });
});
