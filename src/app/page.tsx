import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { InstagramStrip } from "@/features/instagram/instagram-strip";
import { ProductRail } from "@/features/catalog/product-rail";
import { productPath, SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";
import { prisma } from "@/lib/db";
import { getRailProducts } from "@/server/catalog";
import type { PublicProductCard } from "@/server/catalog/public-shape";
import {
  DEFAULT_HOME_CONTENT,
  getHomeContent,
  type HomeMediaSlot,
  type HomeSectionKey,
} from "@/server/settings";

export const revalidate = 300;

const EMPTY_ITEMS: PublicProductCard[] = [];

/**
 * The homepage rails are decorative — a cold database (e.g. a build before the
 * database is provisioned) must never turn the landing page into a 500. The
 * guard is a `try`/`catch`, not `.catch()`, because a missing `DATABASE_URL`
 * throws synchronously the first time the Prisma client is touched.
 *
 * `getRailProducts` (owner feedback, 2026-09-13, Part B) reads Pooja's own
 * ordering from the internal `home-label` / `home-closet` collection and
 * falls back to today's "newest 12" behaviour when she hasn't curated one —
 * the fallback lives inside that function, not here, so an empty rail and a
 * not-yet-created one behave identically.
 */
async function railItems(catalog: "THE_POOJA_EDIT" | "THRIFT") {
  try {
    return await getRailProducts(catalog);
  } catch {
    return EMPTY_ITEMS;
  }
}

/** Same cold-database guard as `railItems()` — the copy always has to render. */
async function homeContent() {
  try {
    return await getHomeContent(prisma);
  } catch {
    return DEFAULT_HOME_CONTENT;
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

/**
 * A media spot (the big editorial band, or a Label/Closet block photo) can be
 * a deliberately uploaded picture or short video (owner follow-up,
 * 2026-09-13 — "no option to edit the actual pictures/video"), or fall back
 * to "auto": the first rail item with a photo, tied to that product.
 */
type ResolvedMedia =
  | { kind: "auto"; url: string; alt: string; product: PublicProductCard }
  | { kind: "image"; url: string; alt: string }
  | { kind: "video"; url: string; posterUrl?: string; alt: string }
  | null;

function resolveMedia(
  slot: HomeMediaSlot,
  autoPick: { image: PublicProductCard["primaryImage"]; product: PublicProductCard } | null,
): ResolvedMedia {
  if (slot.kind === "image" && slot.url) return { kind: "image", url: slot.url, alt: slot.alt ?? "" };
  if (slot.kind === "video" && slot.url) {
    return { kind: "video", url: slot.url, posterUrl: slot.posterUrl, alt: slot.alt ?? "" };
  }
  if (autoPick?.image) {
    return {
      kind: "auto",
      url: autoPick.image.url,
      alt: autoPick.image.alt || autoPick.product.title,
      product: autoPick.product,
    };
  }
  return null;
}

/** `home.media.editorialMobile`'s own `"auto"` means "no phone-specific
 * override" (not "pick a rail photo" — that's the desktop slot's job), so
 * this resolves to `null` rather than falling back to anything: `null` here
 * means the phone just shows the desktop asset, cropped, exactly as before
 * this override existed (owner follow-up, 2026-09-13 — a video framed for
 * the wide desktop band "looks cropped, even worse on mobile"). */
function resolveMobileOverride(slot: HomeMediaSlot): ResolvedMedia {
  if (slot.kind === "image" && slot.url) return { kind: "image", url: slot.url, alt: slot.alt ?? "" };
  if (slot.kind === "video" && slot.url) {
    return { kind: "video", url: slot.url, posterUrl: slot.posterUrl, alt: slot.alt ?? "" };
  }
  return null;
}

/** Fills a fixed aspect-ratio box with either an image or an autoplaying,
 * muted, looping video — the one place this home page renders either. */
function MediaFill({
  media,
  priority = false,
  sizes,
}: {
  media: Exclude<ResolvedMedia, null>;
  priority?: boolean;
  sizes: string;
}) {
  if (media.kind === "video") {
    return (
      <video
        src={media.url}
        poster={media.posterUrl}
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <Image
      src={media.url}
      alt={media.alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover transition-opacity duration-300 group-hover:opacity-95"
    />
  );
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
  const [editItems, thriftItems, home] = await Promise.all([
    railItems("THE_POOJA_EDIT"),
    railItems("THRIFT"),
    homeContent(),
  ]);

  const editAutoPick = pickImage(editItems);
  const editorial = resolveMedia(home.media.editorial, editAutoPick ?? pickImage(thriftItems));
  const editorialMobile = resolveMobileOverride(home.media.editorialMobile);
  const skipSlug = editorial?.kind === "auto" ? editorial.product.slug : undefined;
  const labelMedia = resolveMedia(home.media.labelBlock, pickImage(editItems, skipSlug));
  const closetMedia = resolveMedia(home.media.closetBlock, pickImage(thriftItems, skipSlug));

  const usedSlugs = new Set(
    [editorial, labelMedia, closetMedia]
      .map((m) => (m?.kind === "auto" ? m.product.slug : undefined))
      .filter(Boolean),
  );
  const fallbackTiles = [...editItems, ...thriftItems]
    .filter((p) => p.primaryImage && !usedSlugs.has(p.slug))
    .slice(0, 6)
    .map((p) => ({
      href: productPath(p.catalog, p.slug),
      imageUrl: p.primaryImage!.url,
      alt: p.primaryImage!.alt || p.title,
    }));

  // Layout: hero (the two-catalogue-entrance opening, master spec §4) always
  // renders first and is never hideable; everything else follows Pooja's own
  // order/visibility from /admin/home (owner follow-up, 2026-09-13).
  const sectionContent: Record<HomeSectionKey, ReactNode> = {
    editorial: editorial && (
      <section key="editorial" className="u-page pb-4">
        {editorial.kind === "auto" ? (
          <Link href={productPath(editorial.product.catalog, editorial.product.slug)} className="group block">
            <EditorialMedia editorial={editorial} mobile={editorialMobile} />
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="u-label">{editorial.product.title}</p>
              <span className="u-textlink">{home.editorial.linkLabel}</span>
            </div>
          </Link>
        ) : (
          <EditorialMedia editorial={editorial} mobile={editorialMobile} />
        )}
      </section>
    ),
    newIn: (
      <RailSection
        key="newIn"
        eyebrow={home.newIn.eyebrow}
        heading={home.newIn.heading}
        href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`}
        shopLabel={home.newIn.linkLabel}
        products={editItems}
      />
    ),
    editBlocks: (
      <section key="editBlocks" className="u-section u-section--fill">
        <div className="u-page grid gap-12 sm:grid-cols-2 sm:gap-8">
          <EditBlock
            href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`}
            heading={home.labelBlock.heading}
            body={home.labelBlock.body}
            cta={home.labelBlock.cta}
            media={labelMedia}
          />
          <EditBlock
            href={`/${SEGMENT_BY_CATALOG.THRIFT}`}
            heading={home.closetBlock.heading}
            body={home.closetBlock.body}
            cta={home.closetBlock.cta}
            media={closetMedia}
          />
        </div>
      </section>
    ),
    fromCloset: (
      <RailSection
        key="fromCloset"
        eyebrow={home.fromCloset.eyebrow}
        heading={home.fromCloset.heading}
        href={`/${SEGMENT_BY_CATALOG.THRIFT}`}
        shopLabel={home.fromCloset.linkLabel}
        products={thriftItems}
      />
    ),
    instagram: <InstagramStrip key="instagram" fallback={fallbackTiles} />,
    newsletter: (
      <section key="newsletter" className="u-section u-rule">
        <div className="u-page max-w-xl">
          <p className="u-eyebrow">{home.newsletter.eyebrow}</p>
          <h2 className="u-h2 mt-3">{home.newsletter.heading}</h2>
          <p className="mt-4 text-ink">{home.newsletter.body}</p>
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
              {home.newsletter.buttonLabel}
            </button>
          </form>
        </div>
      </section>
    ),
  };

  return (
    <div>
      {/* Hero — the headline is the whole opening move, calm and oversized.
          Not a toggleable section: master spec §4 requires the homepage to
          "immediately offer two clear catalog entrances", which lives here. */}
      <section className="u-page pt-14 pb-16 sm:pt-20 sm:pb-24">
        <p className="u-eyebrow">{home.hero.eyebrow}</p>
        <h1 className="u-display mt-6 max-w-[14ch]">{home.hero.heading}</h1>
        <p className="u-lead mt-7">{home.hero.lead}</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`} className="u-pill">
            {home.hero.primaryCta}
          </Link>
          <Link href={`/${SEGMENT_BY_CATALOG.THRIFT}`} className="u-textlink">
            {home.hero.secondaryCta}
          </Link>
        </div>
      </section>

      {home.sections.filter((s) => s.enabled).map((s) => sectionContent[s.key])}
    </div>
  );
}

function EditorialFrame({
  media,
  aspectClassName = "aspect-[4/5] sm:aspect-[16/9]",
  sizes = "(max-width: 1440px) 100vw, 1440px",
}: {
  media: Exclude<ResolvedMedia, null>;
  aspectClassName?: string;
  sizes?: string;
}) {
  return (
    <div className={`u-media relative w-full ${aspectClassName}`}>
      <MediaFill media={media} priority sizes={sizes} />
    </div>
  );
}

/**
 * Renders one editorial band, or two — a phone-only one and a desktop-only
 * one — when a phone-specific override is set. Two `<video>`s never both
 * exist in the DOM at once outside that override, so a visitor with no
 * override set still only ever downloads the single asset they need.
 */
function EditorialMedia({
  editorial,
  mobile,
}: {
  editorial: Exclude<ResolvedMedia, null>;
  mobile: ResolvedMedia;
}) {
  if (!mobile) {
    return <EditorialFrame media={editorial} />;
  }
  return (
    <>
      <div className="sm:hidden">
        <EditorialFrame
          media={mobile}
          aspectClassName="aspect-[4/5]"
          sizes="100vw"
        />
      </div>
      <div className="hidden sm:block">
        <EditorialFrame media={editorial} aspectClassName="aspect-[16/9]" />
      </div>
    </>
  );
}

function EditBlock({
  href,
  heading,
  body,
  cta,
  media,
}: {
  href: string;
  heading: string;
  body: string;
  cta: string;
  media: ResolvedMedia;
}) {
  return (
    <div>
      {media && (
        <Link href={href} className="group block">
          <div className="u-media relative aspect-[4/5] w-full">
            <MediaFill media={media} sizes="(max-width: 640px) 100vw, 45vw" />
          </div>
        </Link>
      )}
      <h2 className={`u-h3 ${media ? "mt-5" : ""}`}>{heading}</h2>
      <p className="mt-3 max-w-[42ch] text-ink">{body}</p>
      <Link href={href} className="u-textlink mt-5">
        {cta}
      </Link>
    </div>
  );
}
