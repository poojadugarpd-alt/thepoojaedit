import "server-only";

import type {
  AdminUser,
  CatalogType,
  ConditionGrade,
  PrismaClient,
  Product,
  ProductVariant,
} from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import type { StoragePort } from "@/lib/storage";
import { auditLog } from "@/server/admin/audit";

import { generateClosetSku } from "./sku";
import { generateUniqueSlug } from "./slug";

/**
 * Catalog write operations (master §4, §10). Every function takes the acting
 * `AdminUser` (already authorised by `requireAdmin()` in the route/action) and
 * writes an `AdminActivityLog` entry. Catalog scope is enforced here, not in the
 * UI. Pure over `db` so it is testable against a real PostgreSQL.
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly errors: string[] = [message],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ───────────────────────── Admin reads ─────────────────────────

export type ProductStatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

export async function listAdminProducts(
  db: PrismaClient,
  opts: {
    catalog?: CatalogType;
    status?: ProductStatusFilter;
    q?: string;
    skip?: number;
    take?: number;
  } = {},
) {
  const where: Prisma.ProductWhereInput = {
    ...(opts.catalog ? { catalog: opts.catalog } : {}),
    ...(opts.status && opts.status !== "ALL" ? { status: opts.status } : {}),
    ...(opts.q && opts.q.trim().length >= 2
      ? {
          OR: [
            { title: { contains: opts.q.trim(), mode: "insensitive" } },
            { slug: { contains: opts.q.trim(), mode: "insensitive" } },
            { brand: { contains: opts.q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
  // Speed audit (2026-09-13): a single query, over-fetching by one row to
  // learn "is there a next page" cheaply — no separate `db.product.count()`.
  // The exact total was only ever used to draw "Page X of Y"; the UI now
  // shows "Page X" with Previous/Next instead, so nothing needs it. Also
  // dropped `_count.select.variants` (redundant — `variants.length` is the
  // same number, from data already being fetched) and fetches only the
  // primary image (one row, not the full gallery) for the list thumbnail.
  const rows = await db.product.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    skip: opts.skip ?? 0,
    take: take + 1,
    include: {
      _count: { select: { images: true } },
      variants: { select: { pricePaise: true, onHandQty: true, reservedQty: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { publicUrl: true, altText: true },
      },
    },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return {
    hasMore,
    take,
    items: page.map((p) => ({
      id: p.id,
      catalog: p.catalog,
      slug: p.slug,
      title: p.title,
      status: p.status,
      variantCount: p.variants.length,
      imageCount: p._count.images,
      primaryImage: p.images[0] ?? null,
      fromPricePaise: p.variants.length
        ? Math.min(...p.variants.map((v) => v.pricePaise))
        : null,
      onHand: p.variants.reduce((s, v) => s + v.onHandQty, 0),
      available: p.variants.reduce((s, v) => s + (v.onHandQty - v.reservedQty), 0),
    })),
  };
}

export function getAdminProduct(db: PrismaClient, id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
      images: { orderBy: { sortPosition: "asc" } },
      thriftDetails: true,
      category: true,
      collections: { include: { collection: true } },
    },
  });
}

export async function adminOverviewCounts(db: PrismaClient) {
  const [byCatStatus, images, needsReview] = await Promise.all([
    db.product.groupBy({ by: ["catalog", "status"], _count: true }),
    db.productImage.count(),
    db.product.count({ where: { status: "DRAFT" } }),
  ]);
  return { byCatStatus, images, drafts: needsReview };
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function assertSlug(slug: string) {
  if (!slugRe.test(slug)) {
    throw new ValidationError(`Invalid slug "${slug}" (lowercase, digits, hyphens).`);
  }
}

// ─────────────────────────── Products ───────────────────────────

export async function createProduct(
  db: PrismaClient,
  admin: AdminUser,
  input: {
    catalog: CatalogType;
    /** Omit to auto-generate from `title` (owner feedback, 2026-09-13 — the
     *  admin UI no longer asks for one). Pass an explicit value only for
     *  scripted/seed callers that need a specific slug; it is still
     *  validated and uniqueness-checked exactly as before. */
    slug?: string;
    title: string;
    description?: string;
    brand?: string | null;
    hsnCode?: string | null;
    categoryId?: string | null;
  },
): Promise<Product> {
  let slug: string;
  if (input.slug) {
    assertSlug(input.slug);
    const clash = await db.product.findUnique({
      where: { catalog_slug: { catalog: input.catalog, slug: input.slug } },
      select: { id: true },
    });
    if (clash) {
      throw new ValidationError(
        `A product with slug "${input.slug}" already exists in this catalogue.`,
      );
    }
    slug = input.slug;
  } else {
    slug = await generateUniqueSlug(db, input.catalog, input.title);
  }
  if (input.categoryId)
    await assertCategoryInCatalog(db, input.categoryId, input.catalog);

  const product = await db.product.create({
    data: {
      catalog: input.catalog,
      slug,
      title: input.title,
      description: input.description ?? "",
      brand: input.brand ?? null,
      hsnCode: input.hsnCode ?? null,
      categoryId: input.categoryId ?? null,
      status: "DRAFT",
    },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "product.create",
    entityType: "Product",
    entityId: product.id,
    after: { catalog: product.catalog, slug: product.slug, title: product.title },
  });
  return product;
}

export async function updateProduct(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
  patch: {
    slug?: string;
    title?: string;
    description?: string;
    brand?: string | null;
    hsnCode?: string | null;
    categoryId?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  },
  reason?: string,
): Promise<Product> {
  const before = await db.product.findUniqueOrThrow({ where: { id } });
  if (patch.slug && patch.slug !== before.slug) {
    assertSlug(patch.slug);
    const clash = await db.product.findUnique({
      where: { catalog_slug: { catalog: before.catalog, slug: patch.slug } },
      select: { id: true },
    });
    if (clash)
      throw new ValidationError(`slug "${patch.slug}" is taken in this catalogue.`);
  }
  if (patch.categoryId)
    await assertCategoryInCatalog(db, patch.categoryId, before.catalog);

  const after = await db.product.update({ where: { id }, data: patch });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "product.update",
    entityType: "Product",
    entityId: id,
    before,
    after,
    reason: reason ?? null,
  });
  return after;
}

export interface PublicationCheck {
  ok: boolean;
  errors: string[];
}

/** Master §10: thrift defects/measurements required for publication. */
export function validateForPublication(product: {
  catalog: CatalogType;
  variants: Pick<ProductVariant, "isActive" | "pricePaise" | "onHandQty">[];
  images: unknown[];
  thriftDetails: {
    conditionGrade: ConditionGrade | null;
    measurements: unknown;
    isOneOfOne: boolean;
  } | null;
}): PublicationCheck {
  const errors: string[] = [];
  if (product.images.length === 0) errors.push("At least one image is required.");
  const priced = product.variants.filter((v) => v.isActive && v.pricePaise > 0);
  if (priced.length === 0)
    errors.push("At least one active, priced variant is required.");

  if (product.catalog === "THRIFT") {
    const t = product.thriftDetails;
    if (!t) errors.push("Thrift details are missing.");
    else {
      if (!t.conditionGrade) errors.push("Condition grade is required for thrift.");
      const m = t.measurements;
      const measCount =
        m && typeof m === "object"
          ? Object.keys(m as Record<string, unknown>).filter((k) => !k.startsWith("_"))
              .length
          : 0;
      if (measCount === 0)
        errors.push("At least one measurement is required for thrift.");
    }
    const totalOnHand = product.variants.reduce((s, v) => s + v.onHandQty, 0);
    if (product.thriftDetails?.isOneOfOne && totalOnHand > 1) {
      errors.push("A one-of-one thrift piece cannot have on-hand quantity above 1.");
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function publishProduct(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
): Promise<Product> {
  const product = await db.product.findUniqueOrThrow({
    where: { id },
    include: { variants: true, images: true, thriftDetails: true },
  });
  const check = validateForPublication(product);
  if (!check.ok)
    throw new ValidationError("Product is not ready to publish.", check.errors);

  const after = await db.product.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: product.publishedAt ?? new Date() },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "product.publish",
    entityType: "Product",
    entityId: id,
    before: { status: product.status },
    after: { status: after.status },
  });
  return after;
}

export async function setProductStatus(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
  status: "DRAFT" | "ARCHIVED",
  reason?: string,
): Promise<Product> {
  const before = await db.product.findUniqueOrThrow({ where: { id } });
  const after = await db.product.update({ where: { id }, data: { status } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: `product.${status.toLowerCase()}`,
    entityType: "Product",
    entityId: id,
    before: { status: before.status },
    after: { status: after.status },
    reason: reason ?? null,
  });
  return after;
}

/** Thrown when a delete is refused because the product has real order history. */
export class ProductHasHistoryError extends ValidationError {
  constructor() {
    super("This product is on past orders, so it can't be deleted.");
    this.name = "ProductHasHistoryError";
  }
}

/**
 * A real, permanent delete — distinct from `setProductStatus(..., "ARCHIVED")`
 * ("Hide from shop" in the UI), which is what every product with any order
 * history must use instead (owner feedback, 2026-09-13). Allowed only when
 * the product has **never** appeared on an order: no `OrderItem` referencing
 * it or any of its variants, no `InventoryReservation`, no
 * `InventoryTransaction` — checked explicitly here so the refusal is a clean
 * message, not a raw foreign-key error (both `InventoryReservation.variant`
 * and `InventoryTransaction.variant` are `onDelete: Restrict` in the schema,
 * so Postgres would refuse the cascade anyway; this check is what turns that
 * into "This product is on past orders" instead of a 500).
 *
 * Storage objects are removed before the DB row — `ProductImage` rows
 * themselves cascade-delete with the product (`onDelete: Cascade`), so if
 * this were ordered the other way a failed Storage call could leave the DB
 * row gone with the file still billed and orphaned; deleting the files
 * first and the row second means a failure here just leaves the row (and
 * files) in place to retry, never a silent leak.
 */
export async function deleteProduct(
  db: PrismaClient,
  storage: StoragePort,
  admin: AdminUser,
  id: string,
): Promise<void> {
  const product = await db.product.findUniqueOrThrow({
    where: { id },
    include: { variants: true, images: true },
  });
  const variantIds = product.variants.map((v) => v.id);

  const [orderItemCount, reservationCount, transactionCount] = await Promise.all([
    db.orderItem.count({
      where: {
        OR: [
          { productId: id },
          ...(variantIds.length ? [{ variantId: { in: variantIds } }] : []),
        ],
      },
    }),
    variantIds.length
      ? db.inventoryReservation.count({ where: { variantId: { in: variantIds } } })
      : 0,
    variantIds.length
      ? db.inventoryTransaction.count({ where: { variantId: { in: variantIds } } })
      : 0,
  ]);
  if (orderItemCount > 0 || reservationCount > 0 || transactionCount > 0) {
    throw new ProductHasHistoryError();
  }

  if (product.images.length > 0) {
    // All product images share one bucket (product-images.ts's
    // PRODUCT_IMAGE_BUCKET) — grouping defensively rather than assuming it,
    // in case that ever changes.
    const byBucket = new Map<string, string[]>();
    for (const img of product.images) {
      const paths = byBucket.get(img.bucket) ?? [];
      paths.push(img.path);
      byBucket.set(img.bucket, paths);
    }
    for (const [bucket, paths] of byBucket) {
      await storage.deleteObjects(bucket, paths);
    }
  }

  // Cascades ProductVariant / ProductImage / ThriftDetails / ProductCollection
  // rows (all `onDelete: Cascade` on their `product` relation).
  await db.product.delete({ where: { id } });

  await auditLog(db, {
    adminUserId: admin.id,
    action: "product.delete",
    entityType: "Product",
    entityId: id,
    before: {
      catalog: product.catalog,
      slug: product.slug,
      title: product.title,
      variantCount: product.variants.length,
      imageCount: product.images.length,
    },
  });
}

// ─────────────────────────── Variants ───────────────────────────

export async function upsertVariant(
  db: PrismaClient,
  admin: AdminUser,
  productId: string,
  input: {
    id?: string;
    /** Omit/empty for a THRIFT (Closet) variant — generated automatically
     *  (owner feedback, 2026-09-13: a one-of-one piece has no size run to
     *  key a SKU off). Required for THE_POOJA_EDIT (Label). */
    sku?: string;
    size?: string | null;
    color?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    onHandQty?: number;
    lowStockThreshold?: number;
    isActive?: boolean;
  },
): Promise<ProductVariant> {
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { thriftDetails: true, variants: true },
  });

  if (input.pricePaise < 0) throw new ValidationError("Price must be >= 0.");
  if (product.catalog === "THRIFT" && product.thriftDetails?.isOneOfOne) {
    const others = product.variants.filter((v) => v.id !== input.id);
    if (others.length > 0) {
      throw new ValidationError(
        "A one-of-one thrift piece has a single variant. Edit the existing one.",
      );
    }
    if ((input.onHandQty ?? 0) > 1) {
      throw new ValidationError("On-hand quantity for a one-of-one piece is 0 or 1.");
    }
  }

  const submittedSku = input.sku?.trim();
  let sku: string;
  if (submittedSku) {
    sku = submittedSku;
  } else if (input.id) {
    // Update with no SKU submitted (the Closet form doesn't render the
    // field at all) — keep whatever this variant already has.
    const existing = product.variants.find((v) => v.id === input.id);
    if (!existing) throw new ValidationError("Variant not found.");
    sku = existing.sku;
  } else if (product.catalog === "THRIFT") {
    sku = await generateClosetSku(db);
  } else {
    throw new ValidationError("SKU is required.");
  }

  const data = {
    productId,
    sku,
    size: input.size ?? null,
    color: input.color ?? null,
    pricePaise: input.pricePaise,
    compareAtPaise: input.compareAtPaise ?? null,
    onHandQty: input.onHandQty ?? 0,
    lowStockThreshold: input.lowStockThreshold ?? 0,
    isActive: input.isActive ?? true,
  };

  const variant = input.id
    ? await db.productVariant.update({ where: { id: input.id }, data })
    : await db.productVariant.create({ data });

  await auditLog(db, {
    adminUserId: admin.id,
    action: input.id ? "variant.update" : "variant.create",
    entityType: "ProductVariant",
    entityId: variant.id,
    after: {
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      onHandQty: variant.onHandQty,
    },
  });
  return variant;
}

// ────────────────────────── Thrift details ─────────────────────

export async function upsertThriftDetails(
  db: PrismaClient,
  admin: AdminUser,
  productId: string,
  input: {
    conditionGrade: ConditionGrade;
    conditionNotes?: string | null;
    originalBrand?: string | null;
    labelledSize?: string | null;
    recommendedFit?: string | null;
    fabric?: string | null;
    measurements: unknown;
    flaws?: unknown;
    alterations?: string | null;
    authenticityNotes?: string | null;
    careNotes?: string | null;
    isOneOfOne?: boolean;
    acquisitionCostPaise?: number | null;
  },
) {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  if (product.catalog !== "THRIFT") {
    throw new ValidationError("Thrift details only apply to THRIFT products.");
  }
  const data = {
    conditionGrade: input.conditionGrade,
    conditionNotes: input.conditionNotes ?? null,
    originalBrand: input.originalBrand ?? null,
    labelledSize: input.labelledSize ?? null,
    recommendedFit: input.recommendedFit ?? null,
    fabric: input.fabric ?? null,
    measurements: (input.measurements ?? {}) as Prisma.InputJsonValue,
    flaws: (input.flaws ?? []) as Prisma.InputJsonValue,
    alterations: input.alterations ?? null,
    authenticityNotes: input.authenticityNotes ?? null,
    careNotes: input.careNotes ?? null,
    isOneOfOne: input.isOneOfOne ?? true,
    acquisitionCostPaise: input.acquisitionCostPaise ?? null,
  };
  const row = await db.thriftDetails.upsert({
    where: { productId },
    update: data,
    create: { ...data, productId },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "thriftDetails.upsert",
    entityType: "ThriftDetails",
    entityId: row.id,
  });
  return row;
}

// ─────────────────────── Categories & collections ─────────────

async function assertCategoryInCatalog(
  db: PrismaClient,
  categoryId: string,
  catalog: CatalogType,
) {
  const cat = await db.category.findUnique({
    where: { id: categoryId },
    select: { catalog: true },
  });
  if (!cat) throw new ValidationError("Category not found.");
  if (cat.catalog != null && cat.catalog !== catalog) {
    throw new ValidationError("Category belongs to a different catalogue.");
  }
}

export async function createCategory(
  db: PrismaClient,
  admin: AdminUser,
  input: {
    catalog: CatalogType | null;
    slug: string;
    name: string;
    parentId?: string | null;
  },
) {
  assertSlug(input.slug);
  try {
    const cat = await db.category.create({
      data: {
        catalog: input.catalog,
        slug: input.slug,
        name: input.name,
        parentId: input.parentId ?? null,
      },
    });
    await auditLog(db, {
      adminUserId: admin.id,
      action: "category.create",
      entityType: "Category",
      entityId: cat.id,
      after: { catalog: cat.catalog, slug: cat.slug },
    });
    return cat;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError(`A category with slug "${input.slug}" already exists.`);
    }
    throw e;
  }
}

export async function createCollection(
  db: PrismaClient,
  admin: AdminUser,
  input: {
    catalog: CatalogType;
    slug: string;
    name: string;
    description?: string | null;
  },
) {
  assertSlug(input.slug);
  const clash = await db.collection.findUnique({
    where: { catalog_slug: { catalog: input.catalog, slug: input.slug } },
    select: { id: true },
  });
  if (clash)
    throw new ValidationError(`slug "${input.slug}" is taken in this catalogue.`);
  const col = await db.collection.create({
    data: {
      catalog: input.catalog,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      isActive: false,
    },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "collection.create",
    entityType: "Collection",
    entityId: col.id,
    after: { catalog: col.catalog, slug: col.slug },
  });
  return col;
}

export async function setCollectionActive(
  db: PrismaClient,
  admin: AdminUser,
  id: string,
  isActive: boolean,
) {
  const col = await db.collection.update({ where: { id }, data: { isActive } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: isActive ? "collection.activate" : "collection.deactivate",
    entityType: "Collection",
    entityId: id,
  });
  return col;
}

export async function addProductToCollection(
  db: PrismaClient,
  admin: AdminUser,
  collectionId: string,
  productId: string,
): Promise<void> {
  const [col, product] = await Promise.all([
    db.collection.findUniqueOrThrow({
      where: { id: collectionId },
      select: { catalog: true },
    }),
    db.product.findUniqueOrThrow({
      where: { id: productId },
      select: { catalog: true },
    }),
  ]);
  if (col.catalog !== product.catalog) {
    throw new ValidationError(
      "Collection membership cannot cross catalogues (master §4).",
    );
  }
  const last = await db.productCollection.findFirst({
    where: { collectionId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.productCollection.upsert({
    where: { productId_collectionId: { productId, collectionId } },
    update: {},
    create: { productId, collectionId, position: (last?.position ?? -1) + 1 },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "collection.addProduct",
    entityType: "Collection",
    entityId: collectionId,
    after: { productId },
  });
}

export async function removeProductFromCollection(
  db: PrismaClient,
  admin: AdminUser,
  collectionId: string,
  productId: string,
): Promise<void> {
  await db.productCollection.deleteMany({ where: { collectionId, productId } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "collection.removeProduct",
    entityType: "Collection",
    entityId: collectionId,
    after: { productId },
  });
}
