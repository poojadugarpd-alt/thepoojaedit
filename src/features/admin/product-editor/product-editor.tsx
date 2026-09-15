"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CatalogType, ConditionGrade } from "@/generated/prisma";
import type { getAdminProduct } from "@/server/catalog/admin";

import { ActionForm } from "@/features/admin/action-form";
import { DeleteProductConfirm } from "@/features/admin/delete-product-confirm";
import { ImageUploader } from "@/features/admin/image-uploader";
import { Pill } from "@/features/admin/format";
import { productPath } from "@/lib/catalog-routes";
import { publicEnv } from "@/lib/public-env";
import {
  createFullProductAction,
  deleteImageAction,
  deleteProductAction,
  reorderImageAction,
  setPrimaryImageAction,
  statusAction,
  thriftDetailsAction,
  toggleFeatureOnHomeAction,
  updateProductAction,
  upsertVariantAction,
  type VariantInput,
} from "@/app/admin/products/actions";

import { SelectInput, TextAreaInput, TextInput } from "./controlled-fields";
import { SeoPreview } from "./seo-preview";
import { TagInput } from "./tag-input";
import { VariantMatrix, variantsToMatrixState, type VariantRow } from "./variant-matrix";

export type AdminProductData = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

const CONDITIONS: ConditionGrade[] = ["NEW_WITH_TAGS", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"];
const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Active" },
  { value: "ARCHIVED", label: "Hidden from shop" },
];

function rowToVariantInput(row: VariantRow): VariantInput {
  return {
    id: row.id,
    sku: row.sku || undefined,
    size: row.size || null,
    color: row.color || null,
    price: row.price,
    compareAt: row.compareAt || null,
    onHandQty: row.onHandQty ? Number(row.onHandQty) : 0,
    lowStockThreshold: row.lowStockThreshold ? Number(row.lowStockThreshold) : 0,
    isActive: row.isActive,
  };
}

export function ProductEditor({
  initial,
  initialCatalog,
  homeRailSlug,
  initialCheck,
}: {
  /** Null when this is a brand-new, not-yet-saved product. */
  initial: AdminProductData | null;
  /** Only meaningful when `initial` is null — the catalogue the "which
   *  catalogue" chooser starts on. */
  initialCatalog: CatalogType;
  /** `HOME_RAIL_SLUG[catalog]`, computed server-side (queries.ts is
   *  server-only and can't be imported here). Only used once saved. */
  homeRailSlug?: string;
  /** `validateForPublication`'s result, computed server-side (admin.ts is
   *  server-only) — a snapshot as of the last load/refresh, only shown
   *  once saved. */
  initialCheck?: { ok: boolean; errors: string[] } | null;
}) {
  const router = useRouter();

  const [productId, setProductId] = useState<string | null>(initial?.id ?? null);
  const [catalog, setCatalog] = useState<CatalogType>(initial?.catalog ?? initialCatalog);
  const isThrift = catalog === "THRIFT";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [hsnCode, setHsnCode] = useState(initial?.hsnCode ?? "");
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.metaDescription ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [reason, setReason] = useState("");

  const initialMatrix = initial
    ? variantsToMatrixState(initial.variants)
    : { rows: [] as VariantRow[], sizes: [] as string[], colors: [] as string[] };
  const [rows, setRows] = useState<VariantRow[]>(initialMatrix.rows);
  const [sizes, setSizes] = useState<string[]>(initialMatrix.sizes);
  const [colors, setColors] = useState<string[]>(initialMatrix.colors);

  const td = initial?.thriftDetails;
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade>(
    td?.conditionGrade ?? "GOOD",
  );
  const [conditionNotes, setConditionNotes] = useState(td?.conditionNotes ?? "");
  const [originalBrand, setOriginalBrand] = useState(td?.originalBrand ?? "");
  const [labelledSize, setLabelledSize] = useState(td?.labelledSize ?? "");
  const [recommendedFit, setRecommendedFit] = useState(td?.recommendedFit ?? "");
  const [fabric, setFabric] = useState(td?.fabric ?? "");
  const [alterations, setAlterations] = useState(td?.alterations ?? "");
  const [authenticityNotes, setAuthenticityNotes] = useState(td?.authenticityNotes ?? "");
  const [careNotes, setCareNotes] = useState(td?.careNotes ?? "");
  const [isOneOfOne, setIsOneOfOne] = useState(td?.isOneOfOne ?? true);
  const [acquisitionCost, setAcquisitionCost] = useState(
    td?.acquisitionCostPaise != null ? (td.acquisitionCostPaise / 100).toFixed(2) : "",
  );
  const [measurementsJson, setMeasurementsJson] = useState(
    JSON.stringify(td?.measurements ?? {}, null, 2),
  );

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);

  const publicSiteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const oneOfOneConflict = isThrift && isOneOfOne && rows.filter((r) => !r.orphaned).length > 1;

  async function handleSave() {
    setSaving(true);
    setBanner(null);
    const variants = rows.filter((r) => !r.orphaned).map(rowToVariantInput);
    const orphanedSaved = rows.filter((r) => r.orphaned && r.id);
    const thrift = isThrift
      ? {
          conditionGrade,
          conditionNotes: conditionNotes || null,
          originalBrand: originalBrand || null,
          labelledSize: labelledSize || null,
          recommendedFit: recommendedFit || null,
          fabric: fabric || null,
          measurementsJson,
          alterations: alterations || null,
          authenticityNotes: authenticityNotes || null,
          careNotes: careNotes || null,
          isOneOfOne,
          acquisitionCost: acquisitionCost || null,
        }
      : undefined;

    if (!productId) {
      const result = await createFullProductAction({
        catalog,
        title,
        description,
        brand: brand || null,
        tags,
        hsnCode: hsnCode || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        variants,
        thrift,
      });
      setSaving(false);
      if (result.ok) {
        setProductId(result.productId);
        setBanner({ ok: true, message: "Product created." });
        router.replace(`/admin/products/${result.productId}`);
      } else {
        // A partial failure after the product row itself was created still
        // hands back that real id — adopt it so a retry edits the real row
        // instead of risking a second, duplicate product.
        if (result.productId) setProductId(result.productId);
        setBanner({ ok: false, message: result.errors?.join(" ") || result.message });
      }
      return;
    }

    const errors: string[] = [];

    const coreRes = await updateProductAction(
      productId,
      { slug, title, description, brand: brand || null, tags, hsnCode: hsnCode || null, metaTitle: metaTitle || null, metaDescription: metaDescription || null },
      reason || undefined,
    );
    if (!coreRes.ok) errors.push(coreRes.message);

    if (status !== initial?.status) {
      const next = status === "PUBLISHED" ? "PUBLISH" : status === "ARCHIVED" ? "ARCHIVE" : "DRAFT";
      const statusRes = await statusAction(productId, next, reason || undefined);
      if (!statusRes.ok) errors.push(statusRes.message);
    }

    const activeRows = rows.filter((r) => !r.orphaned);
    const toSave = [
      ...activeRows.map((r) => ({ key: r.key, input: rowToVariantInput(r) })),
      ...orphanedSaved.map((r) => ({ key: r.key, input: rowToVariantInput(r) })),
    ];
    const nextRows = [...rows];
    for (const row of toSave) {
      const vRes = await upsertVariantAction(productId, row.input);
      if (!vRes.ok) {
        errors.push(`Variant ${row.input.size || row.input.color || "default"}: ${vRes.message}`);
      } else {
        const idx = nextRows.findIndex((r) => r.key === row.key);
        if (idx >= 0 && !nextRows[idx].id) nextRows[idx] = { ...nextRows[idx], id: vRes.variantId };
      }
    }
    setRows(nextRows);

    if (isThrift && thrift) {
      const tRes = await thriftDetailsAction(productId, thrift);
      if (!tRes.ok) errors.push(tRes.message);
    }

    setSaving(false);
    setBanner(
      errors.length > 0
        ? { ok: false, message: errors.join(" ") }
        : { ok: true, message: "Saved." },
    );
    router.refresh();
  }

  return (
    <div className="pb-16">
      {/* Sticky Save bar */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-line bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/products" className="text-xs text-ink-soft hover:underline">
              ← All products
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-ink-strong">
                {title.trim() || "New product"}
              </h1>
              {productId && (
                <>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-soft">
                    {isThrift ? "Closet" : "Label"}
                  </span>
                  <Pill value={status} />
                  {status === "PUBLISHED" && (
                    <Link
                      href={productPath(catalog, slug)}
                      className="text-xs underline"
                      target="_blank"
                    >
                      view on storefront
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {banner && (
              <span className={`text-sm ${banner.ok ? "text-ok" : "text-stop"}`}>
                {banner.message}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim() || oneOfOneConflict}
              className="min-h-11 rounded bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : productId ? "Save" : "Save product"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ── */}
        <div className="space-y-8">
          {!initial && (
            <section>
              <fieldset>
                <legend className="text-xs font-medium">Catalogue *</legend>
                <div className="mt-1 flex gap-4">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={catalog === "THE_POOJA_EDIT"}
                      onChange={() => setCatalog("THE_POOJA_EDIT")}
                    />
                    The Label (new apparel)
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={catalog === "THRIFT"}
                      onChange={() => setCatalog("THRIFT")}
                    />
                    The Closet (pre-loved, one of one)
                  </label>
                </div>
              </fieldset>
            </section>
          )}

          <section className="space-y-3">
            <TextInput label="Title" required value={title} onChange={setTitle} />
            <TextAreaInput label="Description" value={description} onChange={setDescription} rows={5} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
              Media
            </h2>
            <ImageUploader
              productId={productId}
              isThrift={isThrift}
              defaultAltPrefix={title || "product"}
              hasExistingImages={(initial?.images.length ?? 0) > 0}
            />
            {initial && initial.images.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {initial.images.map((im, i) => (
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
                      <ActionForm action={reorderImageAction.bind(null, productId!)} submitLabel="↑" compact>
                        <input type="hidden" name="imageId" value={im.id} />
                        <input type="hidden" name="direction" value="up" />
                      </ActionForm>
                      <ActionForm action={reorderImageAction.bind(null, productId!)} submitLabel="↓" compact>
                        <input type="hidden" name="imageId" value={im.id} />
                        <input type="hidden" name="direction" value="down" />
                      </ActionForm>
                      {!im.isPrimary && (
                        <ActionForm action={setPrimaryImageAction.bind(null, productId!)} submitLabel="Primary" compact>
                          <input type="hidden" name="imageId" value={im.id} />
                        </ActionForm>
                      )}
                      <ActionForm action={deleteImageAction.bind(null, productId!)} submitLabel="Delete" compact>
                        <input type="hidden" name="imageId" value={im.id} />
                      </ActionForm>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-ink-soft" title={im.altText}>
                      {i + 1}. {im.altText}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
              Pricing & variants
            </h2>
            <VariantMatrix
              productTitle={title}
              isThrift={isThrift}
              isOneOfOne={isOneOfOne}
              rows={rows}
              sizes={sizes}
              colors={colors}
              onRowsChange={setRows}
              onSizesChange={setSizes}
              onColorsChange={setColors}
            />
          </section>

          {isThrift && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
                Thrift details
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <SelectInput
                  label="Condition grade"
                  value={conditionGrade}
                  onChange={(v) => setConditionGrade(v as ConditionGrade)}
                  options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                />
                <label id="f-isOneOfOne-label" className="flex min-h-11 items-end gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isOneOfOne}
                    onChange={(e) => setIsOneOfOne(e.target.checked)}
                  />
                  one of one
                </label>
              </div>
              <TextInput label="Condition notes" value={conditionNotes} onChange={setConditionNotes} />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Original brand" value={originalBrand} onChange={setOriginalBrand} />
                <TextInput label="Fabric" value={fabric} onChange={setFabric} />
                <TextInput label="Labelled size" value={labelledSize} onChange={setLabelledSize} />
                <TextInput label="Recommended fit" value={recommendedFit} onChange={setRecommendedFit} />
                <TextInput label="Alterations" value={alterations} onChange={setAlterations} />
                <TextInput
                  label="Acquisition cost (₹, admin-only)"
                  type="number"
                  step="0.01"
                  value={acquisitionCost}
                  onChange={setAcquisitionCost}
                />
              </div>
              <TextInput label="Authenticity notes" value={authenticityNotes} onChange={setAuthenticityNotes} />
              <TextInput label="Care notes" value={careNotes} onChange={setCareNotes} />
              <TextAreaInput
                label='Measurements (JSON, e.g. {"bust":{"value":"34","unit":"in"}})'
                value={measurementsJson}
                onChange={setMeasurementsJson}
                rows={6}
                mono
              />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
              Search engine listing
            </h2>
            <SeoPreview
              url={
                initial
                  ? `${publicSiteUrl}${productPath(catalog, slug)}`
                  : `${publicSiteUrl}${productPath(catalog, "…")} (assigned once you save)`
              }
              title={title}
              metaTitle={metaTitle}
              description={description}
              metaDescription={metaDescription}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="SEO title" value={metaTitle} onChange={setMetaTitle} />
              <TextInput label="SEO description" value={metaDescription} onChange={setMetaDescription} />
            </div>
            {initial && (
              <details className="rounded border border-line p-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-strong">
                  Advanced: Web address
                </summary>
                <div className="mt-3 space-y-2">
                  <TextInput label="Web address (slug)" required value={slug} onChange={setSlug} />
                  <p className="text-xs text-stop">
                    Changing this breaks any link to this product already shared — only change
                    it if you know that&rsquo;s what you want.
                  </p>
                </div>
              </details>
            )}
          </section>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-8">
          <section className="space-y-2 rounded border border-line p-3">
            <SelectInput label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={STATUS_OPTIONS} />
            {initialCheck && (
              <ul className="text-xs">
                {initialCheck.ok ? (
                  <li className="text-ok">Ready to publish.</li>
                ) : (
                  initialCheck.errors.map((e, i) => (
                    <li key={i} className="text-stop">
                      • {e}
                    </li>
                  ))
                )}
              </ul>
            )}
            <TextInput label="Reason (audit, optional)" value={reason} onChange={setReason} placeholder="why this change" />
          </section>

          <section className="space-y-3 rounded border border-line p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
              Organization
            </h2>
            <TextInput label="Vendor" value={brand} onChange={setBrand} />
            <TextInput label="HSN code" value={hsnCode} onChange={setHsnCode} />
            <TagInput label="Tags" values={tags} onChange={setTags} placeholder="add a tag" />
          </section>

          {initial && (
            <section className="space-y-2 rounded border border-line p-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
                Collections
              </h2>
              {initial.collections.length > 0 && (
                <ul className="text-sm text-ink-soft">
                  {initial.collections
                    .filter((pc) => !pc.collection.isInternal)
                    .map((pc) => (
                      <li key={pc.collectionId}>
                        {pc.collection.name} {pc.collection.isActive ? "" : "(inactive)"}
                      </li>
                    ))}
                </ul>
              )}
              {homeRailSlug &&
                (() => {
                  const membership = initial.collections.find(
                    (pc) => pc.collection.slug === homeRailSlug && pc.collection.isInternal,
                  );
                  return (
                    <ActionForm
                      action={toggleFeatureOnHomeAction.bind(null, productId!, catalog)}
                      submitLabel={
                        membership
                          ? `Remove from home page (currently #${membership.position + 1})`
                          : "Feature on home page"
                      }
                      compact
                    >
                      <span />
                    </ActionForm>
                  );
                })()}
            </section>
          )}

          {initial && (
            <section className="border-t border-line pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stop">Delete</h2>
              <p className="mt-1 text-xs text-ink-soft">
                Only possible if this product has never appeared on an order. If it has, use
                &ldquo;Hidden from shop&rdquo; status above instead.
              </p>
              <div className="mt-3">
                <DeleteProductConfirm
                  productTitle={initial.title}
                  deleteAction={deleteProductAction.bind(null, productId!)}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
