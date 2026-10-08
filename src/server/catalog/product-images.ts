import "server-only";

import { randomUUID } from "node:crypto";

import type {
  AdminUser,
  CatalogType,
  ImageType,
  PrismaClient,
  ProductImage,
} from "@/generated/prisma";
import type { StoragePort } from "@/lib/storage";
import { photoLocation } from "@/lib/storage-url";
import { assertActiveAdmin } from "@/server/admin/guards";
import { ResourceNotFoundError } from "@/server/auth/errors";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRIVATE_DOC_BUCKET = "documents";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_IMAGE_DIM = 400;
export const MAX_IMAGE_DIM = 6000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const CATALOG_PREFIX: Record<CatalogType, string> = {
  THE_POOJA_EDIT: "the-pooja-edit",
  THRIFT: "thrift",
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * The storage path is ALWAYS derived server-side from (catalog, productId,
 * imageId) — never taken from the client — so a caller cannot write to or
 * register an arbitrary path (master spec §9).
 */
export function buildProductImagePath(
  catalog: CatalogType,
  productId: string,
  imageId: string,
  contentType: string,
): string {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new ImageValidationError(`Unsupported image type: ${contentType}`);
  return `${CATALOG_PREFIX[catalog]}/${productId}/${imageId}.${ext}`;
}

export function assertValidImageUpload(input: {
  contentType: string;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
}): void {
  if (!(input.contentType in EXT_BY_TYPE)) {
    throw new ImageValidationError(`Unsupported image type: ${input.contentType}`);
  }
  if (input.bytes != null && (input.bytes <= 0 || input.bytes > MAX_IMAGE_BYTES)) {
    throw new ImageValidationError("Image exceeds the size limit");
  }
  for (const dim of [input.width, input.height]) {
    if (dim != null && (dim < MIN_IMAGE_DIM || dim > MAX_IMAGE_DIM)) {
      throw new ImageValidationError("Image dimensions out of range");
    }
  }
}

interface Deps {
  db: PrismaClient;
  storage: StoragePort;
  admin: AdminUser | null;
  /** Site's own Supabase project URL, for computing a real public image URL
   * at write time (see `productImagePublicUrl`) — optional only so existing
   * callers/tests that never read `publicUrl` don't have to supply it. */
  supabaseUrl?: string;
  /** New uploads go to Cloudflare R2 (D-159) when it is configured. */
  onR2?: boolean;
}

/** Public URL for an object in this bucket, matching Supabase Storage's own
 * public-object URL shape (same pattern as `homeMediaPublicUrl`). Computed
 * once at write time and cached on the row — no network round trip needed to
 * render an image. */
export function productImagePublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`;
}

export interface UploadTicket {
  imageId: string;
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
}

/** Admin asks for a signed URL to upload one product image. */
export async function requestProductImageUpload(
  deps: Deps,
  input: { productId: string; contentType: string },
): Promise<UploadTicket> {
  assertActiveAdmin(deps.admin);
  assertValidImageUpload({ contentType: input.contentType });

  const product = await deps.db.product.findUnique({
    where: { id: input.productId },
    select: { catalog: true },
  });
  if (!product) throw new ResourceNotFoundError();

  const imageId = randomUUID();
  const { bucket, path } = photoLocation(
    PRODUCT_IMAGE_BUCKET,
    buildProductImagePath(product.catalog, input.productId, imageId, input.contentType),
    deps.onR2,
  );
  const signed = await deps.storage.createSignedUploadUrl(bucket, path);

  return {
    imageId,
    bucket,
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
  };
}

/** Admin confirms the browser finished uploading; only then is a row created. */
export async function confirmProductImageUpload(
  deps: Deps,
  input: {
    productId: string;
    imageId: string;
    path: string;
    contentType: string;
    altText: string;
    type?: ImageType;
    isPrimary?: boolean;
    width?: number | null;
    height?: number | null;
  },
): Promise<ProductImage> {
  assertActiveAdmin(deps.admin);

  const product = await deps.db.product.findUnique({
    where: { id: input.productId },
    select: { catalog: true },
  });
  if (!product) throw new ResourceNotFoundError();

  const expected = photoLocation(
    PRODUCT_IMAGE_BUCKET,
    buildProductImagePath(
      product.catalog,
      input.productId,
      input.imageId,
      input.contentType,
    ),
    deps.onR2,
  );
  if (input.path !== expected.path) {
    throw new ImageValidationError("Upload path does not match the issued path");
  }

  const info = await deps.storage.statObject(expected.bucket, input.path);
  if (!info.exists) {
    throw new ImageValidationError("Uploaded object was not found in storage");
  }
  assertValidImageUpload({
    contentType: input.contentType,
    bytes: info.size,
    width: input.width,
    height: input.height,
  });

  const isPrimary = input.isPrimary ?? false;
  const [{ _max }, [existing]] = await Promise.all([
    deps.db.productImage.aggregate({
      where: { productId: input.productId },
      _max: { sortPosition: true },
    }),
    deps.db.productImage.findMany({ where: { productId: input.productId }, take: 1 }),
  ]);
  // First image for a product is the primary by default, regardless of what
  // the caller asked for — a product should never end up with zero primary
  // images just because nobody checked the box.
  const makePrimary = isPrimary || !existing;

  const createData = {
    productId: input.productId,
    bucket: expected.bucket,
    path: input.path,
    // Was previously left unset (bug — a real admin upload fell back to
    // `toPublicImage`'s relative `/bucket/path` string, which no route
    // resolves in production, so the image just never rendered). Computed
    // here, at write time, exactly like every other real upload.
    publicUrl:
      deps.supabaseUrl && !deps.onR2
        ? productImagePublicUrl(deps.supabaseUrl, input.path)
        : null,
    altText: input.altText,
    type: makePrimary ? ("PRIMARY" as const) : (input.type ?? "GALLERY"),
    isPrimary: makePrimary,
    sortPosition: (_max.sortPosition ?? -1) + 1,
    widthPx: input.width ?? null,
    heightPx: input.height ?? null,
  };

  if (!makePrimary) {
    return deps.db.productImage.create({ data: createData });
  }
  const [, created] = await deps.db.$transaction([
    deps.db.productImage.updateMany({
      where: { productId: input.productId },
      data: { isPrimary: false },
    }),
    deps.db.productImage.create({ data: createData }),
  ]);
  return created;
}

/**
 * A product's images in display order, renumbered 0..n-1. Older rows can share
 * a `sortPosition` (setting a primary used to force it to 0 without moving the
 * rest), and swapping two equal numbers is a no-op — so every reorder starts
 * from this clean sequence instead of trusting the stored values.
 */
async function orderedImages(db: PrismaClient, productId: string) {
  return db.productImage.findMany({
    where: { productId },
    orderBy: [{ sortPosition: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

async function writeOrder(
  db: PrismaClient,
  images: ProductImage[],
  primaryId: string | null,
): Promise<void> {
  await db.$transaction(
    images.map((im, i) => {
      const isPrimary = primaryId ? im.id === primaryId : im.isPrimary;
      return db.productImage.update({
        where: { id: im.id },
        data: {
          sortPosition: i,
          isPrimary,
          // A demoted primary goes back to an ordinary gallery shot; FLAW and
          // DETAIL photos keep their type.
          type: isPrimary ? "PRIMARY" : im.type === "PRIMARY" ? "GALLERY" : im.type,
        },
      });
    }),
  );
}

/** Make one image the primary and move it to the front; the rest keep their order. */
export async function setPrimaryProductImage(
  db: PrismaClient,
  productId: string,
  imageId: string,
): Promise<void> {
  const images = await orderedImages(db, productId);
  const target = images.find((im) => im.id === imageId);
  if (!target) throw new ResourceNotFoundError("Image not found.");
  await writeOrder(db, [target, ...images.filter((im) => im.id !== imageId)], imageId);
}

/** Move an image one place up or down in the gallery. No-op at either end. */
export async function moveProductImage(
  db: PrismaClient,
  productId: string,
  imageId: string,
  direction: "up" | "down",
): Promise<void> {
  const images = await orderedImages(db, productId);
  const idx = images.findIndex((im) => im.id === imageId);
  if (idx === -1) throw new ResourceNotFoundError("Image not found.");
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= images.length) return;
  const next = [...images];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  await writeOrder(db, next, null);
}
