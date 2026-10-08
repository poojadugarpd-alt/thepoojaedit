import "server-only";

import { AwsClient } from "aws4fetch";

import { env } from "./env";

/**
 * Cloudflare R2 over its S3-compatible API (D-159). Holds every public photo
 * (product photos + home-page media) in one bucket, served publicly from
 * `NEXT_PUBLIC_R2_PUBLIC_URL`. Private documents stay on Supabase Storage.
 */
export interface R2Client {
  /** Browser-uploadable PUT URL for one key, valid for `expiresInSeconds`. */
  presignPut(key: string, expiresInSeconds?: number): Promise<string>;
  head(key: string): Promise<{ size: number; contentType: string | null } | null>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** One year: every key is unique (uuid or `-1600` suffix), so it never changes. */
export const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function r2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET,
  );
}

export function createR2Client(): R2Client {
  if (!r2Configured()) {
    throw new Error(
      "R2 is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).",
    );
  }
  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;
  const urlFor = (key: string) =>
    `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    async presignPut(key, expiresInSeconds = 600) {
      const url = new URL(urlFor(key));
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await aws.sign(url.toString(), {
        method: "PUT",
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async head(key) {
      const res = await aws.fetch(urlFor(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD ${key} failed (${res.status})`);
      return {
        size: Number(res.headers.get("content-length") ?? 0),
        contentType: res.headers.get("content-type"),
      };
    },

    async put(key, bytes, contentType) {
      // Sign only, then send the bytes with a plain fetch: aws.fetch() re-wraps
      // the body in a Request stream, which Node sends chunked with no
      // Content-Length, and R2 rejects that with 411.
      const signed = await aws.sign(urlFor(key), {
        method: "PUT",
        headers: { "Content-Type": contentType, "Cache-Control": R2_CACHE_CONTROL },
      });
      const res = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: new Blob([new Uint8Array(bytes)]),
      });
      if (!res.ok) throw new Error(`R2 PUT ${key} failed (${res.status})`);
    },

    async delete(key) {
      const res = await aws.fetch(urlFor(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 DELETE ${key} failed (${res.status})`);
      }
    },
  };
}
