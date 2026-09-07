import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { prisma } from "@/lib/db";
import { CATALOG_LABEL, productPath } from "@/lib/catalog-routes";
import { getAdminProduct, validateForPublication } from "@/server/catalog/admin";

import {
  deleteImageAction,
  setPrimaryImageAction,
  statusAction,
  thriftDetailsAction,
  updateProductAction,
  upsertVariantAction,
} from "../actions";

const CONDITIONS = ["NEW_WITH_TAGS", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { title: true } });
  return { title: p ? `Edit — ${p.title}` : "Product" };
}

export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getAdminProduct(prisma, id);
  if (!p) notFound();

  const isThrift = p.catalog === "THRIFT";
  const check = validateForPublication(p);

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <Link
          href="/admin/products"
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← All products
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{p.title}</h1>
        <p className="text-sm text-black/55 dark:text-white/55">
          {CATALOG_LABEL[p.catalog]} · {p.slug} ·{" "}
          <span
            className={
              p.status === "PUBLISHED" ? "text-emerald-700 dark:text-emerald-400" : ""
            }
          >
            {p.status}
          </span>
          {p.status === "PUBLISHED" && (
            <>
              {" · "}
              <Link
                href={productPath(p.catalog, p.slug)}
                className="underline"
                target="_blank"
              >
                view on storefront
              </Link>
            </>
          )}
        </p>
      </header>

      {/* ── Publication ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">Publication</h2>
        <ul className="mt-2 text-sm">
          {check.errors.length === 0 ? (
            <li className="text-emerald-700 dark:text-emerald-400">
              Ready to publish.
            </li>
          ) : (
            check.errors.map((e, i) => (
              <li key={i} className="text-rose-600">
                • {e}
              </li>
            ))
          )}
        </ul>
        <div className="mt-3 flex gap-3">
          {p.status !== "PUBLISHED" && (
            <ActionForm
              action={statusAction.bind(null, id, "PUBLISH")}
              submitLabel="Publish"
              compact
            >
              <span />
            </ActionForm>
          )}
          {p.status === "PUBLISHED" && (
            <ActionForm
              action={statusAction.bind(null, id, "DRAFT")}
              submitLabel="Unpublish"
              compact
            >
              <input type="hidden" name="reason" value="admin unpublish" />
            </ActionForm>
          )}
          {p.status !== "ARCHIVED" && (
            <ActionForm
              action={statusAction.bind(null, id, "ARCHIVE")}
              submitLabel="Archive"
              compact
            >
              <input type="hidden" name="reason" value="admin archive" />
            </ActionForm>
          )}
        </div>
      </section>

      {/* ── Core fields ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">Details</h2>
        <div className="mt-3">
          <ActionForm
            action={updateProductAction.bind(null, id)}
            submitLabel="Save details"
          >
            <Field label="Slug" name="slug" defaultValue={p.slug} required />
            <Field label="Title" name="title" defaultValue={p.title} required />
            <TextArea
              label="Description"
              name="description"
              defaultValue={p.description}
              rows={5}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand" name="brand" defaultValue={p.brand} />
              <Field label="HSN code" name="hsnCode" defaultValue={p.hsnCode} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SEO title" name="metaTitle" defaultValue={p.metaTitle} />
              <Field
                label="SEO description"
                name="metaDescription"
                defaultValue={p.metaDescription}
              />
            </div>
            <Field label="Reason (audit)" name="reason" placeholder="why this change" />
          </ActionForm>
        </div>
      </section>

      {/* ── Variants ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Variants ({p.variants.length})
        </h2>
        <div className="mt-3 space-y-4">
          {p.variants.map((v) => (
            <ActionForm
              key={v.id}
              action={upsertVariantAction.bind(null, id)}
              submitLabel="Update variant"
              className="rounded border border-black/10 p-3 dark:border-white/15"
              compact
            >
              <input type="hidden" name="id" value={v.id} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="SKU" name="sku" defaultValue={v.sku} required />
                <Field label="Size" name="size" defaultValue={v.size} />
                <Field label="Color" name="color" defaultValue={v.color} />
                <Field
                  label="Price (paise)"
                  name="pricePaise"
                  type="number"
                  defaultValue={v.pricePaise}
                  required
                />
                <Field
                  label="Compare-at (paise)"
                  name="compareAtPaise"
                  type="number"
                  defaultValue={v.compareAtPaise}
                />
                <Field
                  label="On hand"
                  name="onHandQty"
                  type="number"
                  defaultValue={v.onHandQty}
                />
                <Field
                  label="Low-stock at"
                  name="lowStockThreshold"
                  type="number"
                  defaultValue={v.lowStockThreshold}
                />
                <label className="flex items-end gap-1 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked={v.isActive} />{" "}
                  active
                </label>
              </div>
            </ActionForm>
          ))}

          {!(isThrift && p.thriftDetails?.isOneOfOne && p.variants.length >= 1) && (
            <ActionForm
              action={upsertVariantAction.bind(null, id)}
              submitLabel="Add variant"
              className="rounded border border-dashed border-black/20 p-3 dark:border-white/25"
              compact
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="SKU" name="sku" required />
                <Field label="Size" name="size" />
                <Field label="Color" name="color" />
                <Field label="Price (paise)" name="pricePaise" type="number" required />
                <Field label="Compare-at (paise)" name="compareAtPaise" type="number" />
                <Field label="On hand" name="onHandQty" type="number" />
                <label className="flex items-end gap-1 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked /> active
                </label>
              </div>
            </ActionForm>
          )}
        </div>
      </section>

      {/* ── Images ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Images ({p.images.length})
        </h2>
        <p className="mt-1 text-xs text-black/45 dark:text-white/45">
          Signed uploads need Supabase Storage (Phase 3 deferred). Existing images are
          from the legacy import.
        </p>
        <ul className="mt-3 flex flex-wrap gap-3">
          {p.images.map((im) => (
            <li key={im.id} className="w-28">
              <div className="relative h-36 w-28 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                {im.publicUrl && (
                  <Image
                    src={im.publicUrl}
                    alt={im.altText}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                )}
                {im.isPrimary && (
                  <span className="absolute left-1 top-1 rounded bg-foreground px-1 text-[10px] text-background">
                    primary
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-2 text-[11px]">
                {!im.isPrimary && (
                  <ActionForm
                    action={setPrimaryImageAction.bind(null, id)}
                    submitLabel="Primary"
                    compact
                  >
                    <input type="hidden" name="imageId" value={im.id} />
                  </ActionForm>
                )}
                <ActionForm
                  action={deleteImageAction.bind(null, id)}
                  submitLabel="Delete"
                  compact
                >
                  <input type="hidden" name="imageId" value={im.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Thrift details ── */}
      {isThrift && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Thrift details
          </h2>
          <div className="mt-3">
            <ActionForm
              action={thriftDetailsAction.bind(null, id)}
              submitLabel="Save thrift details"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="f-conditionGrade"
                    className="block text-xs font-medium"
                  >
                    Condition grade *
                  </label>
                  <select
                    id="f-conditionGrade"
                    name="conditionGrade"
                    defaultValue={p.thriftDetails?.conditionGrade ?? "GOOD"}
                    className="mt-1 w-full rounded border border-black/20 bg-transparent px-2 py-1.5 text-sm dark:border-white/25"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-end gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="isOneOfOne"
                    defaultChecked={p.thriftDetails?.isOneOfOne ?? true}
                  />
                  one of one
                </label>
              </div>
              <Field
                label="Condition notes"
                name="conditionNotes"
                defaultValue={p.thriftDetails?.conditionNotes}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Original brand"
                  name="originalBrand"
                  defaultValue={p.thriftDetails?.originalBrand}
                />
                <Field
                  label="Fabric"
                  name="fabric"
                  defaultValue={p.thriftDetails?.fabric}
                />
                <Field
                  label="Labelled size"
                  name="labelledSize"
                  defaultValue={p.thriftDetails?.labelledSize}
                />
                <Field
                  label="Recommended fit"
                  name="recommendedFit"
                  defaultValue={p.thriftDetails?.recommendedFit}
                />
                <Field
                  label="Alterations"
                  name="alterations"
                  defaultValue={p.thriftDetails?.alterations}
                />
                <Field
                  label="Acquisition cost (paise, admin-only)"
                  name="acquisitionCostPaise"
                  type="number"
                  defaultValue={p.thriftDetails?.acquisitionCostPaise}
                />
              </div>
              <Field
                label="Authenticity notes"
                name="authenticityNotes"
                defaultValue={p.thriftDetails?.authenticityNotes}
              />
              <Field
                label="Care notes"
                name="careNotes"
                defaultValue={p.thriftDetails?.careNotes}
              />
              <TextArea
                label='Measurements (JSON, e.g. {"bust":{"value":"34","unit":"in"}})'
                name="measurementsJson"
                defaultValue={JSON.stringify(
                  p.thriftDetails?.measurements ?? {},
                  null,
                  2,
                )}
                rows={6}
              />
            </ActionForm>
          </div>
        </section>
      )}

      {/* ── Collections ── */}
      {p.collections.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Collections</h2>
          <ul className="mt-2 text-sm text-black/60 dark:text-white/60">
            {p.collections.map((pc) => (
              <li key={pc.collectionId}>
                {pc.collection.name} {pc.collection.isActive ? "" : "(inactive)"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
