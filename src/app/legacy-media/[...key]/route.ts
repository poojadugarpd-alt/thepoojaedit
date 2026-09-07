import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { isProduction } from "@/lib/app-env";

/**
 * DEV-ONLY: serves the migration image files downloaded to
 * `migration/legacy-content/images/` so the Phase 4 storefront preview has real
 * imagery without hot-linking the legacy CDNs (some of which 500 the Next image
 * optimizer) and without copying ~500 MB into `public/`.
 *
 * Never enabled in production — real images come from Supabase Storage.
 */
export const runtime = "nodejs";

const ROOT = path.resolve(process.cwd(), "migration/legacy-content");

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (isProduction) return new NextResponse("Not found", { status: 404 });

  const { key } = await params;
  // key = ["images", "<site>", "<productId>", "<file>"] — normalised & confined to ROOT
  const rel = path.normalize(key.join("/"));
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep) || !existsSync(abs) || !statSync(abs).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "content-type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "content-length": String(statSync(abs).size),
      "cache-control": "public, max-age=86400",
    },
  });
}
