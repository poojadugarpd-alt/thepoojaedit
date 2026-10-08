import "server-only";

import { createR2Client, r2Configured } from "@/lib/r2";
import { R2_BUCKET } from "@/lib/storage-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Storage boundary. Application code depends on this port, not on the Supabase
 * SDK, so upload/validation logic is testable with a fake and the live
 * implementation is swapped in behind it.
 *
 * Buckets (master spec §9):
 *  - `product-images` — public read, admin-only write.
 *  - `documents` — private; invoices / labels with personal data. Authorized
 *    short-lived downloads only.
 *  - `r2` (D-159) — Cloudflare R2; public photos once moved/uploaded there.
 */
export interface StoredObjectInfo {
  exists: boolean;
  size: number | null;
  contentType: string | null;
}

export interface StoragePort {
  /** Short-lived signed URL the browser PUTs the file to, for a server-chosen path. */
  createSignedUploadUrl(
    bucket: string,
    path: string,
  ): Promise<{ signedUrl: string; token: string; path: string }>;

  /** Confirm the object exists and read its metadata before persisting a row. */
  statObject(bucket: string, path: string): Promise<StoredObjectInfo>;

  /** Authorized, expiring download URL for a private object. */
  createSignedDownloadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<string>;

  /** Permanently remove one or more objects (product delete, master §9). */
  deleteObjects(bucket: string, paths: string[]): Promise<void>;
}

/** Live implementation over Supabase Storage. Exercised end-to-end from Phase 4. */
export async function createSupabaseStoragePort(): Promise<StoragePort> {
  const supabase = await createSupabaseServerClient();

  return {
    async createSignedUploadUrl(bucket, path) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error("createSignedUploadUrl failed");
      return { signedUrl: data.signedUrl, token: data.token, path: data.path };
    },

    async statObject(bucket, path) {
      const lastSlash = path.lastIndexOf("/");
      const dir = lastSlash === -1 ? "" : path.slice(0, lastSlash);
      const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(dir, { search: name, limit: 1 });
      if (error) throw error;
      const match = data?.find((entry) => entry.name === name);
      return {
        exists: Boolean(match),
        size: typeof match?.metadata?.size === "number" ? match.metadata.size : null,
        contentType:
          typeof match?.metadata?.mimetype === "string"
            ? match.metadata.mimetype
            : null,
      };
    },

    async createSignedDownloadUrl(bucket, path, expiresInSeconds) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw error ?? new Error("createSignedUrl failed");
      return data.signedUrl;
    },

    async deleteObjects(bucket, paths) {
      if (paths.length === 0) return;
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
    },
  };
}

/** True when new public photos should be uploaded to R2 instead of Supabase. */
export function photosOnR2(): boolean {
  return r2Configured();
}

/**
 * The port every caller should use (D-159): objects whose bucket is `r2` go
 * to Cloudflare R2, everything else (private documents, photos not yet moved)
 * to Supabase Storage.
 */
export async function createStoragePort(): Promise<StoragePort> {
  const supabase = await createSupabaseStoragePort();
  if (!r2Configured()) return supabase;
  const r2 = createR2Client();
  return {
    async createSignedUploadUrl(bucket, path) {
      if (bucket !== R2_BUCKET) return supabase.createSignedUploadUrl(bucket, path);
      return { signedUrl: await r2.presignPut(path), token: "", path };
    },
    async statObject(bucket, path) {
      if (bucket !== R2_BUCKET) return supabase.statObject(bucket, path);
      const info = await r2.head(path);
      return {
        exists: Boolean(info),
        size: info?.size ?? null,
        contentType: info?.contentType ?? null,
      };
    },
    async createSignedDownloadUrl(bucket, path, expiresInSeconds) {
      if (bucket === R2_BUCKET) throw new Error("R2 holds public photos only.");
      return supabase.createSignedDownloadUrl(bucket, path, expiresInSeconds);
    },
    async deleteObjects(bucket, paths) {
      if (bucket !== R2_BUCKET) return supabase.deleteObjects(bucket, paths);
      for (const p of paths) await r2.delete(p);
    },
  };
}
