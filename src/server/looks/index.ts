import "server-only";

import type { AdminUser, Look, Prisma, PrismaClient } from "@/generated/prisma";
import { productImageUrl, storagePublicUrl } from "@/lib/storage-url";
import { auditLog } from "@/server/admin/audit";
import { assertActiveAdmin } from "@/server/admin/guards";
import { ValidationError } from "@/server/catalog/admin";
import {
  toPublicDetail,
  type PublicImage,
  type PublicProductDetail,
} from "@/server/catalog/public-shape";
import { slugify } from "@/server/catalog/slug";

/**
 * Looks — "Shop this Reel" pages at /looks/<slug> (D-163). Each Look is an
 * ordered list of Pooja's own published Label / Closet pieces with a cover
 * and caption. Created as DRAFT; only PUBLISHED Looks are public, and only
 * their published products are shown.
 */

export const MAX_LOOK_ITEMS = 12;

const ITEM_PRODUCT_INCLUDE = {
  variants: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { sortPosition: "asc" } },
  thriftDetails: true,
  collections: { include: { collection: true } },
} satisfies Prisma.ProductInclude;

const isLive = (p: { status: string; publishedAt: Date | null }) =>
  p.status === "PUBLISHED" && p.publishedAt != null;

// ── Public ──────────────────────────────────────────────────────────────

export interface PublicLook {
  slug: string;
  title: string;
  caption: string | null;
  reelUrl: string | null;
  cover: PublicImage | null;
  status: Look["status"];
  publishedAt: Date | null;
  products: PublicProductDetail[];
}

function coverOf(look: Look, products: PublicProductDetail[]): PublicImage | null {
  if (look.coverPath || look.coverUrl) {
    const url =
      look.coverBucket && look.coverPath
        ? storagePublicUrl(look.coverBucket, look.coverPath, look.coverUrl ?? undefined)
        : (look.coverUrl ?? "");
    if (url) {
      return {
        url,
        alt: look.coverAlt || look.title,
        width: null,
        height: null,
        isPrimary: true,
      };
    }
  }
  const first = products.find((p) => p.images.length > 0);
  return first ? { ...first.images[0], alt: first.images[0].alt || look.title } : null;
}

/**
 * One Look by slug. Drafts resolve only with `includeDrafts` (an admin
 * previewing); products that are no longer published are left out.
 */
export async function getLookBySlug(
  db: PrismaClient,
  slug: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<PublicLook | null> {
  const look = await db.look.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { product: { include: ITEM_PRODUCT_INCLUDE } },
      },
    },
  });
  if (!look) return null;
  if (look.status !== "PUBLISHED" && !opts.includeDrafts) return null;
  const products = look.items
    .map((i) => i.product)
    .filter(isLive)
    .map(toPublicDetail);
  return {
    slug: look.slug,
    title: look.title,
    caption: look.caption,
    reelUrl: look.reelUrl,
    cover: coverOf(look, products),
    status: look.status,
    publishedAt: look.publishedAt,
    products,
  };
}

/** Published Looks, newest first, for /looks and the sitemap. */
export async function listPublishedLooks(db: PrismaClient) {
  const looks = await db.look.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { product: { include: ITEM_PRODUCT_INCLUDE } },
      },
    },
  });
  return looks.map((look) => {
    const products = look.items
      .map((i) => i.product)
      .filter(isLive)
      .map(toPublicDetail);
    return {
      slug: look.slug,
      title: look.title,
      updatedAt: look.updatedAt,
      cover: coverOf(look, products),
      pieceCount: products.length,
    };
  });
}

// ── Admin ───────────────────────────────────────────────────────────────

export function listLooksAdmin(db: PrismaClient) {
  return db.look.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
}

export function getLookAdmin(db: PrismaClient, id: string) {
  return db.look.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          product: {
            include: {
              images: { orderBy: { sortPosition: "asc" }, take: 1 },
              variants: true,
            },
          },
        },
      },
    },
  });
}

async function uniqueLookSlug(db: PrismaClient, title: string, exceptId?: string) {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; ; n++) {
    const taken = await db.look.findUnique({ where: { slug: candidate } });
    if (!taken || taken.id === exceptId) return candidate;
    candidate = `${base}-${n}`;
  }
}

export async function createLook(
  db: PrismaClient,
  admin: AdminUser | null,
  input: { title: string },
): Promise<Look> {
  assertActiveAdmin(admin);
  const title = input.title.trim();
  if (!title) throw new ValidationError("Give the Look a title.");
  const look = await db.look.create({
    data: { title: title.slice(0, 120), slug: await uniqueLookSlug(db, title) },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "look.create",
    entityType: "Look",
    entityId: look.id,
    after: { title: look.title, slug: look.slug },
  });
  return look;
}

const REEL_RE = /^https:\/\/(www\.)?instagram\.com\/[^\s]+$/i;

export interface LookDetailsInput {
  title: string;
  /** Typed web address part; blank keeps the current one. */
  slug: string;
  caption: string;
  reelUrl: string;
  coverAlt: string;
}

export async function updateLookDetails(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
  input: LookDetailsInput,
): Promise<Look> {
  assertActiveAdmin(admin);
  const errors: string[] = [];
  const title = input.title.trim();
  if (!title) errors.push("Give the Look a title.");
  const reelUrl = input.reelUrl.trim();
  if (reelUrl && !REEL_RE.test(reelUrl)) {
    errors.push("The Instagram link should start with https://www.instagram.com/");
  }
  const current = await db.look.findUniqueOrThrow({ where: { id } });
  let slug = current.slug;
  const wanted = slugify(input.slug.trim());
  if (input.slug.trim() && wanted !== current.slug) {
    const taken = await db.look.findUnique({ where: { slug: wanted } });
    if (taken && taken.id !== id) errors.push(`The address /looks/${wanted} is taken.`);
    else slug = wanted;
  }
  if (errors.length) throw new ValidationError(errors[0], errors);

  const after = await db.look.update({
    where: { id },
    data: {
      title: title.slice(0, 120),
      slug,
      caption: input.caption.trim().slice(0, 1000) || null,
      reelUrl: reelUrl || null,
      coverAlt: input.coverAlt.trim().slice(0, 150),
    },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "look.update",
    entityType: "Look",
    entityId: id,
    before: { title: current.title, slug: current.slug },
    after: { title: after.title, slug: after.slug },
  });
  return after;
}

export async function setLookCover(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
  cover: { bucket: string; path: string; url: string } | null,
): Promise<{ previous: { bucket: string | null; path: string | null } }> {
  assertActiveAdmin(admin);
  const current = await db.look.findUniqueOrThrow({ where: { id } });
  await db.look.update({
    where: { id },
    data: {
      coverBucket: cover?.bucket ?? null,
      coverPath: cover?.path ?? null,
      coverUrl: cover?.url ?? null,
    },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: cover ? "look.cover_uploaded" : "look.cover_removed",
    entityType: "Look",
    entityId: id,
  });
  return { previous: { bucket: current.coverBucket, path: current.coverPath } };
}

/** What still blocks publishing, in plain words. Empty = ready. */
export async function lookPublishProblems(db: PrismaClient, id: string) {
  const items = await db.lookItem.findMany({
    where: { lookId: id },
    include: { product: { select: { status: true, publishedAt: true } } },
  });
  return items.some((i) => isLive(i.product))
    ? []
    : ["Add at least one published piece."];
}

export async function setLookStatus(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
  publish: boolean,
): Promise<Look> {
  assertActiveAdmin(admin);
  if (publish) {
    const problems = await lookPublishProblems(db, id);
    if (problems.length) throw new ValidationError(problems[0], problems);
  }
  const current = await db.look.findUniqueOrThrow({ where: { id } });
  const look = await db.look.update({
    where: { id },
    data: publish
      ? { status: "PUBLISHED", publishedAt: current.publishedAt ?? new Date() }
      : { status: "DRAFT" },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: publish ? "look.publish" : "look.unpublish",
    entityType: "Look",
    entityId: id,
  });
  return look;
}

export async function deleteLook(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
): Promise<Look> {
  assertActiveAdmin(admin);
  const look = await db.look.delete({ where: { id } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "look.delete",
    entityType: "Look",
    entityId: id,
    before: { title: look.title, slug: look.slug },
  });
  return look;
}

export async function addLookItem(
  db: PrismaClient,
  admin: AdminUser | null,
  lookId: string,
  productId: string,
): Promise<void> {
  assertActiveAdmin(admin);
  const [count, last] = await Promise.all([
    db.lookItem.count({ where: { lookId } }),
    db.lookItem.findFirst({
      where: { lookId },
      orderBy: { position: "desc" },
      select: { position: true },
    }),
  ]);
  if (count >= MAX_LOOK_ITEMS) {
    throw new ValidationError(`A Look can hold up to ${MAX_LOOK_ITEMS} pieces.`);
  }
  await db.lookItem.upsert({
    where: { lookId_productId: { lookId, productId } },
    update: {},
    create: { lookId, productId, position: (last?.position ?? -1) + 1 },
  });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "look.add_item",
    entityType: "Look",
    entityId: lookId,
    after: { productId },
  });
}

export async function removeLookItem(
  db: PrismaClient,
  admin: AdminUser | null,
  lookId: string,
  productId: string,
): Promise<void> {
  assertActiveAdmin(admin);
  await db.lookItem.deleteMany({ where: { lookId, productId } });
  await auditLog(db, {
    adminUserId: admin.id,
    action: "look.remove_item",
    entityType: "Look",
    entityId: lookId,
    before: { productId },
  });
}

/** Swap one piece with its neighbour; positions are rewritten 0..n-1. */
export async function moveLookItem(
  db: PrismaClient,
  admin: AdminUser | null,
  lookId: string,
  productId: string,
  direction: "up" | "down",
): Promise<void> {
  assertActiveAdmin(admin);
  await db.$transaction(async (tx) => {
    const items = await tx.lookItem.findMany({
      where: { lookId },
      orderBy: { position: "asc" },
    });
    const i = items.findIndex((x) => x.productId === productId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    for (const [position, item] of items.entries()) {
      if (item.position !== position) {
        await tx.lookItem.update({ where: { id: item.id }, data: { position } });
      }
    }
  });
}

/** Published Label + Closet pieces matching `q`, not already in this Look. */
export async function searchProductsForLook(
  db: PrismaClient,
  lookId: string,
  q: string,
) {
  const query = q.trim();
  if (query.length < 2) return [];
  const existing = await db.lookItem.findMany({
    where: { lookId },
    select: { productId: true },
  });
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null },
      ...(existing.length ? { id: { notIn: existing.map((e) => e.productId) } } : {}),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { title: "asc" },
    take: 10,
    include: { images: { orderBy: { sortPosition: "asc" }, take: 1 } },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    catalog: p.catalog,
    image: p.images[0] ? productImageUrl(p.images[0]) : null,
  }));
}
