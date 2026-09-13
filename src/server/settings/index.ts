import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/**
 * Typed reads over the `StoreSettings` key/value table (master §3, §10). Values
 * are owner-confirmed before live checkout; the dev seed writes clearly-labelled
 * `_fixture: true` placeholders.
 */

export interface BusinessProfile {
  legalName: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  addressLines?: string[];
  supportEmail?: string;
}

export interface CheckoutRules {
  reservationTtlSeconds: number;
  codFeePaise: number;
}

const DEFAULT_CHECKOUT_RULES: CheckoutRules = {
  reservationTtlSeconds: 600,
  codFeePaise: 3000,
};

export interface ShippingPickup {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  stateName: string;
  stateCode: string;
  postcode: string;
  country: string;
}

export interface ShippingRules {
  pickup: ShippingPickup;
  /** Fallback per-parcel weight when a variant has no weight recorded. */
  defaultWeightGrams: number;
}

/** Clearly-labelled dev fixture; the owner confirms the real pickup before live. */
const DEFAULT_SHIPPING_RULES: ShippingRules = {
  pickup: {
    name: "The Pooja Edit (fixture)",
    phone: "+919999999999",
    line1: "Pickup address not configured",
    city: "New Delhi",
    stateName: "Delhi",
    stateCode: "07",
    postcode: "110001",
    country: "IN",
  },
  defaultWeightGrams: 400,
};

async function readSetting<T>(db: PrismaClient, key: string): Promise<T | null> {
  const row = await db.storeSettings.findUnique({ where: { key } });
  return row ? (row.value as T) : null;
}

export function getBusinessProfile(db: PrismaClient): Promise<BusinessProfile | null> {
  return readSetting<BusinessProfile>(db, "business.profile");
}

export async function getCheckoutRules(db: PrismaClient): Promise<CheckoutRules> {
  const v = await readSetting<Partial<CheckoutRules>>(db, "checkout.rules");
  return { ...DEFAULT_CHECKOUT_RULES, ...(v ?? {}) };
}

export async function getShippingRules(db: PrismaClient): Promise<ShippingRules> {
  const v = await readSetting<Partial<ShippingRules>>(db, "shipping.rules");
  return {
    pickup: { ...DEFAULT_SHIPPING_RULES.pickup, ...(v?.pickup ?? {}) },
    defaultWeightGrams:
      v?.defaultWeightGrams ?? DEFAULT_SHIPPING_RULES.defaultWeightGrams,
  };
}

/**
 * Home page copy (owner feedback, 2026-09-13 — "Pooja must be able to change
 * the home page's words … without either of us touching code"). Every word
 * on `/` used to be a literal string in `src/app/page.tsx`; it now lives here
 * under the `home.content` key, edited from `/admin/home`.
 */
export interface HomeContent {
  hero: {
    eyebrow: string;
    heading: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
  };
  editorial: { linkLabel: string };
  newIn: { eyebrow: string; heading: string; linkLabel: string };
  fromCloset: { eyebrow: string; heading: string; linkLabel: string };
  labelBlock: { heading: string; body: string; cta: string };
  closetBlock: { heading: string; body: string; cta: string };
  newsletter: { eyebrow: string; heading: string; body: string; buttonLabel: string };
  media: HomeMedia;
  sections: HomeSection[];
}

/**
 * Layout + media (owner follow-up, 2026-09-13 — "no option to edit the actual
 * pictures/video and layout of the home page"). Hero (the opening headline
 * block) is not a toggleable section — master spec §4 requires the homepage
 * to "immediately offer two clear catalog entrances", which lives there.
 */
export type HomeSectionKey =
  | "editorial"
  | "newIn"
  | "editBlocks"
  | "fromCloset"
  | "instagram"
  | "newsletter";

export interface HomeSection {
  key: HomeSectionKey;
  enabled: boolean;
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  { key: "editorial", enabled: true },
  { key: "newIn", enabled: true },
  { key: "editBlocks", enabled: true },
  { key: "fromCloset", enabled: true },
  { key: "instagram", enabled: true },
  { key: "newsletter", enabled: true },
];

/**
 * `kind: "auto"` is today's unchanged behaviour — the first rail item with a
 * photo. `"image"`/`"video"` is a deliberately uploaded override for this one
 * spot, independent of any product. A slot is a whole-object override: it is
 * never merged field-by-field with the default, only replaced or kept.
 */
export interface HomeMediaSlot {
  kind: "auto" | "image" | "video";
  bucket?: string;
  path?: string;
  url?: string;
  /** Video only — a still frame shown before playback / if video can't load. */
  posterUrl?: string;
  alt?: string;
}

export interface HomeMedia {
  editorial: HomeMediaSlot;
  labelBlock: HomeMediaSlot;
  closetBlock: HomeMediaSlot;
}

export const DEFAULT_HOME_MEDIA: HomeMedia = {
  editorial: { kind: "auto" },
  labelBlock: { kind: "auto" },
  closetBlock: { kind: "auto" },
};

// Word for word what was live on `/` before this setting existed — copied out
// of `page.tsx`, not retyped from memory. This is the fallback for a missing
// key AND the per-field fallback for a blank field, so the home page can
// never render an empty heading.
export const DEFAULT_HOME_CONTENT: HomeContent = {
  hero: {
    eyebrow: "The Pooja Edit · by Pooja Dugar",
    heading: "One brand, two ways to shop.",
    lead: "Realistic, wearable clothes, the same ones you see on my Instagram. Shop the Label for pieces I design in real sizes, or the Closet for one-off pieces from my own wardrobe. One bag, one checkout.",
    primaryCta: "Shop the Label",
    secondaryCta: "Shop the Closet",
  },
  editorial: { linkLabel: "Shop the piece" },
  newIn: { eyebrow: "New apparel", heading: "New in", linkLabel: "All new pieces" },
  fromCloset: {
    eyebrow: "Pre-loved",
    heading: "From the Closet",
    linkLabel: "All pre-loved",
  },
  labelBlock: {
    heading: "The Label",
    body: "Pooja's own designs — kurtis, co-ord sets and linen, made in real sizes and small runs.",
    cta: "View the collection",
  },
  closetBlock: {
    heading: "The Closet",
    body: "Pooja's own wardrobe, passed on. Every piece is one of one, listed with its condition, measurements and any flaws, so you know exactly what you're getting. When it's gone, it's gone.",
    cta: "Browse the rails",
  },
  newsletter: {
    eyebrow: "Newsletter",
    heading: "Get the drop list",
    body: "One email when new pieces and Closet restocks go live. No noise.",
    buttonLabel: "Notify me",
  },
  media: DEFAULT_HOME_MEDIA,
  sections: DEFAULT_HOME_SECTIONS,
};

/**
 * Deep-merges the saved value over the defaults **per field** (not per
 * section) — a blank or missing individual field falls back to its own
 * default instead of rendering an empty heading, per owner feedback.
 */
interface RawHomeContent extends Record<string, unknown> {
  hero?: Record<string, string>;
  editorial?: Record<string, string>;
  newIn?: Record<string, string>;
  fromCloset?: Record<string, string>;
  labelBlock?: Record<string, string>;
  closetBlock?: Record<string, string>;
  newsletter?: Record<string, string>;
  media?: Partial<Record<keyof HomeMedia, Partial<HomeMediaSlot>>>;
  sections?: Partial<HomeSection>[];
}

/** A media slot is replaced wholesale, not field-by-field — a saved `"auto"`
 * slot with a leftover `url` from a previous upload is still `"auto"`. */
function mergeMediaSlot(def: HomeMediaSlot, saved?: Partial<HomeMediaSlot>): HomeMediaSlot {
  if (!saved || (saved.kind !== "image" && saved.kind !== "video" && saved.kind !== "auto")) {
    return def;
  }
  if (saved.kind === "auto") return { kind: "auto" };
  return {
    kind: saved.kind,
    bucket: saved.bucket,
    path: saved.path,
    url: saved.url,
    posterUrl: saved.posterUrl,
    alt: saved.alt,
  };
}

/**
 * The saved order/enabled state wins wholesale (not merged per item) so
 * reordering and hiding both persist — but always reconciled against the
 * known section keys, so a bad/stale save can't crash the home page and a
 * section added after the save was made still appears (enabled, at the end)
 * instead of silently disappearing.
 */
function normalizeSections(saved?: Partial<HomeSection>[]): HomeSection[] {
  if (!Array.isArray(saved)) return DEFAULT_HOME_SECTIONS;
  const known = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.key));
  const seen = new Set<HomeSectionKey>();
  const out: HomeSection[] = [];
  for (const s of saved) {
    if (!s || typeof s.key !== "string" || !known.has(s.key as HomeSectionKey)) continue;
    const key = s.key as HomeSectionKey;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, enabled: s.enabled !== false });
  }
  for (const def of DEFAULT_HOME_SECTIONS) {
    if (!seen.has(def.key)) out.push({ ...def });
  }
  return out;
}

export async function getHomeContent(db: PrismaClient): Promise<HomeContent> {
  const v = await readSetting<RawHomeContent>(db, "home.content");
  const merge = <S extends Record<string, string>>(def: S, saved?: Partial<S>): S => {
    const out = { ...def };
    for (const k of Object.keys(def) as (keyof S)[]) {
      const val = saved?.[k];
      if (typeof val === "string" && val.trim() !== "") out[k] = val as S[keyof S];
    }
    return out;
  };
  return {
    hero: merge(DEFAULT_HOME_CONTENT.hero, v?.hero),
    editorial: merge(DEFAULT_HOME_CONTENT.editorial, v?.editorial),
    newIn: merge(DEFAULT_HOME_CONTENT.newIn, v?.newIn),
    fromCloset: merge(DEFAULT_HOME_CONTENT.fromCloset, v?.fromCloset),
    labelBlock: merge(DEFAULT_HOME_CONTENT.labelBlock, v?.labelBlock),
    closetBlock: merge(DEFAULT_HOME_CONTENT.closetBlock, v?.closetBlock),
    newsletter: merge(DEFAULT_HOME_CONTENT.newsletter, v?.newsletter),
    media: {
      editorial: mergeMediaSlot(DEFAULT_HOME_MEDIA.editorial, v?.media?.editorial),
      labelBlock: mergeMediaSlot(DEFAULT_HOME_MEDIA.labelBlock, v?.media?.labelBlock),
      closetBlock: mergeMediaSlot(DEFAULT_HOME_MEDIA.closetBlock, v?.media?.closetBlock),
    },
    sections: normalizeSections(v?.sections),
  };
}
