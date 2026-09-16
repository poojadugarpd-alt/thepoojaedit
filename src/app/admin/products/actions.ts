"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CatalogType, ConditionGrade, ImageType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { rupeesToPaise } from "@/lib/money";
import { publicEnv } from "@/lib/public-env";
import { createSupabaseStoragePort } from "@/lib/storage";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  ValidationError,
  createProduct,
  deleteProduct,
  publishProduct,
  setProductStatus,
  switchProductCatalog,
  toggleFeatureOnHomePage,
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

// ── FormData-based actions (still wrapped in `<ActionForm>`/`useActionState`
// for the handful of small, independent, instant actions this page keeps —
// delete, reorder, set-primary, home-page feature toggle). ──

export type ActionState = { ok: boolean; message?: string; errors?: string[] };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function handle(e: unknown): ActionState {
  if (e instanceof ValidationError)
    return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

/** Same mapping as `handle`, typed for the plain-object actions below whose
 *  result type needs the `false` branch's `ok` to be a literal, not `boolean`. */
function handleResult(e: unknown): { ok: false; message: string; errors?: string[] } {
  if (e instanceof ValidationError)
    return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
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

// Every field this needs (productId, catalog) is bound at the call site —
// nothing to read from the form, same shape as deleteProductAction above.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function toggleFeatureOnHomeAction(
  productId: string,
  catalog: CatalogType,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const admin = await requireAdmin();
  try {
    await toggleFeatureOnHomePage(prisma, admin, productId, catalog);
  } catch (e) {
    return handle(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/collections");
  revalidatePath("/");
  return { ok: true };
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
      { db: prisma, storage, admin, supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL },
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

// ── Plain typed-argument actions for the unified product editor — called
// directly from client code (not through `<form action>`), same reasoning
// as the image-upload pair above: this page holds one piece of controlled
// state across the whole product, so its save actions take that state
// directly rather than a FormData a `<form>` would have serialized. ──

export type SimpleResult = { ok: true; message?: string } | { ok: false; message: string; errors?: string[] };

export type ProductCoreInput = {
  slug?: string;
  title?: string;
  description?: string;
  /** Shown as "Vendor" in the UI — same underlying field as always. */
  brand?: string | null;
  tags?: string[];
  hsnCode?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export async function updateProductAction(
  productId: string,
  input: ProductCoreInput,
  reason?: string,
): Promise<SimpleResult> {
  const admin = await requireAdmin();
  try {
    await updateProduct(
      prisma,
      admin,
      productId,
      {
        slug: input.slug?.trim() || undefined,
        title: input.title?.trim(),
        description: input.description,
        brand: input.brand?.trim() || null,
        tags: input.tags?.map((t) => t.trim()).filter(Boolean),
        hsnCode: input.hsnCode?.trim() || null,
        metaTitle: input.metaTitle?.trim() || null,
        metaDescription: input.metaDescription?.trim() || null,
      },
      reason?.trim() || undefined,
    );
  } catch (e) {
    return handleResult(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Saved." };
}

export async function switchCatalogAction(
  productId: string,
  targetCatalog: CatalogType,
): Promise<SimpleResult> {
  const admin = await requireAdmin();
  let result: Awaited<ReturnType<typeof switchProductCatalog>>;
  try {
    result = await switchProductCatalog(prisma, admin, productId, targetCatalog);
  } catch (e) {
    return handleResult(e);
  }
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  const notes: string[] = [];
  if (result.removedFromCollections > 0) {
    notes.push(
      `removed from ${result.removedFromCollections} collection${result.removedFromCollections === 1 ? "" : "s"} that belonged to the other catalogue`,
    );
  }
  if (result.thriftDetailsCreated) notes.push("added placeholder condition/measurements to fill in");
  if (result.thriftDetailsRemoved) notes.push("its thrift details were removed");
  if (result.categoryCleared) notes.push("its category was cleared");
  const suffix = notes.length ? ` (${notes.join("; ")})` : "";
  return {
    ok: true,
    message: `Moved to ${targetCatalog === "THRIFT" ? "the Closet" : "the Label"} and set to Draft${suffix}. Review and republish when ready.`,
  };
}

export async function statusAction(
  productId: string,
  next: "PUBLISH" | "DRAFT" | "ARCHIVE",
  reason?: string,
): Promise<SimpleResult> {
  const admin = await requireAdmin();
  try {
    if (next === "PUBLISH") await publishProduct(prisma, admin, productId);
    else
      await setProductStatus(
        prisma,
        admin,
        productId,
        next === "DRAFT" ? "DRAFT" : "ARCHIVED",
        reason?.trim() || undefined,
      );
  } catch (e) {
    return handleResult(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  return { ok: true, message: "Status changed." };
}

export type VariantInput = {
  id?: string;
  /** Omit/empty for Closet — generated automatically. Required for Label. */
  sku?: string;
  size?: string | null;
  color?: string | null;
  price: number | string;
  compareAt?: number | string | null;
  onHandQty?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
};

export type VariantResult =
  | { ok: true; variantId: string }
  | { ok: false; message: string; errors?: string[] };

export async function upsertVariantAction(
  productId: string,
  input: VariantInput,
): Promise<VariantResult> {
  const admin = await requireAdmin();
  try {
    const variant = await upsertVariant(prisma, admin, productId, {
      id: input.id,
      sku: input.sku?.trim() || undefined,
      size: input.size?.trim() || null,
      color: input.color?.trim() || null,
      pricePaise: rupeesToPaise(input.price || 0),
      compareAtPaise: input.compareAt ? rupeesToPaise(input.compareAt) : null,
      onHandQty: input.onHandQty ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      isActive: input.isActive ?? true,
    });
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, variantId: variant.id };
  } catch (e) {
    const h = handle(e);
    return { ok: false, message: h.message ?? "Something went wrong.", errors: h.errors };
  }
}

export type ThriftDetailsInput = {
  conditionGrade: ConditionGrade;
  conditionNotes?: string | null;
  originalBrand?: string | null;
  labelledSize?: string | null;
  recommendedFit?: string | null;
  fabric?: string | null;
  /** Raw JSON text from the measurements textarea — parsed here, same
   *  validation as before ("Measurements must be valid JSON."). */
  measurementsJson: string;
  alterations?: string | null;
  authenticityNotes?: string | null;
  careNotes?: string | null;
  isOneOfOne: boolean;
  acquisitionCost?: number | string | null;
};

export async function thriftDetailsAction(
  productId: string,
  input: ThriftDetailsInput,
): Promise<SimpleResult> {
  const admin = await requireAdmin();
  let measurements: Record<string, unknown> = {};
  const raw = input.measurementsJson?.trim();
  if (raw) {
    try {
      measurements = JSON.parse(raw);
    } catch {
      return { ok: false, message: "Measurements must be valid JSON." };
    }
  }
  try {
    await upsertThriftDetails(prisma, admin, productId, {
      conditionGrade: input.conditionGrade,
      conditionNotes: input.conditionNotes ?? null,
      originalBrand: input.originalBrand ?? null,
      labelledSize: input.labelledSize ?? null,
      recommendedFit: input.recommendedFit ?? null,
      fabric: input.fabric ?? null,
      measurements,
      alterations: input.alterations ?? null,
      authenticityNotes: input.authenticityNotes ?? null,
      careNotes: input.careNotes ?? null,
      isOneOfOne: input.isOneOfOne,
      acquisitionCostPaise: input.acquisitionCost
        ? rupeesToPaise(input.acquisitionCost)
        : null,
    });
  } catch (e) {
    return handleResult(e);
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Thrift details saved." };
}

export type FullProductInput = ProductCoreInput & {
  catalog: CatalogType;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  variants: VariantInput[];
  thrift?: ThriftDetailsInput;
};

export type FullProductResult =
  | { ok: true; productId: string }
  | {
      ok: false;
      message: string;
      errors?: string[];
      productId?: string;
      /** Per-submitted-variant outcome, same order as the `variants` array
       *  this was called with (see D-124). A retry needs this to tell which
       *  rows already exist in the DB — without it, a retry re-`create()`s
       *  a row that was already made on a previous partial failure and
       *  permanently deadlocks on its own SKU's unique constraint. */
      variantResults?: VariantResult[];
    };

/**
 * Orchestrates a brand-new product's first Save — create, then every
 * variant row from the matrix, then thrift details (Closet), then status if
 * it's not the default DRAFT. Each step reuses the exact same domain-service
 * call the granular edit-time actions above use (D-77: pure composition, no
 * lifecycle rule re-implemented here) — this just sequences several of them
 * behind one Save click instead of several separate ones.
 *
 * Not wrapped in a single DB transaction (Storage uploads for images happen
 * after this returns and can never participate in one anyway) — instead, if
 * `createProduct` itself succeeds but a later step throws, the already-real
 * `productId` is still returned alongside the failure so the client can
 * carry on editing/retrying against the real row rather than risk creating
 * a second duplicate product on retry. Every variant row is attempted even
 * if an earlier one fails, and every row's outcome (including its real id
 * on success) comes back in `variantResults` — a failed retry used to lose
 * track of rows that *had* already been created, re-attempting a `create()`
 * against their own now-existing SKU forever (D-124).
 */
export async function createFullProductAction(
  input: FullProductInput,
): Promise<FullProductResult> {
  const admin = await requireAdmin();
  let productId: string | undefined;
  let variantResults: VariantResult[] | undefined;
  try {
    const created = await createProduct(prisma, admin, {
      catalog: input.catalog,
      title: input.title.trim(),
      description: input.description,
      brand: input.brand?.trim() || null,
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      hsnCode: input.hsnCode?.trim() || null,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
    });
    productId = created.id;

    variantResults = [];
    for (const v of input.variants) {
      try {
        const variant = await upsertVariant(prisma, admin, productId, {
          sku: v.sku?.trim() || undefined,
          size: v.size?.trim() || null,
          color: v.color?.trim() || null,
          pricePaise: rupeesToPaise(v.price || 0),
          compareAtPaise: v.compareAt ? rupeesToPaise(v.compareAt) : null,
          onHandQty: v.onHandQty ?? 0,
          lowStockThreshold: v.lowStockThreshold ?? 0,
          isActive: v.isActive ?? true,
        });
        variantResults.push({ ok: true, variantId: variant.id });
      } catch (e) {
        const h = handle(e);
        variantResults.push({ ok: false, message: h.message ?? "Something went wrong.", errors: h.errors });
      }
    }
    const variantFailures = variantResults.filter((r) => !r.ok);
    if (variantFailures.length > 0) {
      return {
        ok: false,
        message: variantFailures.map((f) => f.message).join(" "),
        errors: variantFailures.flatMap((f) => f.errors ?? []),
        productId,
        variantResults,
      };
    }

    if (input.catalog === "THRIFT" && input.thrift) {
      let measurements: Record<string, unknown> = {};
      const raw = input.thrift.measurementsJson?.trim();
      if (raw) {
        try {
          measurements = JSON.parse(raw);
        } catch {
          return { ok: false, message: "Measurements must be valid JSON.", productId, variantResults };
        }
      }
      await upsertThriftDetails(prisma, admin, productId, {
        conditionGrade: input.thrift.conditionGrade,
        conditionNotes: input.thrift.conditionNotes ?? null,
        originalBrand: input.thrift.originalBrand ?? null,
        labelledSize: input.thrift.labelledSize ?? null,
        recommendedFit: input.thrift.recommendedFit ?? null,
        fabric: input.thrift.fabric ?? null,
        measurements,
        alterations: input.thrift.alterations ?? null,
        authenticityNotes: input.thrift.authenticityNotes ?? null,
        careNotes: input.thrift.careNotes ?? null,
        isOneOfOne: input.thrift.isOneOfOne,
        acquisitionCostPaise: input.thrift.acquisitionCost
          ? rupeesToPaise(input.thrift.acquisitionCost)
          : null,
      });
    }

    if (input.status === "PUBLISHED") {
      await publishProduct(prisma, admin, productId);
    } else if (input.status === "ARCHIVED") {
      await setProductStatus(prisma, admin, productId, "ARCHIVED");
    }
  } catch (e) {
    const h = handle(e);
    return {
      ok: false,
      message: h.message ?? "Something went wrong.",
      errors: h.errors,
      productId,
      variantResults,
    };
  }
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, productId };
}
