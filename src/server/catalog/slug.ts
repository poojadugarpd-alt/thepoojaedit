import "server-only";

import type { CatalogType, PrismaClient } from "@/generated/prisma";

/**
 * Slug generation (owner feedback, 2026-09-13 — "what is a slug?"). A slug is
 * an implementation detail of the URL, not something the owner should ever
 * have to type or understand; this module is the one place that turns a
 * human title into one, so `createProduct`/the new-product form/anywhere
 * else all derive it the same way.
 */

/** Lowercase, hyphenated, ASCII-only. Never returns "" — falls back to "product". */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (é -> e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "product";
}

/**
 * `slugify(title)`, then `-2`, `-3`, … on collision within the catalogue —
 * matching the `Product_catalog_slug_key` unique constraint exactly, so a
 * caller can create straight away without a separate existence check racing
 * against this one (the `create` still enforces uniqueness at the DB level
 * as the real guard; this just picks a value very unlikely to collide).
 */
export async function generateUniqueSlug(
  db: PrismaClient,
  catalog: CatalogType,
  title: string,
): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  // A product catalogue is small (tens to low hundreds of items) — a loop of
  // sequential existence checks is simple and correct; this is not a hot
  // path (product creation is a rare, admin-only action).
  while (await db.product.findUnique({ where: { catalog_slug: { catalog, slug: candidate } } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
