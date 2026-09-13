import Link from "next/link";

import { ActionForm, Field } from "@/features/admin/action-form";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { prisma } from "@/lib/db";
import { ensureHomeCollections, listCollectionsAdmin } from "@/server/catalog/admin";
import { requireAdmin } from "@/server/auth/require-admin";

import { createCollectionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collections" };

export default async function AdminCollectionsPage() {
  const admin = await requireAdmin();
  // Idempotent — guarantees the two home-rail rows exist even on a database
  // that has never had /admin/collections opened before (Part B2/B3).
  await ensureHomeCollections(prisma, admin);
  const collections = await listCollectionsAdmin(prisma);

  const internal = collections.filter((c) => c.isInternal);
  const normal = collections.filter((c) => !c.isInternal);
  const byCatalog = {
    THE_POOJA_EDIT: normal.filter((c) => c.catalog === "THE_POOJA_EDIT"),
    THRIFT: normal.filter((c) => c.catalog === "THRIFT"),
  };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-ink-strong">Collections</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Home page rails
        </h2>
        <p className="text-xs text-ink-soft">
          The order here is the order shoppers see on the home page. Leave a rail
          empty to show the newest pieces automatically.
        </p>
        <ul className="divide-y divide-line rounded-[10px] border border-line">
          {internal.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/collections/${c.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  <span className="block text-sm font-medium text-ink-strong">
                    {c.name}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {CATALOG_LABEL[c.catalog]} · {c.productCount}{" "}
                    {c.productCount === 1 ? "product" : "products"}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-soft">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {(["THE_POOJA_EDIT", "THRIFT"] as const).map((catalog) => (
        <section key={catalog} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            {CATALOG_LABEL[catalog]}
          </h2>
          {byCatalog[catalog].length > 0 ? (
            <ul className="divide-y divide-line rounded-[10px] border border-line">
              {byCatalog[catalog].map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/collections/${c.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink-strong">
                        {c.name}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {c.productCount} {c.productCount === 1 ? "product" : "products"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${c.isActive ? "text-ok" : "text-ink-soft"}`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                      <span aria-hidden="true" className="text-ink-soft">
                        ›
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No collections yet.</p>
          )}
        </section>
      ))}

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Create collection
        </h2>
        <ActionForm action={createCollectionAction} submitLabel="Create" className="max-w-sm">
          <div>
            <label htmlFor="f-catalog" className="block text-xs font-medium">
              Catalogue
            </label>
            <select
              id="f-catalog"
              name="catalog"
              required
              className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
            >
              <option value="THE_POOJA_EDIT">{CATALOG_LABEL.THE_POOJA_EDIT}</option>
              <option value="THRIFT">{CATALOG_LABEL.THRIFT}</option>
            </select>
          </div>
          <Field label="Name" name="name" required maxLength={80} />
        </ActionForm>
      </section>
    </div>
  );
}
