import Image from "next/image";
import Link from "next/link";

import { InstagramStrip } from "@/features/instagram/instagram-strip";
import { ProductRail } from "@/features/catalog/product-rail";
import { productPath, SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import { listProducts } from "@/server/catalog";
import type { PublicProductCard } from "@/server/catalog/public-shape";

export const revalidate = 300;

const EMPTY_ITEMS: PublicProductCard[] = [];

/**
 * The homepage rails are decorative — a cold database (e.g. a build before the
 * database is provisioned) must never turn the landing page into a 500. The
 * guard is a `try`/`catch`, not `.catch()`, because a missing `DATABASE_URL`
 * throws synchronously the first time the Prisma client is touched.
 */
async function railItems(catalog: "THE_POOJA_EDIT" | "THRIFT") {
  try {
    return (await listProducts({ catalog, sort: "newest", limit: 12 })).items;
  } catch {
    return EMPTY_ITEMS;
  }
}

function pickImage(group: PublicProductCard[], skipSlug?: string) {
  for (const p of group) {
    if (p.primaryImage && p.slug !== skipSlug) {
      return { image: p.primaryImage, product: p };
    }
  }
  return null;
}

function RailSection({
  eyebrow,
  heading,
  href,
  shopLabel,
  products,
  fill = false,
}: {
  eyebrow: string;
  heading: string;
  href: string;
  shopLabel: string;
  products: PublicProductCard[];
  fill?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className={`u-section ${fill ? "u-section--fill" : "u-rule"}`}>
      <div className="u-page">
        <p className="u-eyebrow">{eyebrow}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h2 className="u-h2">{heading}</h2>
          <Link href={href} className="u-textlink shrink-0">
            {shopLabel}
          </Link>
        </div>
        <div className="mt-10">
          <ProductRail products={products} />
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [editItems, thriftItems] = await Promise.all([
    railItems("THE_POOJA_EDIT"),
    railItems("THRIFT"),
  ]);

  const hero = pickImage(editItems) ?? pickImage(thriftItems);
  const editHero = pickImage(editItems, hero?.product.slug);
  const thriftHero = pickImage(thriftItems, hero?.product.slug);
  const usedSlugs = new Set(
    [hero, editHero, thriftHero].map((h) => h?.product.slug).filter(Boolean),
  );
  const fallbackTiles = [...editItems, ...thriftItems]
    .filter((p) => p.primaryImage && !usedSlugs.has(p.slug))
    .slice(0, 6)
    .map((p) => ({
      href: productPath(p.catalog, p.slug),
      imageUrl: p.primaryImage!.url,
      alt: p.primaryImage!.alt || p.title,
    }));

  return (
    <div>
      {/* Hero — the headline is the whole opening move, calm and oversized */}
      <section className="u-page pt-14 pb-16 sm:pt-20 sm:pb-24">
        <p className="u-eyebrow">The Pooja Edit · by Pooja Dugar</p>
        <h1 className="u-display mt-6 max-w-[14ch]">One brand, two ways to shop.</h1>
        <p className="u-lead mt-7">
          Realistic, wearable clothes, the same ones you see on my Instagram. Shop
          the Label for pieces I design in real sizes, or the Closet for one-off
          pieces from my own wardrobe. One bag, one checkout.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`} className="u-pill">
            Shop the Label
          </Link>
          <Link href={`/${SEGMENT_BY_CATALOG.THRIFT}`} className="u-textlink">
            Shop the Closet
          </Link>
        </div>
      </section>

      {/* Editorial band — one large image, only when we have product photography */}
      {hero && (
        <section className="u-page pb-4">
          <Link href={productPath(hero.product.catalog, hero.product.slug)} className="group block">
            <div className="u-media relative aspect-[4/5] w-full sm:aspect-[16/10]">
              <Image
                src={hero.image.url}
                alt={hero.image.alt || hero.product.title}
                fill
                priority
                sizes="(max-width: 1440px) 100vw, 1440px"
                className="object-cover transition-opacity duration-300 group-hover:opacity-95"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="u-label">{hero.product.title}</p>
              <span className="u-textlink">Shop the piece</span>
            </div>
          </Link>
        </section>
      )}

      <RailSection
        eyebrow="New apparel"
        heading="New in"
        href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`}
        shopLabel="All new pieces"
        products={editItems}
      />

      {/* Two edits — image-led where we have a photo, text otherwise */}
      <section className="u-section u-section--fill">
        <div className="u-page grid gap-12 sm:grid-cols-2 sm:gap-8">
          <EditBlock
            href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`}
            heading="The Label"
            body="Pooja's own designs — kurtis, co-ord sets and linen, made in real sizes and small runs."
            cta="View the collection"
            hero={editHero}
          />
          <EditBlock
            href={`/${SEGMENT_BY_CATALOG.THRIFT}`}
            heading="The Closet"
            body="Pooja's own wardrobe, passed on. Every piece is one of one, listed with its condition, measurements and any flaws, so you know exactly what you're getting. When it's gone, it's gone."
            cta="Browse the rails"
            hero={thriftHero}
          />
        </div>
      </section>

      <RailSection
        eyebrow="Pre-loved"
        heading="From the Closet"
        href={`/${SEGMENT_BY_CATALOG.THRIFT}`}
        shopLabel="All pre-loved"
        products={thriftItems}
      />

      {/* Instagram — live @poojadugar_ feed via Behold, curated fallback */}
      <InstagramStrip fallback={fallbackTiles} />

      {/* Newsletter */}
      <section className="u-section u-rule">
        <div className="u-page max-w-xl">
          <p className="u-eyebrow">Newsletter</p>
          <h2 className="u-h2 mt-3">Get the drop list</h2>
          <p className="mt-4 text-ink">
            One email when new pieces and Closet restocks go live. No noise.
          </p>
          {/* Newsletter capture is not wired yet — the form is inert until a
              provider (Resend / Behold) is connected. */}
          <form className="mt-7 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="home-email" className="sr-only">
              Email address
            </label>
            <input
              id="home-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@email.com"
              className="w-full rounded-full border border-line bg-transparent px-5 py-3 text-[0.95rem] text-ink placeholder:text-ink-soft focus-visible:border-ink-strong"
            />
            <button type="submit" className="u-pill shrink-0">
              Notify me
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function EditBlock({
  href,
  heading,
  body,
  cta,
  hero,
}: {
  href: string;
  heading: string;
  body: string;
  cta: string;
  hero: { image: { url: string; alt: string }; product: { title: string } } | null;
}) {
  return (
    <div>
      {hero && (
        <Link href={href} className="group block">
          <div className="u-media relative aspect-[4/5] w-full">
            <Image
              src={hero.image.url}
              alt={hero.image.alt || heading}
              fill
              sizes="(max-width: 640px) 100vw, 45vw"
              className="object-cover transition-opacity duration-300 group-hover:opacity-95"
            />
          </div>
        </Link>
      )}
      <h2 className={`u-h3 ${hero ? "mt-5" : ""}`}>{heading}</h2>
      <p className="mt-3 max-w-[42ch] text-ink">{body}</p>
      <Link href={href} className="u-textlink mt-5">
        {cta}
      </Link>
    </div>
  );
}
