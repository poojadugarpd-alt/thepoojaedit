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
  const path = buildProductImagePath(
    product.catalog,
    input.productId,
    imageId,
    input.contentType,
  );
  const signed = await deps.storage.createSignedUploadUrl(PRODUCT_IMAGE_BUCKET, path);

  return {
    imageId,
    bucket: PRODUCT_IMAGE_BUCKET,
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

  const expectedPath = buildProductImagePath(
    product.catalog,
    input.productId,
    input.imageId,
    input.contentType,
  );
  if (input.path !== expectedPath) {
    throw new ImageValidationError("Upload path does not match the issued path");
  }

  const info = await deps.storage.statObject(PRODUCT_IMAGE_BUCKET, input.path);
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
    bucket: PRODUCT_IMAGE_BUCKET,
    path: input.path,
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
