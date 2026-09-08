import Image from "next/image";
import Link from "next/link";

import { ProductCard } from "@/features/catalog/product-card";
import { listProducts } from "@/server/catalog";
import type { PublicProductCard } from "@/server/catalog/public-shape";

export const revalidate = 300;

function Rail({
  heading,
  href,
  shopLabel,
  products,
}: {
  heading: string;
  href: string;
  shopLabel: string;
  products: PublicProductCard[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="u-section u-rule">
      <div className="u-page">
        <div className="flex items-end justify-between gap-4">
          <h2 className="u-h2">{heading}</h2>
          <Link href={href} className="u-textlink shrink-0">
            {shopLabel}
          </Link>
        </div>
      </div>
      <div className="u-page mt-10">
        <div className="u-rail">
          {products.map((p) => (
            <ProductCard key={`${p.catalog}:${p.slug}`} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

const EMPTY_PAGE = { items: [] as PublicProductCard[], nextCursor: null };

export default async function HomePage() {
  // The homepage rails are decorative — never let a cold DB (e.g. a build before
  // the database is provisioned) turn the landing page into a 500.
  const [edit, thrift] = await Promise.all([
    listProducts({ catalog: "THE_POOJA_EDIT", sort: "newest", limit: 10 }).catch(
      () => EMPTY_PAGE,
    ),
    listProducts({ catalog: "THRIFT", sort: "newest", limit: 10 }).catch(
      () => EMPTY_PAGE,
    ),
  ]);

  const gram = [...edit.items, ...thrift.items]
    .filter((p) => p.primaryImage)
    .slice(0, 6);

  return (
    <div>
      {/* Hero — the headline is the whole opening move, calm and oversized */}
      <section className="u-page pt-16 pb-20 sm:pt-24 sm:pb-28">
        <p className="u-eyebrow">The Pooja Edit + Thrift Store</p>
        <h1 className="u-display mt-5 max-w-[16ch]">One brand, two ways to shop.</h1>
        <p className="u-lead mt-6">
          New, slow-made apparel from the studio, and pre-loved one-of-one pieces.
          One cart holds both — each keeps its own return policy at checkout.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/the-pooja-edit" className="u-pill">
            Shop The Pooja Edit
          </Link>
          <Link href="/thrift" className="u-textlink">
            Shop Thrift Store
          </Link>
        </div>
      </section>

      <Rail
        heading="New in"
        href="/the-pooja-edit"
        shopLabel="All new pieces"
        products={edit.items}
      />

      <Rail
        heading="From the Thrift Store"
        href="/thrift"
        shopLabel="All pre-loved"
        products={thrift.items}
      />

      {/* Two edits — the split, kept literal so the routes read clearly */}
      <section className="u-section u-rule">
        <div className="u-page grid gap-12 sm:grid-cols-2">
          <div>
            <h2 className="u-h3">The Pooja Edit</h2>
            <p className="mt-3 text-ink">
              Original apparel — kurtis, co-ord sets and linen, restocked in real
              sizes and colours.
            </p>
            <Link href="/the-pooja-edit" className="u-textlink mt-5">
              Enter the edit
            </Link>
          </div>
          <div>
            <h2 className="u-h3">Thrift Store</h2>
            <p className="mt-3 text-ink">
              Pre-loved and one-of-one. Every piece listed with its condition,
              measurements and any flaws. When it&rsquo;s gone, it&rsquo;s gone.
            </p>
            <Link href="/thrift" className="u-textlink mt-5">
              Browse the rails
            </Link>
          </div>
        </div>
      </section>

      {/* Instagram */}
      {gram.length >= 3 && (
        <section className="u-section u-rule">
          <div className="u-page flex items-end justify-between gap-4">
            <h2 className="u-h2">On Instagram</h2>
            <a
              href="https://www.instagram.com/poojadugar_/"
              target="_blank"
              rel="noreferrer noopener"
              className="u-pill shrink-0"
            >
              Follow @poojadugar_
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
          <h2 className="u-h3">Get the drop list</h2>
          <p className="mt-3 text-ink">
            One email when new pieces and thrift restocks go live. No noise.
          </p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/account">
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
