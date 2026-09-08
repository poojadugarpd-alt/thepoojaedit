import Image from "next/image";
import Link from "next/link";

import { ProductRail } from "@/features/catalog/product-rail";
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
  const gram = [...editItems, ...thriftItems]
    .filter((p) => p.primaryImage && !usedSlugs.has(p.slug))
    .slice(0, 6);

  return (
    <div>
      {/* Hero — the headline is the whole opening move, calm and oversized */}
      <section className="u-page pt-14 pb-16 sm:pt-20 sm:pb-24">
        <p className="u-eyebrow">The Pooja Edit + Thrift Store</p>
        <h1 className="u-display mt-6 max-w-[14ch]">One brand, two ways to shop.</h1>
        <p className="u-lead mt-7">
          New, slow-made apparel from the studio, and pre-loved one-of-one pieces.
          One cart holds both — each keeps its own return policy at checkout.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/the-pooja-edit" className="u-pill">
            Shop The Pooja Edit
          </Link>
          <Link href="/thrift" className="u-textlink">
            Shop Thrift Store
          </Link>
        </div>
      </section>

      {/* Editorial band — one large image, only when we have product photography */}
      {hero && (
        <section className="u-page pb-4">
          <Link
            href={`/${hero.product.isThrift ? "thrift" : "the-pooja-edit"}/${hero.product.slug}`}
            className="group block"
          >
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
        href="/the-pooja-edit"
        shopLabel="All new pieces"
        products={editItems}
      />

      {/* Two edits — image-led where we have a photo, text otherwise */}
      <section className="u-section u-section--fill">
        <div className="u-page grid gap-12 sm:grid-cols-2 sm:gap-8">
          <EditBlock
            href="/the-pooja-edit"
            heading="The Pooja Edit"
            body="Original apparel — kurtis, co-ord sets and linen, restocked in real sizes and colours."
            cta="View the collection"
            hero={editHero}
          />
          <EditBlock
            href="/thrift"
            heading="Thrift Store"
            body="Pre-loved and one-of-one. Every piece listed with its condition, measurements and any flaws. When it's gone, it's gone."
            cta="Browse the rails"
            hero={thriftHero}
          />
        </div>
      </section>

      <RailSection
        eyebrow="Pre-loved"
        heading="From the Thrift Store"
        href="/thrift"
        shopLabel="All pre-loved"
        products={thriftItems}
      />

      {/* Instagram */}
      {gram.length >= 3 && (
        <section className="u-section u-rule">
          <div className="u-page flex items-end justify-between gap-4">
            <div>
              <p className="u-eyebrow">@poojadugar_</p>
              <h2 className="u-h2 mt-3">On Instagram</h2>
            </div>
            <a
              href="https://www.instagram.com/poojadugar_/"
              target="_blank"
              rel="noreferrer noopener"
              className="u-pill shrink-0"
            >
              Follow
            </a>
          </div>
          <div className="u-page mt-10">
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {gram.map((p) => (
                <li key={`${p.catalog}:${p.slug}`}>
                  <Link
                    href={`/${p.isThrift ? "thrift" : "the-pooja-edit"}/${p.slug}`}
                    className="u-media block aspect-square"
                  >
                    <Image
                      src={p.primaryImage!.url}
                      alt={p.primaryImage!.alt || p.title}
                      width={320}
                      height={320}
                      sizes="(max-width: 640px) 33vw, 15vw"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="u-section u-rule">
        <div className="u-page max-w-xl">
          <p className="u-eyebrow">Newsletter</p>
          <h2 className="u-h2 mt-3">Get the drop list</h2>
          <p className="mt-4 text-ink">
            One email when new pieces and thrift restocks go live. No noise.
          </p>
          <form className="mt-7 flex flex-col gap-3 sm:flex-row" action="/account">
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
