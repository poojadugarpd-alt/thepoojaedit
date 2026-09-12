"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CatalogType, ConditionGrade, ImageType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { createSupabaseStoragePort } from "@/lib/storage";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  ValidationError,
  createProduct,
  deleteProduct,
  publishProduct,
  setProductStatus,
  updateProduct,
  upsertThriftDetails,
  upsertVariant,
} from "@/server/catalog/admin";
import {
  ImageValidationError,
  confirmProductImageUpload,
  requestProductImageUpload,
  type UploadTicket,
} from "@/server/catalog/product-images";

export type ActionState = { ok: boolean; message?: string; errors?: string[] };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v: FormDataEntryValue | null) => str(v) || null;
const intOrNull = (v: FormDataEntryValue | null) => {
  const s = str(v);
  return s === "" ? null : Number(s);
};

function handle(e: unknown): ActionState {
  if (e instanceof ValidationError)
    return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

export async function createProductAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  let id: string;
  try {
    const p = await createProduct(prisma, admin, {
      catalog: str(form.get("catalog")) as CatalogType,
      title: str(form.get("title")),
      // No slug field on this form (owner feedback, 2026-09-13) —
      // createProduct generates and uniques one from the title.
    });
    id = p.id;
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/products");
  redirect(`/admin/products/${id}`);
}

export async function updateProductAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await updateProduct(
      prisma,
      admin,
      productId,
      {
        slug: str(form.get("slug")),
        title: str(form.get("title")),
        description: str(form.get("description")),
        brand: strOrNull(form.get("brand")),
        hsnCode: strOrNull(form.get("hsnCode")),
        metaTitle: strOrNull(form.get("metaTitle")),
        metaDescription: strOrNull(form.get("metaDescription")),
      },
      strOrNull(form.get("reason")) ?? undefined,
    );
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Saved." };
}

export async function statusAction(
  productId: string,
  next: "PUBLISH" | "DRAFT" | "ARCHIVE",
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    if (next === "PUBLISH") await publishProduct(prisma, admin, productId);
    else
      await setProductStatus(
        prisma,
        admin,
        productId,
        next === "DRAFT" ? "DRAFT" : "ARCHIVED",
        strOrNull(form.get("reason")) ?? undefined,
      );
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  return { ok: true, message: `Status changed.` };
}

// Every field the delete needs (productId) is already bound via
// `.bind(null, id)` at the call site — nothing else to read from the form,
// unlike every other action here.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function deleteProductAction(
  productId: string,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const admin = await requireAdmin();
  try {
    const storage = await createSupabaseStoragePort();
    await deleteProduct(prisma, storage, admin, productId);
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function upsertVariantAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await upsertVariant(prisma, admin, productId, {
      id: strOrNull(form.get("id")) ?? undefined,
      sku: str(form.get("sku")),
      size: strOrNull(form.get("size")),
      color: strOrNull(form.get("color")),
      pricePaise: Number(str(form.get("pricePaise")) || 0),
      compareAtPaise: intOrNull(form.get("compareAtPaise")),
      onHandQty: Number(str(form.get("onHandQty")) || 0),
      lowStockThreshold: Number(str(form.get("lowStockThreshold")) || 0),
      isActive: form.get("isActive") === "on",
    });
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Variant saved." };
}

export async function deleteImageAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const imageId = str(form.get("imageId"));
  try {
    await prisma.productImage.delete({ where: { id: imageId } });
    await prisma.adminActivityLog.create({
      data: {
        adminUserId: admin.id,
        action: "image.delete",
        entityType: "ProductImage",
        entityId: imageId,
      },
    });
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Image removed." };
}

export async function setPrimaryImageAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const imageId = str(form.get("imageId"));
  try {
    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true, type: "PRIMARY", sortPosition: 0 },
      }),
    ]);
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Primary image set." };
}

export async function thriftDetailsAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  let measurements: Record<string, unknown> = {};
  const raw = str(form.get("measurementsJson"));
  if (raw) {
    try {
      measurements = JSON.parse(raw);
    } catch {
      return { ok: false, message: "Measurements must be valid JSON." };
    }
  }
  try {
    await upsertThriftDetails(prisma, admin, productId, {
      conditionGrade: str(form.get("conditionGrade")) as ConditionGrade,
      conditionNotes: strOrNull(form.get("conditionNotes")),
      originalBrand: strOrNull(form.get("originalBrand")),
      labelledSize: strOrNull(form.get("labelledSize")),
      recommendedFit: strOrNull(form.get("recommendedFit")),
      fabric: strOrNull(form.get("fabric")),
      measurements,
      alterations: strOrNull(form.get("alterations")),
      authenticityNotes: strOrNull(form.get("authenticityNotes")),
      careNotes: strOrNull(form.get("careNotes")),
      isOneOfOne: form.get("isOneOfOne") === "on",
      acquisitionCostPaise: intOrNull(form.get("acquisitionCostPaise")),
    });
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Thrift details saved." };
}

// ── Image upload (called directly from client JS, not through <form action>,
// so these return plain result objects rather than ActionState). ──

export type UploadTicketResult =
  | ({ ok: true } & UploadTicket)
  | { ok: false; message: string };

/** Step 1: ask for a short-lived URL the browser uploads the file bytes to. */
export async function requestImageUploadAction(
  productId: string,
  contentType: string,
): Promise<UploadTicketResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createSupabaseStoragePort();
    const ticket = await requestProductImageUpload(
      { db: prisma, storage, admin },
      { productId, contentType },
    );
    return { ok: true, ...ticket };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof ImageValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not start the upload.",
    };
  }
}

export type ConfirmImageResult =
  | { ok: true; imageId: string }
  | { ok: false; message: string };

/** Step 2: once the PUT to the signed URL succeeds, register the row. */
export async function confirmImageUploadAction(
  productId: string,
  input: {
    imageId: string;
    path: string;
    contentType: string;
    altText: string;
    type: ImageType;
    isPrimary: boolean;
    width: number | null;
    height: number | null;
  },
): Promise<ConfirmImageResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createSupabaseStoragePort();
    const image = await confirmProductImageUpload(
      { db: prisma, storage, admin },
      { productId, ...input },
    );
    await prisma.adminActivityLog.create({
      data: {
        adminUserId: admin.id,
        action: "image.upload",
        entityType: "ProductImage",
        entityId: image.id,
      },
    });
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof ImageValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not save the uploaded image.",
    };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, imageId: input.imageId };
}

/** Swap sort position with the previous/next image — the mobile reorder control. */
export async function reorderImageAction(
  productId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const imageId = str(form.get("imageId"));
  const direction = str(form.get("direction"));
  try {
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortPosition: "asc" },
    });
    const idx = images.findIndex((im) => im.id === imageId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= images.length) {
      return { ok: true }; // already at an end — silently a no-op
    }
    const a = images[idx];
    const b = images[swapIdx];
    await prisma.$transaction([
      prisma.productImage.update({
        where: { id: a.id },
        data: { sortPosition: b.sortPosition },
      }),
      prisma.productImage.update({
        where: { id: b.id },
        data: { sortPosition: a.sortPosition },
      }),
    ]);
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}
