import "server-only";

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
  };
}
