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
      <dt className="font-medium">Measurements</dt>
      <dd className="mt-1">
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
        <p className="mt-1 text-xs text-black/45 dark:text-white/45">
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
    <section className="mt-8 border-t border-black/10 pt-6 dark:border-white/15">
      <h2 className="text-sm font-semibold uppercase tracking-wide">The details</h2>
      <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Condition</dt>
          <dd>
            {CONDITION_LABEL[thrift.conditionGrade] ?? thrift.conditionGrade}
            {thrift.conditionNotes ? ` — ${thrift.conditionNotes}` : ""}
          </dd>
        </div>
        {thrift.originalBrand && (
          <div>
            <dt className="font-medium">Original brand</dt>
            <dd>{thrift.originalBrand}</dd>
          </div>
        )}
        {thrift.labelledSize && (
          <div>
            <dt className="font-medium">Labelled size</dt>
            <dd>{thrift.labelledSize}</dd>
          </div>
        )}
        {thrift.recommendedFit && (
          <div>
            <dt className="font-medium">Recommended fit</dt>
            <dd>{thrift.recommendedFit}</dd>
          </div>
        )}
        {thrift.fabric && (
          <div>
            <dt className="font-medium">Fabric</dt>
            <dd>{thrift.fabric}</dd>
          </div>
        )}
        {thrift.alterations && (
          <div>
            <dt className="font-medium">Alterations</dt>
            <dd>{thrift.alterations}</dd>
          </div>
        )}
        <Measurements value={thrift.measurements} />
        {flaws.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="font-medium">Flaws</dt>
            <dd>
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
            <dt className="font-medium">Authenticity</dt>
            <dd>{thrift.authenticityNotes}</dd>
          </div>
        )}
        {thrift.careNotes && (
          <div className="sm:col-span-2">
            <dt className="font-medium">Care</dt>
            <dd>{thrift.careNotes}</dd>
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
    <article className="mx-auto max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(product, url)) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-sm text-black/55 dark:text-white/55"
      >
        <Link href={`/${segment}`} className="hover:underline">
          {CATALOG_LABEL[product.catalog]}
        </Link>
        <span aria-hidden> / </span>
        <span>{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <Gallery images={product.images} title={product.title} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          {product.brand && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {product.brand}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Price
              pricePaise={product.fromPricePaise}
              compareAtPaise={product.compareAtPaise}
              className="text-lg"
            />
            <AvailabilityBadge availability={product.availability} />
            {product.isThrift && (
              <span className="text-xs uppercase tracking-wide text-black/45 dark:text-white/45">
                One of one
              </span>
            )}
          </div>

          <div className="mt-6">
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
            <div className="mt-8 space-y-2 text-sm leading-relaxed text-black/80 dark:text-white/80">
              {descParas.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {product.thrift && <ThriftDetailsBlock thrift={product.thrift} />}

      {product.availability === "SOLD" && alternatives.length > 0 && (
        <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/15">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            More like this
          </h2>
          <div className="mt-4">
            <ProductGrid products={alternatives} />
          </div>
        </section>
      )}
    </article>
  );
}
