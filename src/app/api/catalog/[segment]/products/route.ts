import { NextResponse, type NextRequest } from "next/server";

import { catalogFromSegment, listProducts, type ProductSort } from "@/server/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segment: string }> },
) {
  const { segment } = await params;
  const catalog = catalogFromSegment(segment);
  if (!catalog) return NextResponse.json({ error: "Unknown catalog" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const sortParam = sp.get("sort");
  const sort = SORTS.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : "newest";
  const limit = Number(sp.get("limit")) || undefined;

  const page = await listProducts({
    catalog,
    cursor: sp.get("cursor"),
    sort,
    limit,
    categorySlug: sp.get("category") ?? undefined,
  });

  return NextResponse.json(page, {
    headers: {
      // Public catalog reads are cacheable with deliberate revalidation
      // (master §4). Kept short here; product/stock mutations bust it in admin.
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
