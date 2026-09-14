import "server-only";

import type { CatalogType, PrismaClient } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

import {
  toPublicCard,
  toPublicDetail,
  type PublicProductCard,
  type PublicProductDetail,
} from "./public-shape";

/**
 * Public (storefront) catalog reads. Every query is scoped to ONE catalog and
 * to published products only (master spec §4). Detail lookups still resolve a
 * sold-out one-of-one so its URL survives (AC-02).
 *
 * Functions take `db` so they are testable against a real PostgreSQL; the thin
 * wrappers in `./index` bind the shared client.
 */

const CARD_INCLUDE = {
  variants: true,
  images: true,
  thriftDetails: true,
} satisfies Prisma.ProductInclude;

const DETAIL_INCLUDE = {
  variants: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { sortPosition: "asc" } },
  thriftDetails: true,
  collections: { include: { collection: true } },
} satisfies Prisma.ProductInclude;

export const PAGE_SIZE_DEFAULT = 24;
export const PAGE_SIZE_MAX = 60;
// Every catalog read below fetches at most this many rows from the DB, then
// sorts/filters/paginates in JS (see listPublishedProducts). Both catalogs
// are small, manually-curated collections (well under 500 items each), so a
// single bounded query is simpler and cheaper than keyset pagination — and
// it's what makes "sold-out always sinks to the bottom" (owner request,
// 2026-09-14) possible at all: that ordering depends on stock, which isn't a
// plain indexed column to sort by in SQL.
const FETCH_CAP = 500;

export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface ProductFilters {
  /** Match if the product has a variant in ANY of these sizes. */
  sizes?: string[];
  priceMinPaise?: number;
  priceMaxPaise?: number;
  /** When true, sold-out / out-of-stock products are excluded entirely
   * rather than just sunk to the bottom of the list. */
  inStockOnly?: boolean;
}

export interface ProductPage {
  items: PublicProductCard[];
  nextCursor: string | null;
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(offset)).toString("base64url");
}
function decodeOffsetCursor(cursor: string): number {
  try {
    const n = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Paginated published products in one catalog. Sold-out / out-of-stock
 * products always sink to the end of the list — regardless of sort — with
 * the chosen sort applied within each of the two groups (owner request,
 * 2026-09-14: "all the Products that are sold out in the closet [should be]
 * moved down automatically"). Offset cursor: fine at this catalog's scale,
 * and unlike a keyset it works uniformly for every sort, not just "newest".
 */
export async function listPublishedProducts(
  db: PrismaClient,
  opts: {
    catalog: CatalogType;
    limit?: number;
    cursor?: string | null;
    sort?: ProductSort;
    categorySlug?: string;
    filters?: ProductFilters;
  },
): Promise<ProductPage> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
  const sort = opts.sort ?? "newest";
  const f = opts.filters;

  // Size and price are two independent "has at least one variant matching
  // this facet" conditions — kept as separate `AND` clauses (not merged into
  // one `variants.some`) so a size filter and a price filter don't require
  // the SAME variant to satisfy both.
  const variantConditions: Prisma.ProductWhereInput[] = [];
  if (f?.sizes?.length) {
    variantConditions.push({ variants: { some: { size: { in: f.sizes } } } });
  }
  if (f?.priceMinPaise != null || f?.priceMaxPaise != null) {
    variantConditions.push({
      variants: {
        some: {
          pricePaise: {
            ...(f.priceMinPaise != null ? { gte: f.priceMinPaise } : {}),
            ...(f.priceMaxPaise != null ? { lte: f.priceMaxPaise } : {}),
          },
        },
      },
    });
  }

  const where: Prisma.ProductWhereInput = {
    catalog: opts.catalog,
    status: "PUBLISHED",
    publishedAt: { not: null },
    ...(opts.categorySlug
      ? { category: { slug: opts.categorySlug, catalog: opts.catalog } }
      : {}),
    ...(variantConditions.length ? { AND: variantConditions } : {}),
  };

  const rows = await db.product.findMany({
    where,
    include: CARD_INCLUDE,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: FETCH_CAP,
  });

  let cards = rows.map(toPublicCard);
  if (f?.inStockOnly) {
    cards = cards.filter((c) => c.availability === "IN_STOCK");
  }

  const byChosenSort = (a: PublicProductCard, b: PublicProductCard) => {
    if (sort === "price_asc")
      return (a.fromPricePaise ?? Infinity) - (b.fromPricePaise ?? Infinity);
    if (sort === "price_desc")
      return (b.fromPricePaise ?? -Infinity) - (a.fromPricePaise ?? -Infinity);
    return 0; // "newest" — rows already arrive publishedAt desc; keep that order
  };
  const available = cards
    .filter((c) => c.availability === "IN_STOCK")
    .sort(byChosenSort);
  const soldOrOut = cards
    .filter((c) => c.availability !== "IN_STOCK")
    .sort(byChosenSort);
  const sorted = [...available, ...soldOrOut];

  const offset = opts.cursor ? decodeOffsetCursor(opts.cursor) : 0;
  const page = sorted.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  return {
    items: page,
    nextCursor: nextOffset < sorted.length ? encodeOffsetCursor(nextOffset) : null,
  };
}

export interface ProductFacets {
  sizes: string[];
  priceMinPaise: number | null;
  priceMaxPaise: number | null;
}

/** Distinct sizes and the price range across every published product in a
 * catalog — bounds for the filter UI (owner request, 2026-09-14). Sizes are
 * sorted the way a person would read them (XS < S < M < ... before anything
 * that doesn't match the standard scale, alphabetically). */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"];
function compareSizes(a: string, b: string): number {
  const ai = SIZE_ORDER.indexOf(a.toUpperCase());
  const bi = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
}

export async function getProductFacets(
  db: PrismaClient,
  catalog: CatalogType,
): Promise<ProductFacets> {
  const variants = await db.productVariant.findMany({
    where: { product: { catalog, status: "PUBLISHED", publishedAt: { not: null } } },
    select: { size: true, pricePaise: true },
  });
  const sizes = [
    ...new Set(variants.map((v) => v.size).filter((s): s is string => !!s)),
  ].sort(compareSizes);
  const prices = variants.map((v) => v.pricePaise);
  return {
    sizes,
    priceMinPaise: prices.length ? Math.min(...prices) : null,
    priceMaxPaise: prices.length ? Math.max(...prices) : null,
  };
}

/**
 * Resolve one product by (catalog, slug). Returns published products including a
 * sold one-of-one thrift piece. DRAFT / ARCHIVED and cross-catalog slugs resolve
 * to null (the route renders 404).
 */
export async function getPublishedProduct(
  db: PrismaClient,
  catalog: CatalogType,
  slug: string,
): Promise<PublicProductDetail | null> {
  const p = await db.product.findUnique({
    where: { catalog_slug: { catalog, slug } },
    include: DETAIL_INCLUDE,
  });
  if (!p || p.status !== "PUBLISHED" || p.publishedAt == null) return null;
  return toPublicDetail(p);
}

export async function searchPublishedProducts(
  db: PrismaClient,
  opts: { q: string; catalog?: CatalogType; limit?: number },
): Promise<PublicProductCard[]> {
  const q = opts.q.trim();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null },
      ...(opts.catalog ? { catalog: opts.catalog } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    include: CARD_INCLUDE,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map(toPublicCard);
}

export async function listActiveCollections(
  db: PrismaClient,
  catalog: CatalogType,
): Promise<{ slug: string; name: string; description: string | null }[]> {
  // isInternal collections (the home-page rails) are an admin merchandising
  // tool, not a shoppable collection page — never listed here (owner
  // feedback, 2026-09-13, Part B2).
  const rows = await db.collection.findMany({
    where: { catalog, isActive: true, isInternal: false },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, description: true },
  });
  return rows;
}

export async function getActiveCollection(
  db: PrismaClient,
  catalog: CatalogType,
  slug: string,
): Promise<{
  slug: string;
  name: string;
  description: string | null;
  products: PublicProductCard[];
} | null> {
  const col = await db.collection.findUnique({
    where: { catalog_slug: { catalog, slug } },
    include: {
      products: {
        orderBy: { position: "asc" },
        include: {
          product: { include: CARD_INCLUDE },
        },
      },
    },
  });
  // isInternal 404s here exactly like inactive/missing does — its slug is
  // never meant to resolve as a public collection page.
  if (!col || !col.isActive || col.isInternal) return null;
  return {
    slug: col.slug,
    name: col.name,
    description: col.description,
    products: col.products
      .map((pc) => pc.product)
      .filter((p) => p.status === "PUBLISHED" && p.publishedAt != null)
      .map(toPublicCard),
  };
}

/** Slugs of the two internal, non-deletable collections that drive the home
 * page rails — shared between the public read below and the admin service. */
export const HOME_RAIL_SLUG: Record<CatalogType, string> = {
  THE_POOJA_EDIT: "home-label",
  THRIFT: "home-closet",
};

/**
 * Home page rail (owner feedback, 2026-09-13, Part B) — the internal
 * catalog-scoped collection `home-label` / `home-closet` gives Pooja manual
 * control of the rail's order (`ProductCollection.position`) without her
 * ever seeing the word "collection". An empty or not-yet-created rail falls
 * back to today's behaviour: newest 12 published products in the catalogue.
 */
export async function getHomeRailProducts(
  db: PrismaClient,
  catalog: CatalogType,
): Promise<PublicProductCard[]> {
  const slug = HOME_RAIL_SLUG[catalog];
  const col = await db.collection.findUnique({
    where: { catalog_slug: { catalog, slug } },
    select: { id: true },
  });
  if (col) {
    const rows = await db.productCollection.findMany({
      where: {
        collectionId: col.id,
        product: { status: "PUBLISHED", publishedAt: { not: null } },
      },
      orderBy: { position: "asc" },
      take: 12,
      include: { product: { include: CARD_INCLUDE } },
    });
    if (rows.length > 0) return rows.map((r) => toPublicCard(r.product));
  }
  return (await listPublishedProducts(db, { catalog, sort: "newest", limit: 12 }))
    .items;
}
