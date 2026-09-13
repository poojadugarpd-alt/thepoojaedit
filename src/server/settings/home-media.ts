import "server-only";

import { randomUUID } from "node:crypto";

import type { AdminUser } from "@/generated/prisma";
import type { StoragePort } from "@/lib/storage";
import { assertActiveAdmin } from "@/server/admin/guards";

/**
 * A custom hero/editorial image or video for the home page (owner follow-up,
 * 2026-09-13 — "no option to edit the actual pictures/video ... of the home
 * page"). Same signed-upload-then-confirm shape as product images
 * (src/server/catalog/product-images.ts), a separate public bucket since this
 * is site content, not a product asset.
 */
export const HOME_MEDIA_BUCKET = "site-media";

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// Deliberately small. A hero video autoplays on every home page visit —
// Supabase's free-tier Storage egress is limited (a few GB/month), so a
// large or long clip here is a real, recurring cost, not just a slow load.
// 15MB is generous for a well-compressed 5-10s clip at hero-image size.
const VIDEO_EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

export class HomeMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HomeMediaValidationError";
  }
}

function extFor(kind: "image" | "video", contentType: string): string {
  const table = kind === "image" ? IMAGE_EXT_BY_TYPE : VIDEO_EXT_BY_TYPE;
  const ext = table[contentType];
  if (!ext) {
    throw new HomeMediaValidationError(
      kind === "image"
        ? `Unsupported image type: ${contentType}`
        : `Unsupported video type: ${contentType} (use MP4 or WebM)`,
    );
  }
  return ext;
}

/** The path is always derived server-side from (slot, mediaId) — never taken
 * from the client — matching `buildProductImagePath`'s reasoning exactly. */
export function buildHomeMediaPath(
  slot: string,
  mediaId: string,
  kind: "image" | "video",
  contentType: string,
): string {
  return `home/${slot}/${mediaId}.${extFor(kind, contentType)}`;
}

export interface HomeMediaUploadTicket {
  mediaId: string;
  path: string;
  signedUrl: string;
  token: string;
}

/** Admin asks for a signed URL to upload one home-page image or video. */
export async function requestHomeMediaUpload(
  storage: StoragePort,
  admin: AdminUser | null,
  input: { slot: string; kind: "image" | "video"; contentType: string },
): Promise<HomeMediaUploadTicket> {
  assertActiveAdmin(admin);
  const mediaId = randomUUID();
  const path = buildHomeMediaPath(input.slot, mediaId, input.kind, input.contentType);
  const signed = await storage.createSignedUploadUrl(HOME_MEDIA_BUCKET, path);
  return { mediaId, path, signedUrl: signed.signedUrl, token: signed.token };
}

/** Admin confirms the browser finished uploading; only then does the caller
 * persist anything referencing this path. */
export async function confirmHomeMediaUpload(
  storage: StoragePort,
  admin: AdminUser | null,
  input: { path: string; kind: "image" | "video" },
): Promise<void> {
  assertActiveAdmin(admin);
  const info = await storage.statObject(HOME_MEDIA_BUCKET, input.path);
  if (!info.exists) {
    throw new HomeMediaValidationError("Uploaded file was not found in storage");
  }
  const maxBytes = input.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (info.size != null && info.size > maxBytes) {
    throw new HomeMediaValidationError(
      input.kind === "video"
        ? "Video is larger than 15MB — trim or compress it first."
        : "Image is larger than 8MB.",
    );
  }
}

/** Public URL for an object in this bucket, matching Supabase Storage's own
 * public-object URL shape — this bucket has no admin-facing DB row of its
 * own to cache a `publicUrl` on (unlike ProductImage), so it's computed here
 * from the site's own Supabase project URL rather than a network round trip;
 * Supabase's public URL is deterministic from (project, bucket, path). */
export function homeMediaPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${HOME_MEDIA_BUCKET}/${path}`;
}
