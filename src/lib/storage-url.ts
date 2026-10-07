import { publicEnv } from "./public-env";

/**
 * Public URL of a Supabase Storage object, resolved at READ time from
 * (bucket, path) — never from a URL cached on a row (D-135).
 *
 * D-132: `ProductImage.publicUrl` was computed at write time with the
 * project's host baked in, so after the D-115 project move production kept
 * loading 458 images from the old project and they all broke when it was
 * emptied. Resolving here means a project move only needs the env var.
 *
 * Base: `NEXT_PUBLIC_STORAGE_PUBLIC_URL` (lets Preview/Development read the
 * production buckets), else `NEXT_PUBLIC_SUPABASE_URL`. With neither set (unit
 * tests, bare local dev) the caller's cached URL is used, else a relative path.
 */
export function storagePublicUrl(
  bucket: string,
  path: string,
  cachedUrl?: string | null,
): string {
  const base =
    publicEnv.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (base) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${encoded}`;
  }
  return cachedUrl ?? `/${bucket}/${path}`;
}

/** Convenience for a ProductImage-shaped row. */
export function productImageUrl(im: {
  bucket: string;
  path: string;
  publicUrl?: string | null;
}): string {
  return storagePublicUrl(im.bucket, im.path, im.publicUrl);
}
