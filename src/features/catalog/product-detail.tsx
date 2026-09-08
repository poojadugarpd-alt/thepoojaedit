import Link from "next/link";

import { CATALOG_LABEL } from "@/lib/catalog-routes";
import { publicEnv } from "@/lib/public-env";
import { SEGMENT_BY_CATALOG } from "@/server/catalog";
import type { PublicProductDetail } from "@/server/catalog/public-shape";

import { AddToCart } from "./add-to-cart";
import { AvailabilityBadge } from "./availability-badge";
import { Gallery } from "./gallery";
import { Price } from "./price";
import { ProductGrid } from "./product-grid";
import { returnPolicyNote } from "./return-policy";
import type { PublicProductCard } from "@/server/catalog/public-shape";

const CONDITION_LABEL: Record<string, string> = {
  NEW_WITH_TAGS: "New with tags",
  LIKE_NEW: "Like new",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
};

function Measurements({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([k]) => !k.startsWith("_"),
  );
  if (entries.length === 0) return null;
  return (
    <div>
      <dt className="u-label">Measurements</dt>
      <dd className="mt-1 text-ink">
        <ul className="space-y-0.5">
          {entries.map(([k, v]) => {
            const m = v as { value?: unknown; unit?: unknown };
            const val = m && typeof m === "object" ? m.value : v;
            const unit = m && typeof m === "object" && m.unit ? ` ${m.unit}` : "";
            return (
              <li key={k}>
                <span className="capitalize">{k.replace(/_/g, " ")}</span>:{" "}
                {String(val)}
                {unit}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-xs text-ink-soft">
          Units as recorded by the seller; confirm before ordering.
        </p>
      </dd>
    </div>
  );
}

function ThriftDetailsBlock({
  thrift,
}: {
  thrift: NonNullable<PublicProductDetail["thrift"]>;
}) {
  const flaws = Array.isArray(thrift.flaws)
    ? (thrift.flaws as { description?: string }[])
    : [];
  return (
    <section className="mt-16 border-t border-line pt-10">
      <h2 className="u-label">The details</h2>
      <dl className="mt-6 grid gap-6 text-[0.95rem] text-ink sm:grid-cols-2">
        <div>
          <dt className="u-label">Condition</dt>
          <dd className="mt-1">
            {CONDITION_LABEL[thrift.conditionGrade] ?? thrift.conditionGrade}
            {thrift.conditionNotes ? ` — ${thrift.conditionNotes}` : ""}
          </dd>
        </div>
        {thrift.originalBrand && (
          <div>
            <dt className="u-label">Original brand</dt>
            <dd className="mt-1">{thrift.originalBrand}</dd>
          </div>
        )}
        {thrift.labelledSize && (
          <div>
            <dt className="u-label">Labelled size</dt>
            <dd className="mt-1">{thrift.labelledSize}</dd>
          </div>
        )}
        {thrift.recommendedFit && (
          <div>
            <dt className="u-label">Recommended fit</dt>
            <dd className="mt-1">{thrift.recommendedFit}</dd>
          </div>
        )}
        {thrift.fabric && (
          <div>
            <dt className="u-label">Fabric</dt>
            <dd className="mt-1">{thrift.fabric}</dd>
          </div>
        )}
        {thrift.alterations && (
          <div>
            <dt className="u-label">Alterations</dt>
            <dd className="mt-1">{thrift.alterations}</dd>
          </div>
        )}
        <Measurements value={thrift.measurements} />
        {flaws.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="u-label">Flaws</dt>
            <dd className="mt-1">
              <ul className="list-inside list-disc">
                {flaws.map((f, i) => (
                  <li key={i}>{f.description ?? String(f)}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {thrift.authenticityNotes && (
          <div className="sm:col-span-2">
            <dt className="u-label">Authenticity</dt>
            <dd className="mt-1">{thrift.authenticityNotes}</dd>
          </div>
        )}
        {thrift.careNotes && (
          <div className="sm:col-span-2">
            <dt className="u-label">Care</dt>
            <dd className="mt-1">{thrift.careNotes}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function jsonLd(product: PublicProductDetail, url: string) {
  const availability =
    product.availability === "IN_STOCK"
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price:
        product.fromPricePaise != null
          ? (product.fromPricePaise / 100).toFixed(2)
          : undefined,
      availability,
      url,
    },
  };
}

export function ProductDetail({
  product,
  alternatives = [],
}: {
  product: PublicProductDetail;
  alternatives?: PublicProductCard[];
}) {
  const segment = SEGMENT_BY_CATALOG[product.catalog];
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${segment}/${product.slug}`;
  const descParas = product.description
    .split(/\n{2,}|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <article className="u-page py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(product, url)) }}
      />

      <nav aria-label="Breadcrumb" className="mb-10 text-[0.8125rem] text-ink-soft">
        <Link href={`/${segment}`} className="font-bold uppercase tracking-[0.06em] hover:opacity-70">
          {CATALOG_LABEL[product.catalog]}
        </Link>
        <span aria-hidden> / </span>
        <span>{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Gallery images={product.images} title={product.title} />

        <div className="lg:pt-4">
          <h1 className="u-h2">{product.title}</h1>
          {product.brand && (
            <p className="mt-2 text-[0.95rem] text-ink-soft">{product.brand}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Price
              pricePaise={product.fromPricePaise}
              compareAtPaise={product.compareAtPaise}
              className="text-lg"
            />
            <AvailabilityBadge availability={product.availability} />
            {product.isThrift && <span className="u-eyebrow">One of one</span>}
          </div>

          <div className="mt-8">
            <AddToCart
              catalog={product.catalog}
              productSlug={product.slug}
              productTitle={product.title}
              variants={product.variants}
              imageUrl={product.images[0]?.url ?? null}
              availability={product.availability}
              isOneOfOne={product.isThrift && product.isOneOfOne}
              returnPolicyNote={returnPolicyNote(product.catalog)}
            />
          </div>

          {descParas.length > 0 && (
            <div className="mt-10 space-y-3 text-[0.95rem] leading-relaxed text-ink">
              {descParas.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {product.thrift && <ThriftDetailsBlock thrift={product.thrift} />}

      {product.availability === "SOLD" && alternatives.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="u-label">More like this</h2>
          <div className="mt-8">
            <ProductGrid products={alternatives} />
          </div>
        </section>
      )}
    </article>
  );
}
