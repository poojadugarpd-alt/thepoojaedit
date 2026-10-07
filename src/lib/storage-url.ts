import { publicEnv } from "./public-env";

/**
 * Public URL of a Supabase Storage object, with the project host resolved at
 * READ time (D-135).
 *
 * D-132: `ProductImage.publicUrl` was computed at write time with the
 * project's host baked in, so after the D-115 project move production kept
 * loading 458 images from the old project and they all broke when it was
 * emptied. Swapping the host here means a project move only needs the env var.
 *
 * A cached Storage URL keeps its own object path, and only its host is
 * replaced. (bucket, path) can't always be trusted: rows from the Shopify
 * import (`migration/scripts/import-to-dev-db.mjs`) carry a placeholder
 * `bucket: "legacy-import"` that doesn't exist; only their `publicUrl` points
 * at the real object. Building from (bucket, path) broke every imported
 * product image on 2026-10-07. Rows with no cached URL are built from
 * (bucket, path), and a cached non-Storage URL is returned unchanged.
 *
 * Base: `NEXT_PUBLIC_STORAGE_PUBLIC_URL` (lets Preview/Development read the
 * production buckets), else `NEXT_PUBLIC_SUPABASE_URL`. With neither set (unit
 * tests, bare local dev) the caller's cached URL is used, else a relative path.
 */
const STORAGE_PATH = /^https?:\/\/[^/]+(\/storage\/v1\/object\/public\/.+)$/;

export function storagePublicUrl(
  bucket: string,
  path: string,
  cachedUrl?: string | null,
): string {
  const base =
    publicEnv.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return cachedUrl ?? `/${bucket}/${path}`;
  const host = base.replace(/\/+$/, "");
  if (cachedUrl) {
    const m = STORAGE_PATH.exec(cachedUrl);
    return m ? `${host}${m[1]}` : cachedUrl;
  }
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${host}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Convenience for a ProductImage-shaped row. */
export function productImageUrl(im: {
  bucket: string;
  path: string;
  publicUrl?: string | null;
}): string {
  return storagePublicUrl(im.bucket, im.path, im.publicUrl);
}
