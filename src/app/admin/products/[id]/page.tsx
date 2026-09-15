import { cache } from "react";

import { notFound } from "next/navigation";

import { ProductEditor } from "@/features/admin/product-editor/product-editor";
import { prisma } from "@/lib/db";
import { timed } from "@/lib/perf";
import { getAdminProduct, validateForPublication } from "@/server/catalog/admin";
import { HOME_RAIL_SLUG } from "@/server/catalog/queries";

// React's per-request cache: `generateMetadata` and the page component both
// need this product, and Next.js runs them concurrently (not one waiting on
// the other) — but each independently calling getAdminProduct was a genuine
// duplicate round trip (measured: two near-identical queries, one just for
// the title). `cache()` makes the second caller reuse the first call's
// in-flight promise instead of issuing its own query, whichever runs first.
const getAdminProductCached = cache((id: string) => getAdminProduct(prisma, id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await timed("admin:product-edit (generateMetadata, cached)", () =>
    getAdminProductCached(id),
  );
  return { title: p ? `Edit — ${p.title}` : "Product" };
}

export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await timed("admin:product-edit (main, cached)", () =>
    getAdminProductCached(id),
  );
  if (!p) notFound();
  const check = validateForPublication(p);

  return (
    <ProductEditor
      initial={p}
      initialCatalog={p.catalog}
      homeRailSlug={HOME_RAIL_SLUG[p.catalog]}
      initialCheck={check}
    />
  );
}
