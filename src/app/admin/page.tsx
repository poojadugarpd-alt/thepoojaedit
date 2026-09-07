import Link from "next/link";

import { prisma } from "@/lib/db";
import { CATALOG_LABEL, type CatalogType } from "@/lib/catalog-routes";
import { adminOverviewCounts } from "@/server/catalog/admin";

export default async function AdminOverview() {
  const { byCatStatus, images, drafts } = await adminOverviewCounts(prisma);

  const cell = (catalog: CatalogType, status: string) =>
    byCatStatus.find((r) => r.catalog === catalog && r.status === status)?._count ?? 0;

  const catalogs: CatalogType[] = ["THE_POOJA_EDIT", "THRIFT"];

  return (
    <div>
      <h1 className="text-xl font-semibold">Overview</h1>

      <table className="mt-6 w-full max-w-lg text-sm">
        <thead>
          <tr className="border-b border-black/15 text-left dark:border-white/20">
            <th className="py-2 font-medium">Catalogue</th>
            <th className="py-2 font-medium">Draft</th>
            <th className="py-2 font-medium">Published</th>
            <th className="py-2 font-medium">Archived</th>
          </tr>
        </thead>
        <tbody>
          {catalogs.map((c) => (
            <tr key={c} className="border-b border-black/10 dark:border-white/10">
              <td className="py-2">
                <Link href={`/admin/products?catalog=${c}`} className="hover:underline">
                  {CATALOG_LABEL[c]}
                </Link>
              </td>
              <td className="py-2">{cell(c, "DRAFT")}</td>
              <td className="py-2">{cell(c, "PUBLISHED")}</td>
              <td className="py-2">{cell(c, "ARCHIVED")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex gap-6 text-sm text-black/60 dark:text-white/60">
        <span>{images} images</span>
        <span>
          <Link href="/admin/products?status=DRAFT" className="hover:underline">
            {drafts} drafts to review
          </Link>
        </span>
      </div>

      <p className="mt-8 text-xs text-black/45 dark:text-white/45">
        Needs-Attention queue, orders, inventory ledger and analytics arrive in Phase
        11. This is the Phase 4 catalogue admin.
      </p>
    </div>
  );
}
