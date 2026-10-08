import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { productImageUrl, R2_BUCKET, storagePublicUrl } from "@/lib/storage-url";
import { auditLog } from "@/server/admin/audit";
import { updateSetting } from "@/server/admin/settings";
import { getHomeContent, type HomeMedia } from "@/server/settings";

import { objectOf } from "./compress-photos";

/**
 * Move public photos from Supabase Storage to Cloudflare R2 (D-159), so the
 * Supabase Free-plan 1 GB is no longer spent on photos. Each file is copied to
 * R2 under `<old bucket>/<old path>`, then its row is pointed at R2. The
 * Supabase copy is NOT deleted here; that is a separate, owner-approved step
 * that reads the audit trail (`product_image.moved_to_r2`,
 * `home_media.moved_to_r2`) for the old locations.
 */
export interface MoveDeps {
  fetchBytes(url: string): Promise<Uint8Array | null>;
  /** Write one object to the R2 photo bucket. */
  putR2(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

export type MoveOutcome =
  | { outcome: "moved"; bytes: number; key: string }
  | { outcome: "skipped"; reason: string };

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function contentTypeFor(path: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? "";
  return TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

export async function moveProductPhotoToR2(
  db: PrismaClient,
  deps: MoveDeps,
  input: { imageId: string; adminUserId: string },
): Promise<MoveOutcome> {
  const row = await db.productImage.findUnique({ where: { id: input.imageId } });
  if (!row) return { outcome: "skipped", reason: "not found" };
  if (row.bucket === R2_BUCKET) return { outcome: "skipped", reason: "already on R2" };

  const url = productImageUrl(row);
  const from = objectOf(url, row);
  if (!url.includes("/storage/v1/object/public/")) {
    return { outcome: "skipped", reason: "not a Supabase Storage file" };
  }
  const bytes = await deps.fetchBytes(url);
  if (!bytes) return { outcome: "skipped", reason: "file not reachable" };

  const key = `${from.bucket}/${from.path}`;
  await deps.putR2(key, bytes, contentTypeFor(from.path));
  await db.productImage.update({
    where: { id: row.id },
    data: { bucket: R2_BUCKET, path: key, publicUrl: null },
  });
  await auditLog(db, {
    adminUserId: input.adminUserId,
    action: "product_image.moved_to_r2",
    entityType: "ProductImage",
    entityId: row.id,
    before: {
      bucket: from.bucket,
      path: from.path,
      publicUrl: row.publicUrl,
      bytes: bytes.byteLength,
    },
    after: { bucket: R2_BUCKET, path: key },
  });
  return { outcome: "moved", bytes: bytes.byteLength, key };
}

/** Ids of product photos still on Supabase, oldest first. */
export async function listPhotosNotOnR2(db: PrismaClient): Promise<string[]> {
  const rows = await db.productImage.findMany({
    where: { NOT: { bucket: R2_BUCKET } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.id);
}

/** Copy every uploaded home-page image/video to R2 and save the slots in one go. */
export async function moveHomeMediaToR2(
  db: PrismaClient,
  deps: MoveDeps,
  adminUserId: string,
): Promise<{ moved: string[]; skipped: string[] }> {
  const content = await getHomeContent(db);
  const media: HomeMedia = { ...content.media };
  const moved: string[] = [];
  const skipped: string[] = [];
  for (const slot of Object.keys(media) as (keyof HomeMedia)[]) {
    const m = media[slot];
    if (m.kind === "auto" || !m.bucket || !m.path || m.bucket === R2_BUCKET) continue;
    const bytes = await deps.fetchBytes(storagePublicUrl(m.bucket, m.path, m.url));
    if (!bytes) {
      skipped.push(slot);
      continue;
    }
    const key = `${m.bucket}/${m.path}`;
    await deps.putR2(key, bytes, contentTypeFor(m.path));
    media[slot] = {
      ...m,
      bucket: R2_BUCKET,
      path: key,
      url: storagePublicUrl(R2_BUCKET, key),
    };
    await auditLog(db, {
      adminUserId,
      action: "home_media.moved_to_r2",
      entityType: "HomeMedia",
      entityId: slot,
      before: { bucket: m.bucket, path: m.path, bytes: bytes.byteLength },
      after: { bucket: R2_BUCKET, path: key },
    });
    moved.push(slot);
  }
  if (moved.length > 0) {
    await updateSetting(db, {
      key: "home.content",
      value: { ...content, media },
      adminUserId,
      reason: `moved home media to R2 (${moved.join(", ")})`,
    });
  }
  return { moved, skipped };
}

/** Progress for the admin page. */
export async function r2MoveStatus(db: PrismaClient) {
  const [total, onR2] = await Promise.all([
    db.productImage.count(),
    db.productImage.count({ where: { bucket: R2_BUCKET } }),
  ]);
  return { total, onR2 };
}

/** Live deps: public URL fetch + R2 upload. */
export async function liveMoveDeps(): Promise<MoveDeps> {
  const { createR2Client } = await import("@/lib/r2");
  const r2 = createR2Client();
  return {
    async fetchBytes(url) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    },
    putR2: (key, bytes, contentType) => r2.put(key, bytes, contentType),
  };
}
