import { notFound } from "next/navigation";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { Pill, Thumb, money } from "@/features/admin/format";
import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { prisma } from "@/lib/db";
import { HOME_RAIL_SLUG } from "@/server/catalog/queries";
import { getCollectionAdmin } from "@/server/catalog/admin";
import { requireAdmin } from "@/server/auth/require-admin";

import {
  removeProductFromCollectionAction,
  reorderCollectionProductAction,
  updateCollectionAction,
} from "../actions";
import { AddProduct } from "./add-product";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const col = await getCollectionAdmin(prisma, id);
  return { title: col?.name ?? "Collection" };
}

export default async function AdminCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const col = await getCollectionAdmin(prisma, id);
  if (!col) notFound();

  const isHomeLabel = col.isInternal && col.slug === HOME_RAIL_SLUG.THE_POOJA_EDIT;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="text-xs text-ink-soft">
          {CATALOG_LABEL[col.catalog]}
          {col.isInternal ? " · Home page rail" : ""}
        </p>
        <h1 className="text-xl font-semibold text-ink-strong">{col.name}</h1>
      </div>

      {col.isInternal && (
        <p className="text-xs text-ink-soft">
          The first piece here with a photo becomes the large image at the top of
          the home page. Leave this empty to show the newest pieces automatically.
        </p>
      )}

      <ActionForm action={updateCollectionAction.bind(null, id)} submitLabel="Save">
        <Field label="Name" name="name" defaultValue={col.name} required maxLength={80} />
        <TextArea
          label="Description"
          name="description"
          defaultValue={col.description}
          mono={false}
          rows={2}
          hint="Not shown on the home page — only on this collection's own page, if it has one."
        />
        {!col.isInternal && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={col.isActive} />
            Active (visible as its own page on the storefront)
          </label>
        )}
      </ActionForm>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Products ({col.products.length})
        </h2>
        {col.products.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {isHomeLabel || col.isInternal
              ? "No products chosen — the home page shows its newest pieces automatically."
              : "No products in this collection yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {col.products.map((pc, i) => {
              const p = pc.product;
              const isVisible = p.status === "PUBLISHED" && p.publishedAt != null;
              const price = p.variants.length
                ? Math.min(...p.variants.map((v) => v.pricePaise))
                : null;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded border border-line p-2 ${!isVisible ? "opacity-50" : ""}`}
                >
                  <Thumb url={p.images[0]?.publicUrl ?? null} alt={p.images[0]?.altText ?? p.title} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-strong">{p.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Pill value={p.status} />
                      {price != null && <span className="text-xs text-ink-soft">{money(price)}</span>}
                    </div>
                    {!isVisible && (
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        Not shown on the site while it&rsquo;s {p.status.toLowerCase()}.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                    <div className="flex gap-1">
                      <ActionForm
                        action={reorderCollectionProductAction.bind(null, id)}
                        submitLabel="↑"
                        compact
                      >
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="direction" value="up" />
                      </ActionForm>
                      <ActionForm
                        action={reorderCollectionProductAction.bind(null, id)}
                        submitLabel="↓"
                        compact
                      >
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="direction" value="down" />
                      </ActionForm>
                    </div>
                    <span className="text-ink-soft">#{i + 1}</span>
                    <ActionForm
                      action={removeProductFromCollectionAction.bind(null, id)}
                      submitLabel="Remove"
                      compact
                    >
                      <input type="hidden" name="productId" value={p.id} />
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line pt-4">
          <AddProduct collectionId={id} catalog={col.catalog} />
        </div>
      </section>
    </div>
  );
}
