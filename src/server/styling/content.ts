import type { PrismaClient } from "@/generated/prisma";
import { storagePublicUrl } from "@/lib/storage-url";

/**
 * The Personal Styling page (`/styling`, D-162). Every word, the offers and
 * fees, the portrait and where enquiries are emailed live under the
 * `styling.content` setting, edited from /admin/styling/edit — same idea as
 * `home.content`. The page stays a 404 for shoppers until Pooja switches
 * `published` on, so a deploy can never show half-filled text.
 */

export interface StylingOffer {
  title: string;
  /** What's included — one point per line. */
  includes: string;
  /** Shown as typed, e.g. "₹4,000" or "Quote on request". */
  fee: string;
}

export interface StylingPortrait {
  bucket?: string;
  path?: string;
  url?: string;
  alt: string;
}

export interface StylingContent {
  published: boolean;
  eyebrow: string;
  heading: string;
  intro: string;
  offers: StylingOffer[];
  /** "How it works", one step per entry. */
  steps: string[];
  abroadNote: string;
  formHeading: string;
  formIntro: string;
  portrait: StylingPortrait | null;
  /** Where each new enquiry is emailed. */
  enquiryEmail: string;
  /** The optional home page block (Admin → Home → Layout → "Personal styling"). */
  homeBlock: { heading: string; body: string; cta: string };
  seoDescription: string;
}

export const MAX_OFFERS = 4;
export const MAX_STEPS = 5;
/** The service option shown after the offers in the enquiry form. */
export const NOT_SURE_SERVICE = "Not sure yet";

export const DEFAULT_STYLING_CONTENT: StylingContent = {
  published: false,
  eyebrow: "Personal styling",
  heading: "Styling and shopping, with me.",
  intro:
    "I help you put together a wardrobe that suits your life, your shape and your budget. We work through what you already own and shop only for what's missing.",
  offers: [],
  steps: [
    "Send an enquiry with a little about you and what you need.",
    "I reply within two days to set up a short call.",
    "We agree the plan and the fee before anything starts.",
    "We style, shop and sort it together.",
  ],
  abroadNote:
    "Living outside India? I work with clients abroad too, over video calls, and I can shop here and ship to you.",
  formHeading: "Send an enquiry",
  formIntro:
    "Tell me a little about what you're looking for. I reply to every enquiry.",
  portrait: null,
  enquiryEmail: "",
  homeBlock: {
    heading: "Personal styling",
    body: "Wardrobe edits and personal shopping with Pooja, in person or online.",
    cta: "How it works",
  },
  seoDescription:
    "Personal styling and shopping with Pooja Dugar: wardrobe edits, personal shopping and online styling, in India and for clients abroad.",
};

type Raw = Partial<Record<keyof StylingContent, unknown>>;

const text = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;

/** Text where blank is a real choice (no fallback to the default). */
const optional = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function normalizeOffers(v: unknown): StylingOffer[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((o) => ({
      title: optional((o as StylingOffer)?.title),
      includes: optional((o as StylingOffer)?.includes),
      fee: optional((o as StylingOffer)?.fee),
    }))
    .filter((o) => o.title !== "")
    .slice(0, MAX_OFFERS);
}

function normalizeSteps(v: unknown): string[] {
  if (!Array.isArray(v)) return DEFAULT_STYLING_CONTENT.steps;
  return v
    .map((s) => optional(s))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
}

function normalizePortrait(v: unknown): StylingPortrait | null {
  const p = v as Partial<StylingPortrait> | null | undefined;
  if (!p || typeof p !== "object" || (!p.path && !p.url)) return null;
  return {
    bucket: p.bucket,
    path: p.path,
    // Resolved from (bucket, path) at read time, like home media (D-135).
    url: p.bucket && p.path ? storagePublicUrl(p.bucket, p.path, p.url) : p.url,
    alt: optional(p.alt),
  };
}

/** Pure merge of a saved value over the defaults; exported for tests. */
export function resolveStylingContent(v: Raw | null): StylingContent {
  const d = DEFAULT_STYLING_CONTENT;
  const hb = (v?.homeBlock ?? {}) as Partial<StylingContent["homeBlock"]>;
  return {
    published: v?.published === true,
    eyebrow: text(v?.eyebrow, d.eyebrow),
    heading: text(v?.heading, d.heading),
    intro: text(v?.intro, d.intro),
    offers: normalizeOffers(v?.offers),
    steps: normalizeSteps(v?.steps),
    abroadNote: optional(v?.abroadNote ?? d.abroadNote),
    formHeading: text(v?.formHeading, d.formHeading),
    formIntro: text(v?.formIntro, d.formIntro),
    portrait: normalizePortrait(v?.portrait),
    enquiryEmail: optional(v?.enquiryEmail),
    homeBlock: {
      heading: text(hb.heading, d.homeBlock.heading),
      body: text(hb.body, d.homeBlock.body),
      cta: text(hb.cta, d.homeBlock.cta),
    },
    seoDescription: text(v?.seoDescription, d.seoDescription),
  };
}

export async function getStylingContent(db: PrismaClient): Promise<StylingContent> {
  const row = await db.storeSettings.findUnique({ where: { key: "styling.content" } });
  return resolveStylingContent((row?.value as Raw | undefined) ?? null);
}

/**
 * What still blocks publishing, in plain words. Empty = ready. Checked when
 * Pooja switches the page on, so shoppers never see a page with no offers or
 * an enquiry form that emails nobody.
 */
export function publishProblems(c: StylingContent): string[] {
  const problems: string[] = [];
  if (c.offers.length === 0) problems.push("Add at least one offer.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.enquiryEmail)) {
    problems.push("Add the email address enquiries should go to.");
  }
  return problems;
}

/** Service options in the enquiry form: each offer, then "Not sure yet". */
export function serviceOptions(c: StylingContent): string[] {
  return [...c.offers.map((o) => o.title), NOT_SURE_SERVICE];
}
