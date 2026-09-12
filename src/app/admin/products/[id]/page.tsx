import { cache } from "react";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { DeleteProductConfirm } from "@/features/admin/delete-product-confirm";
import { ImageUploader } from "@/features/admin/image-uploader";
import { LabelSkuFields } from "@/features/admin/label-sku-fields";
import { Pill } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { CATALOG_LABEL, productPath } from "@/lib/catalog-routes";
import { timed } from "@/lib/perf";
import { publicEnv } from "@/lib/public-env";
import { getAdminProduct, validateForPublication } from "@/server/catalog/admin";

import {
  deleteImageAction,
  deleteProductAction,
  reorderImageAction,
  setPrimaryImageAction,
  statusAction,
  thriftDetailsAction,
  updateProductAction,
  upsertVariantAction,
} from "../actions";

const CONDITIONS = ["NEW_WITH_TAGS", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"];

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
  const p = await timed("admin:product-edit (main, cached)", () => getAdminProductCached(id));
  if (!p) notFound();

  const isThrift = p.catalog === "THRIFT";
  const check = validateForPublication(p);
  const publicSiteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <Link href="/admin/products" className="text-xs text-ink-soft hover:underline">
          ← All products
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink-strong">{p.title}</h1>
          <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-soft">
            {isThrift ? "Closet" : "Label"}
          </span>
        </div>
        <p className="text-sm text-ink-soft">
          {CATALOG_LABEL[p.catalog]} · {p.slug} · <Pill value={p.status} />
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Publication
        </h2>
        <ul className="mt-2 text-sm">
          {check.errors.length === 0 ? (
            <li className="text-ok">Ready to publish.</li>
          ) : (
            check.errors.map((e, i) => (
              <li key={i} className="text-stop">
                • {e}
              </li>
            ))
          )}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
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
            // "Hide from shop" in the interface (owner feedback, 2026-09-13)
            // — the ARCHIVED status underneath, action name and audit log
            // entry are unchanged, this is a label-only rename.
            <ActionForm
              action={statusAction.bind(null, id, "ARCHIVE")}
              submitLabel="Hide from shop"
              compact
            >
              <input type="hidden" name="reason" value="admin archive" />
            </ActionForm>
          )}
        </div>
      </section>

      {/* ── Core fields ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Details
        </h2>
        <div className="mt-3">
          <ActionForm
            action={updateProductAction.bind(null, id)}
            submitLabel="Save details"
          >
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

            {/* Collapsed by default — the slug is an implementation detail
                of the URL, not something to surface next to Title (owner
                feedback, 2026-09-13: "what is a slug?"). Still part of this
                same form/save action, so saving Details never has to choose
                between updating this and everything else. */}
            <details className="rounded border border-line p-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-strong">
                Advanced: Web address
              </summary>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-ink-soft">
                  Currently:{" "}
                  <span className="font-mono">
                    {publicSiteUrl}
                    {productPath(p.catalog, p.slug)}
                  </span>
                </p>
                <Field label="Web address (slug)" name="slug" defaultValue={p.slug} required />
                <p className="text-xs text-stop">
                  Changing this breaks any link to this product already shared —
                  only change it if you know that&rsquo;s what you want.
                </p>
              </div>
            </details>

            <Field label="Reason (audit)" name="reason" placeholder="why this change" />
          </ActionForm>
        </div>
      </section>

      {/* ── Variants ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Variants ({p.variants.length})
        </h2>
        <div className="mt-3 space-y-4">
          {p.variants.map((v) => (
            <ActionForm
              key={v.id}
              action={upsertVariantAction.bind(null, id)}
              submitLabel="Update variant"
              className="rounded border border-line p-3"
              compact
            >
              <input type="hidden" name="id" value={v.id} />
              {/* Closet SKUs are auto-generated and stable — shown, not
                  editable, and never submitted (no `name`, so upsertVariant
                  sees it as omitted and keeps the existing value). Label
                  SKUs stay a real, required, editable field. */}
              {isThrift ? (
                <p className="text-xs text-ink-soft sm:col-span-4">
                  SKU <span className="font-mono text-ink">{v.sku}</span>
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {!isThrift && <Field label="SKU" name="sku" defaultValue={v.sku} required />}
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
                <label className="flex min-h-11 items-center gap-1 text-xs">
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
              className="rounded border border-dashed border-line p-3"
              compact
            >
              {isThrift && (
                <p className="text-xs text-ink-soft">
                  SKU is generated automatically once you save (e.g. CLO-000123).
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {isThrift ? (
                  <Field label="Size" name="size" />
                ) : (
                  <LabelSkuFields productTitle={p.title} />
                )}
                <Field label="Color" name="color" />
                <Field label="Price (paise)" name="pricePaise" type="number" required />
                <Field label="Compare-at (paise)" name="compareAtPaise" type="number" />
                <Field label="On hand" name="onHandQty" type="number" />
                <label className="flex min-h-11 items-center gap-1 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked /> active
                </label>
              </div>
            </ActionForm>
          )}
        </div>
      </section>

      {/* ── Images ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Images ({p.images.length})
        </h2>

        <ImageUploader
          productId={id}
          isThrift={isThrift}
          defaultAltPrefix={p.title}
          hasExistingImages={p.images.length > 0}
        />

        <ul className="flex flex-wrap gap-3">
          {p.images.map((im, i) => (
            <li key={im.id} className="w-32">
              <div className="relative h-40 w-32 overflow-hidden rounded bg-line/40">
                {im.publicUrl && (
                  <Image
                    src={im.publicUrl}
                    alt={im.altText}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                )}
                {im.isPrimary && (
                  <span className="absolute left-1 top-1 rounded bg-foreground px-1 text-[10px] text-background">
                    primary
                  </span>
                )}
                {im.type === "FLAW" && (
                  <span className="absolute right-1 top-1 rounded bg-wait-bg px-1 text-[10px] text-wait">
                    flaw
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <ActionForm action={reorderImageAction.bind(null, id)} submitLabel="↑" compact>
                  <input type="hidden" name="imageId" value={im.id} />
                  <input type="hidden" name="direction" value="up" />
                </ActionForm>
                <ActionForm action={reorderImageAction.bind(null, id)} submitLabel="↓" compact>
                  <input type="hidden" name="imageId" value={im.id} />
                  <input type="hidden" name="direction" value="down" />
                </ActionForm>
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
              <p className="mt-0.5 truncate text-[11px] text-ink-soft" title={im.altText}>
                {i + 1}. {im.altText}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Thrift details ── */}
      {isThrift && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
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
                    className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex min-h-11 items-end gap-2 text-xs">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            Collections
          </h2>
          <ul className="mt-2 text-sm text-ink-soft">
            {p.collections.map((pc) => (
              <li key={pc.collectionId}>
                {pc.collection.name} {pc.collection.isActive ? "" : "(inactive)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Delete — bottom of the screen, destructive styling, never in the
          list rows where it could be tapped by accident (owner feedback,
          2026-09-13). Only ever offered here; deleteProductAction itself
          re-enforces the "never on past orders" rule server-side regardless
          of what this page renders. */}
      <section className="border-t border-line pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stop">
          Delete
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Only possible if this product has never appeared on an order. If it has,
          use &ldquo;Hide from shop&rdquo; above instead.
        </p>
        <div className="mt-3">
          <DeleteProductConfirm
            productTitle={p.title}
            deleteAction={deleteProductAction.bind(null, id)}
          />
        </div>
      </section>
    </div>
  );
}
