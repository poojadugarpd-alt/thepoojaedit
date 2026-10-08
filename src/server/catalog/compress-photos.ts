import "server-only";

import sharp from "sharp";

import type { PrismaClient } from "@/generated/prisma";
import { productImageUrl } from "@/lib/storage-url";
import { auditLog } from "@/server/admin/audit";

import { PRODUCT_IMAGE_BUCKET } from "./product-images";

/**
 * Shrink heavy product photos (D-158). The Shopify-era originals are 1–3 MB
 * and, since D-141 serves them unoptimised, every shopper downloads them in
 * full. Each photo over COMPRESS_MIN_BYTES is resized to a 1600px long edge
 * (JPEG q80, mozjpeg), saved under a NEW path (`…-1600.jpg`, so no cache keeps
 * serving the old file) and the row is pointed at it. The original object is
 * left in Storage; removing originals is a separate, owner-approved step that
 * reads the audit trail written here (`product_image.compressed`).
 */
export const COMPRESS_MAX_EDGE = 1600;
export const COMPRESS_MIN_BYTES = 400 * 1024;
export const COMPRESSED_SUFFIX = `-${COMPRESS_MAX_EDGE}.jpg`;

export interface PhotoDeps {
  /** Read a photo's current bytes from its public URL; null if missing. */
  fetchBytes(url: string): Promise<Uint8Array | null>;
  /** Write a new object to a public bucket. */
  put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
}

export type CompressOutcome =
  | { outcome: "compressed"; beforeBytes: number; afterBytes: number; path: string }
  | { outcome: "skipped"; reason: string };

const STORAGE_OBJECT = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/** The real (bucket, path) of a row's file — imported rows only have it in the URL. */
function objectOf(url: string, row: { bucket: string; path: string }) {
  const m = STORAGE_OBJECT.exec(url);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  return { bucket: row.bucket, path: row.path };
}

export async function compressProductPhoto(
  db: PrismaClient,
  deps: PhotoDeps,
  input: { imageId: string; adminUserId: string },
): Promise<CompressOutcome> {
  const row = await db.productImage.findUnique({ where: { id: input.imageId } });
  if (!row) return { outcome: "skipped", reason: "not found" };
  if (row.path.endsWith(COMPRESSED_SUFFIX)) {
    return { outcome: "skipped", reason: "already compressed" };
  }

  const url = productImageUrl(row);
  const original = await deps.fetchBytes(url);
  if (!original) return { outcome: "skipped", reason: "file not reachable" };
  if (original.byteLength < COMPRESS_MIN_BYTES) {
    return { outcome: "skipped", reason: "already small" };
  }

  const { data, info } = await sharp(original)
    .rotate() // honour EXIF orientation before it is stripped
    .resize({
      width: COMPRESS_MAX_EDGE,
      height: COMPRESS_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  if (data.byteLength > original.byteLength * 0.8) {
    return { outcome: "skipped", reason: "would not get meaningfully smaller" };
  }

  const from = objectOf(url, row);
  const bucket = from.bucket === "legacy-import" ? PRODUCT_IMAGE_BUCKET : from.bucket;
  const path = from.path.replace(/\.[A-Za-z0-9]+$/, "") + COMPRESSED_SUFFIX;
  await deps.put(bucket, path, new Uint8Array(data), "image/jpeg");

  await db.productImage.update({
    where: { id: row.id },
    data: {
      bucket,
      path,
      publicUrl: null,
      widthPx: info.width,
      heightPx: info.height,
    },
  });
  await auditLog(db, {
    adminUserId: input.adminUserId,
    action: "product_image.compressed",
    entityType: "ProductImage",
    entityId: row.id,
    before: {
      bucket: from.bucket,
      path: from.path,
      publicUrl: row.publicUrl,
      bytes: original.byteLength,
      widthPx: row.widthPx,
      heightPx: row.heightPx,
    },
    after: {
      bucket,
      path,
      bytes: data.byteLength,
      widthPx: info.width,
      heightPx: info.height,
    },
  });
  return {
    outcome: "compressed",
    beforeBytes: original.byteLength,
    afterBytes: data.byteLength,
    path,
  };
}

/** Ids of photos not yet compressed, oldest first (the job walks them in batches). */
export async function listUncompressedPhotoIds(db: PrismaClient): Promise<string[]> {
  const rows = await db.productImage.findMany({
    where: { NOT: { path: { endsWith: COMPRESSED_SUFFIX } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.id);
}

/** Progress for the admin page. */
export async function photoCompressionStatus(db: PrismaClient) {
  const [total, compressed] = await Promise.all([
    db.productImage.count(),
    db.productImage.count({ where: { path: { endsWith: COMPRESSED_SUFFIX } } }),
  ]);
  const saved = await db.adminActivityLog.findMany({
    where: { action: "product_image.compressed" },
    select: { before: true, after: true },
  });
  const savedBytes = saved.reduce(
    (s, r) =>
      s +
      ((r.before as { bytes?: number } | null)?.bytes ?? 0) -
      ((r.after as { bytes?: number } | null)?.bytes ?? 0),
    0,
  );
  return { total, compressed, savedBytes };
}

/** Live deps: public URL fetch + service-key upload (no user session in a job). */
export async function livePhotoDeps(): Promise<PhotoDeps> {
  const { createClient } = await import("@supabase/supabase-js");
  const { publicEnv } = await import("@/lib/public-env");
  const { env } = await import("@/lib/env");
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "Photo compression needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }
  const supabase = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false },
    },
  );
  return {
    async fetchBytes(url) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    },
    async put(bucket, path, bytes, contentType) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
      if (error) throw error;
    },
  };
}
