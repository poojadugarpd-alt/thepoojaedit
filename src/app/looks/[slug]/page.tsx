import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCart } from "@/features/catalog/add-to-cart";
import { AvailabilityBadge } from "@/features/catalog/availability-badge";
import { Price } from "@/features/catalog/price";
import { returnPolicyNote } from "@/features/catalog/return-policy";
import { productPath } from "@/lib/catalog-routes";
import { prisma } from "@/lib/db";
import { isSignedInAdmin } from "@/server/auth/require-admin";
import { getLookBySlug } from "@/server/looks";

// Stock changes by the minute and drafts are admin-only: render per request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const look = await getLookBySlug(prisma, slug, { includeDrafts: true });
  if (!look) return {};
  return {
    title: look.title,
    description:
      look.caption?.slice(0, 160) ??
      `Shop ${look.title} by Pooja Dugar: the pieces from the look, in one place.`,
    alternates: { canonical: `/looks/${look.slug}` },
    openGraph: look.cover ? { images: [{ url: look.cover.url }] } : undefined,
    ...(look.status === "PUBLISHED" ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LookPage({ params }: Props) {
  const { slug } = await params;
  let look = await getLookBySlug(prisma, slug);
  // A draft is a 404 for shoppers; Pooja sees it to check before publishing.
  if (!look && (await isSignedInAdmin())) {
    look = await getLookBySlug(prisma, slug, { includeDrafts: true });
  }
  if (!look) notFound();
  const draft = look.status !== "PUBLISHED";

  return (
    <div>
      {draft && (
        <p className="u-page pt-6">
          <span className="block rounded-[10px] border border-line bg-fill px-4 py-3 text-sm text-ink">
            Draft: only you can see this Look. Publish it from{" "}
            <Link href="/admin/looks" className="underline underline-offset-2">
              Admin → Looks
            </Link>{" "}
            when it&rsquo;s ready.
          </span>
        </p>
      )}

      <section className="u-page grid gap-10 pt-10 pb-12 sm:grid-cols-[minmax(0,26rem)_1fr] sm:items-end sm:pt-16">
        {look.cover && (
          <div className="u-media relative aspect-[4/5] overflow-hidden">
            <Image
              src={look.cover.url}
              alt={look.cover.alt}
              fill
              priority
              sizes="(min-width: 640px) 26rem, 100vw"
              className="object-cover"
            />
          </div>
        )}
        <div>
          <p className="u-eyebrow">Shop the look</p>
          <h1 className="u-display mt-5 max-w-[16ch]">{look.title}</h1>
          {look.caption && (
            <p className="u-lead mt-6 whitespace-pre-line">{look.caption}</p>
          )}
          {look.reelUrl && (
            <a
              href={look.reelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-textlink mt-8 inline-block"
            >
              Watch on Instagram ↗
            </a>
          )}
        </div>
      </section>

      <section className="u-section u-rule" aria-labelledby="pieces">
        <div className="u-page">
          <h2 id="pieces" className="u-h2">
            {look.products.length === 1 ? "The piece" : "The pieces"}
          </h2>
          {look.products.length === 0 ? (
            <p className="mt-6 text-ink">
              These pieces have all sold.{" "}
              <Link href="/closet" className="underline underline-offset-2">
                See what&rsquo;s in the Closet now
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-10 grid gap-12 sm:grid-cols-2">
              {look.products.map((p) => {
                const href = productPath(p.catalog, p.slug);
                const img = p.images[0];
                return (
                  <li
                    key={p.slug}
                    className="grid grid-cols-[7rem_1fr] gap-5 sm:grid-cols-[9rem_1fr]"
                  >
                    <Link href={href} className="u-card-panel block">
                      {img && (
                        <Image
                          src={img.url}
                          alt={img.alt || p.title}
                          fill
                          sizes="9rem"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0">
                      <h3 className="u-label">
                        <Link href={href} className="hover:opacity-70">
                          {p.title}
                        </Link>
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Price
                          pricePaise={p.fromPricePaise}
                          compareAtPaise={p.compareAtPaise}
                          fromPrefix={!p.isThrift}
                        />
                        <AvailabilityBadge availability={p.availability} />
                      </div>
                      <div className="mt-4">
                        <AddToCart
                          catalog={p.catalog}
                          productSlug={p.slug}
                          productTitle={p.title}
                          variants={p.variants}
                          imageUrl={img?.url ?? null}
                          availability={p.availability}
                          isOneOfOne={p.isThrift && p.isOneOfOne}
                          returnPolicyNote={returnPolicyNote(p.catalog)}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
