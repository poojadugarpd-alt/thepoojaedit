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

export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface ProductPage {
  items: PublicProductCard[];
  nextCursor: string | null;
}

function encodeCursor(publishedAt: Date, id: string): string {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { publishedAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const d = new Date(iso);
    if (!id || Number.isNaN(d.getTime())) return null;
    return { publishedAt: d, id };
  } catch {
    return null;
  }
}

/** Paginated published products in one catalog. Deterministic keyset cursor. */
export async function listPublishedProducts(
  db: PrismaClient,
  opts: {
    catalog: CatalogType;
    limit?: number;
    cursor?: string | null;
    sort?: ProductSort;
    categorySlug?: string;
  },
): Promise<ProductPage> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
  const sort = opts.sort ?? "newest";

  const where: Prisma.ProductWhereInput = {
    catalog: opts.catalog,
    status: "PUBLISHED",
    publishedAt: { not: null },
    ...(opts.categorySlug
      ? { category: { slug: opts.categorySlug, catalog: opts.catalog } }
      : {}),
  };

  // Keyset pagination is only well-defined for the stable (publishedAt,id) order.
  // For price sorts we fall back to offset-free "first page large" until a
  // price-keyset is needed (Phase 11 analytics scale).
  if (sort === "newest") {
    const cur = opts.cursor ? decodeCursor(opts.cursor) : null;
    if (cur) {
      where.OR = [
        { publishedAt: { lt: cur.publishedAt } },
        { publishedAt: cur.publishedAt, id: { lt: cur.id } },
      ];
    }
    const rows = await db.product.findMany({
      where,
      include: CARD_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toPublicCard),
      nextCursor:
        hasMore && last?.publishedAt ? encodeCursor(last.publishedAt, last.id) : null,
    };
  }

  const rows = await db.product.findMany({
    where,
    include: CARD_INCLUDE,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE_MAX,
  });
  const cards = rows.map(toPublicCard);
  cards.sort((a, b) =>
    sort === "price_asc"
      ? (a.fromPricePaise ?? Infinity) - (b.fromPricePaise ?? Infinity)
      : (b.fromPricePaise ?? -Infinity) - (a.fromPricePaise ?? -Infinity),
  );
  return { items: cards, nextCursor: null };
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
  const rows = await db.collection.findMany({
    where: { catalog, isActive: true },
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
  if (!col || !col.isActive) return null;
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
