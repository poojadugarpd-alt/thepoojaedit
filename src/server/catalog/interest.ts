import "server-only";

import { z } from "zod";

import type { CatalogType, PrismaClient } from "@/generated/prisma";
import type { Utm } from "@/lib/attribution";

/**
 * "Notify me" sign-ups (D-178). A piece in notify-only mode shows an email box
 * instead of Add to cart; each address is kept once per piece, so a second
 * tap is harmless.
 */

export class InterestUnavailableError extends Error {
  constructor() {
    super("This piece isn't taking sign-ups right now.");
    this.name = "InterestUnavailableError";
  }
}

export const InterestEmailSchema = z
  .string()
  .trim()
  .max(200)
  .email("Please check your email address.");

export async function registerInterest(
  db: PrismaClient,
  input: { catalog: CatalogType; slug: string; email: string; utm?: Utm | null },
): Promise<{ productTitle: string }> {
  const email = InterestEmailSchema.parse(input.email).toLowerCase();
  const product = await db.product.findUnique({
    where: { catalog_slug: { catalog: input.catalog, slug: input.slug } },
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      notifyOnly: true,
    },
  });
  if (
    !product ||
    product.status !== "PUBLISHED" ||
    product.publishedAt == null ||
    !product.notifyOnly
  ) {
    throw new InterestUnavailableError();
  }
  await db.productInterest.upsert({
    where: { productId_email: { productId: product.id, email } },
    create: {
      productId: product.id,
      email,
      utmSource: input.utm?.source ?? null,
      utmMedium: input.utm?.medium ?? null,
      utmCampaign: input.utm?.campaign ?? null,
    },
    update: {},
  });
  return { productTitle: product.title };
}

/** Everyone waiting for a piece, newest first (Admin → product). */
export function listInterest(db: PrismaClient, productId: string) {
  return db.productInterest.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    select: { email: true, createdAt: true, utmSource: true },
  });
}

/** Sign-up counts per product, for the admin product list. */
export async function interestCounts(db: PrismaClient): Promise<Map<string, number>> {
  const rows = await db.productInterest.groupBy({
    by: ["productId"],
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.productId, r._count._all]));
}
