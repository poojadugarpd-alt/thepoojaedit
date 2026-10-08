import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { R2_BUCKET } from "@/lib/storage-url";
import { auditLog } from "@/server/admin/audit";
import { getHomeContent } from "@/server/settings";

/**
 * Remove the Supabase copies of public photos once everything is on R2
 * (D-161, follows D-159). Two steps, both admin-started:
 *
 * 1. `writeSupabasePhotoManifest` lists every object in the public photo
 *    buckets and saves that list to R2 as JSON, so the files can be backed up
 *    to the Mac before anything is deleted.
 * 2. `deleteSupabasePhotosFromManifest` deletes exactly the objects in that
 *    list, and refuses to start while any photo row or home-page slot still
 *    points at Supabase.
 *
 * Private `documents` (invoices, labels) are never touched.
 */
export const PUBLIC_PHOTO_BUCKETS = ["product-images", "site-media"] as const;

export interface SupabaseObject {
  bucket: string;
  name: string;
  size: number;
}

export interface Manifest {
  createdAt: string;
  storageBaseUrl: string;
  objects: SupabaseObject[];
  totalBytes: number;
}

export interface CleanupDeps {
  /** Every object in the public photo buckets (from `storage.objects`). */
  listObjects(): Promise<SupabaseObject[]>;
  putR2(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  readManifest(key: string): Promise<Manifest | null>;
  /** Delete objects from one Supabase bucket (Storage API, service key). */
  removeObjects(bucket: string, names: string[]): Promise<void>;
  storageBaseUrl: string;
}

export const MANIFEST_ACTION = "storage.supabase_photo_manifest";
export const DELETED_ACTION = "storage.supabase_photos_deleted";
const DELETE_BATCH = 100;

/** Anything that still reads a public photo from Supabase. Empty = safe to delete. */
export async function supabasePhotoBlockers(db: PrismaClient): Promise<string[]> {
  const blockers: string[] = [];
  const rows = await db.productImage.count({ where: { NOT: { bucket: R2_BUCKET } } });
  if (rows > 0) blockers.push(`${rows} product photo(s) not on R2`);
  const media = (await getHomeContent(db)).media;
  for (const [slot, m] of Object.entries(media)) {
    if (m.kind !== "auto" && m.bucket && m.bucket !== R2_BUCKET) {
      blockers.push(`home media "${slot}" not on R2`);
    }
  }
  return blockers;
}

export async function writeSupabasePhotoManifest(
  db: PrismaClient,
  deps: CleanupDeps,
  input: { adminUserId: string; now?: Date },
): Promise<{ key: string; count: number; totalBytes: number }> {
  const objects = (await deps.listObjects())
    .filter((o) => (PUBLIC_PHOTO_BUCKETS as readonly string[]).includes(o.bucket))
    .sort((a, b) => (a.bucket + a.name).localeCompare(b.bucket + b.name));
  const createdAt = (input.now ?? new Date()).toISOString();
  const manifest: Manifest = {
    createdAt,
    storageBaseUrl: deps.storageBaseUrl,
    objects,
    totalBytes: objects.reduce((s, o) => s + o.size, 0),
  };
  const key = `backups/supabase-photos-${createdAt.replace(/[:.]/g, "-")}.json`;
  await deps.putR2(
    key,
    new TextEncoder().encode(JSON.stringify(manifest)),
    "application/json",
  );
  await auditLog(db, {
    adminUserId: input.adminUserId,
    action: MANIFEST_ACTION,
    entityType: "Storage",
    entityId: key,
    after: { key, count: objects.length, totalBytes: manifest.totalBytes },
  });
  return { key, count: objects.length, totalBytes: manifest.totalBytes };
}

export type DeleteOutcome =
  | { outcome: "deleted"; count: number; totalBytes: number }
  | { outcome: "refused"; reason: string };

export async function deleteSupabasePhotosFromManifest(
  db: PrismaClient,
  deps: CleanupDeps,
  input: { manifestKey: string; adminUserId: string },
): Promise<DeleteOutcome> {
  const blockers = await supabasePhotoBlockers(db);
  if (blockers.length > 0) return { outcome: "refused", reason: blockers.join("; ") };
  const manifest = await deps.readManifest(input.manifestKey);
  if (!manifest) return { outcome: "refused", reason: "backup list not found" };

  const objects = manifest.objects.filter((o) =>
    (PUBLIC_PHOTO_BUCKETS as readonly string[]).includes(o.bucket),
  );
  for (const bucket of PUBLIC_PHOTO_BUCKETS) {
    const names = objects.filter((o) => o.bucket === bucket).map((o) => o.name);
    for (let i = 0; i < names.length; i += DELETE_BATCH) {
      await deps.removeObjects(bucket, names.slice(i, i + DELETE_BATCH));
    }
  }
  const totalBytes = objects.reduce((s, o) => s + o.size, 0);
  await auditLog(db, {
    adminUserId: input.adminUserId,
    action: DELETED_ACTION,
    entityType: "Storage",
    entityId: input.manifestKey,
    after: { count: objects.length, totalBytes },
  });
  return { outcome: "deleted", count: objects.length, totalBytes };
}

/** Latest backup list and whether it has been deleted yet, for the admin page. */
export async function supabasePhotoCleanupStatus(db: PrismaClient) {
  const [manifest, deleted] = await Promise.all([
    db.adminActivityLog.findFirst({
      where: { action: MANIFEST_ACTION },
      orderBy: { createdAt: "desc" },
    }),
    db.adminActivityLog.findFirst({
      where: { action: DELETED_ACTION },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const m = manifest?.after as
    { key: string; count: number; totalBytes: number } | undefined;
  return {
    manifest: m ?? null,
    deletedKey: deleted?.entityId ?? null,
  };
}

/** Live deps: SQL listing, R2 upload/read, Storage API delete (service key). */
export async function liveCleanupDeps(db: PrismaClient): Promise<CleanupDeps> {
  const { createClient } = await import("@supabase/supabase-js");
  const { publicEnv } = await import("@/lib/public-env");
  const { env } = await import("@/lib/env");
  const { createR2Client } = await import("@/lib/r2");
  const { storagePublicUrl } = await import("@/lib/storage-url");
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Cleanup needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  const supabase = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  );
  const r2 = createR2Client();
  return {
    storageBaseUrl: `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`,
    async listObjects() {
      const rows = await db.$queryRaw<{ bucket: string; name: string; size: bigint }[]>`
        SELECT bucket_id AS bucket, name,
               COALESCE((metadata->>'size')::bigint, 0) AS size
        FROM storage.objects
        WHERE bucket_id IN ('product-images', 'site-media')`;
      return rows.map((r) => ({
        bucket: r.bucket,
        name: r.name,
        size: Number(r.size),
      }));
    },
    putR2: (key, bytes, contentType) => r2.put(key, bytes, contentType),
    async readManifest(key) {
      const res = await fetch(storagePublicUrl(R2_BUCKET, key), { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Manifest;
    },
    async removeObjects(bucket, names) {
      const { error } = await supabase.storage.from(bucket).remove(names);
      if (error) throw error;
    },
  };
}
