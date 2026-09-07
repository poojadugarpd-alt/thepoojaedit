import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import { publicEnv } from "@/lib/public-env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const u = (path: string) => `${base}${path}`;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "weekly", priority: 1 },
    { url: u("/the-pooja-edit"), changeFrequency: "daily", priority: 0.9 },
    { url: u("/thrift"), changeFrequency: "daily", priority: 0.9 },
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

  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      select: { catalog: true, slug: true, updatedAt: true },
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      select: { catalog: true, slug: true, updatedAt: true },
    }),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
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

  return [...staticEntries, ...productEntries, ...collectionEntries];
}
