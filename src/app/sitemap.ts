import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import { publicEnv } from "@/lib/public-env";
import { deriveAvailability } from "@/server/catalog/public-shape";
import { guides } from "@/features/styling/guides";
import { getStylingContent } from "@/server/styling/content";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const u = (path: string) => `${base}${path}`;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "weekly", priority: 1 },
    {
      url: u(`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: u(`/${SEGMENT_BY_CATALOG.THRIFT}`),
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: u("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: u("/contact"), changeFrequency: "monthly", priority: 0.4 },
    { url: u("/size-guide"), changeFrequency: "monthly", priority: 0.3 },
    { url: u("/policies/shipping"), changeFrequency: "monthly", priority: 0.3 },
    {
      url: u("/policies/returns-exchanges"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    { url: u("/policies/privacy"), changeFrequency: "monthly", priority: 0.3 },
    { url: u("/policies/terms"), changeFrequency: "monthly", priority: 0.3 },
  ];

  // A cold database (e.g. a first deploy before Supabase is wired) must not fail
  // the build — fall back to the static entries only. This is a try/catch rather
  // than `.catch()` because a missing DATABASE_URL throws synchronously the first
  // time the Prisma client is touched.
  let products: {
    catalog: keyof typeof SEGMENT_BY_CATALOG;
    slug: string;
    updatedAt: Date;
    markedSoldOut: boolean;
    variants: { onHandQty: number; reservedQty: number; isActive: boolean }[];
    thriftDetails: { isOneOfOne: boolean } | null;
  }[] = [];
  let collections: {
    catalog: keyof typeof SEGMENT_BY_CATALOG;
    slug: string;
    updatedAt: Date;
  }[] = [];
  try {
    [products, collections] = await Promise.all([
      prisma.product.findMany({
        where: { status: "PUBLISHED", publishedAt: { not: null } },
        select: {
          catalog: true,
          slug: true,
          updatedAt: true,
          markedSoldOut: true,
          variants: { select: { onHandQty: true, reservedQty: true, isActive: true } },
          thriftDetails: { select: { isOneOfOne: true } },
        },
      }),
      prisma.collection.findMany({
        // isInternal collections (the home-page rails) are not a public page —
        // owner feedback, 2026-09-13, Part B2.
        where: { isActive: true, isInternal: false },
        select: { catalog: true, slug: true, updatedAt: true },
      }),
    ]);
  } catch {
    // keep the static entries only
  }

  // A sold Closet piece redirects to /closet, so it has no place here.
  const listed = products.filter(
    (p) =>
      !(
        p.catalog === "THRIFT" &&
        deriveAvailability(
          p.catalog,
          p.thriftDetails?.isOneOfOne ?? false,
          p.variants,
          p.markedSoldOut,
        ) === "SOLD"
      ),
  );

  const productEntries: MetadataRoute.Sitemap = listed.map((p) => ({
    url: u(`/${SEGMENT_BY_CATALOG[p.catalog]}/${p.slug}`),
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url: u(`/${SEGMENT_BY_CATALOG[c.catalog]}/collections/${c.slug}`),
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // Listed only once Pooja publishes it (D-162); otherwise it's a 404.
  let stylingPublished = false;
  try {
    stylingPublished = (await getStylingContent(prisma)).published;
  } catch {
    // a cold database just leaves it out
  }
  const stylingEntries: MetadataRoute.Sitemap = stylingPublished
    ? [
        { url: u("/styling"), changeFrequency: "monthly", priority: 0.6 },
        ...guides.map((g) => ({
          url: u(`/styling/${g.slug}`),
          changeFrequency: "monthly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  return [...staticEntries, ...stylingEntries, ...productEntries, ...collectionEntries];
}
