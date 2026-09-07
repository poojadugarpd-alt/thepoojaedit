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
import { auditLog } from "@/server/admin/audit";

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
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: opts.skip ?? 0,
      take,
      include: {
        _count: { select: { variants: true, images: true } },
        variants: { select: { pricePaise: true, onHandQty: true, reservedQty: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  return {
    total,
    take,
    items: rows.map((p) => ({
      id: p.id,
      catalog: p.catalog,
      slug: p.slug,
      title: p.title,
      status: p.status,
      variantCount: p._count.variants,
      imageCount: p._count.images,
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
    slug: string;
    title: string;
    description?: string;
    brand?: string | null;
    hsnCode?: string | null;
    categoryId?: string | null;
  },
): Promise<Product> {
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
  if (input.categoryId)
    await assertCategoryInCatalog(db, input.categoryId, input.catalog);

  const product = await db.product.create({
    data: {
      catalog: input.catalog,
      slug: input.slug,
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

// ─────────────────────────── Variants ───────────────────────────

export async function upsertVariant(
  db: PrismaClient,
  admin: AdminUser,
  productId: string,
  input: {
    id?: string;
    sku: string;
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

  const data = {
    productId,
    sku: input.sku,
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
