import { pricing, type PriceKey } from "./site";

// Services presented as shop products. Prices come from lib/site.ts.

export type Product = {
  id: PriceKey;
  name: string;
  tagline: string;
  price: number;
  unit: string;
  badge?: string;
  includes: string[];
  turnaround: string;
  /** Which tab of the work gallery shows examples. */
  workTab: string;
};

const rupees = (s: string) => Number(s.replace(/[^\d]/g, ""));

export const products: Product[] = [
  {
    id: "reels",
    name: "instagram reel edit",
    tagline: "scroll-stopping reels, branded edits, affiliate content & ugc.",
    price: rupees(pricing.reels.amount),
    unit: pricing.reels.unit,
    badge: "best seller",
    includes: ["editing & pacing", "captions", "sound design", "transitions", "platform-ready export"],
    turnaround: pricing.reels.turnaround,
    workTab: "reels",
  },
  {
    id: "youtube",
    name: "youtube long-form edit",
    tagline: "retention-focused edits with a thumbnail and shorts clippings included.",
    price: rupees(pricing.youtube.amount),
    unit: pricing.youtube.unit,
    badge: "includes shorts",
    includes: ["long-form edit", "thumbnail design", "shorts clippings", "platform-ready export"],
    turnaround: pricing.youtube.turnaround,
    workTab: "youtube",
  },
  {
    id: "carousels",
    name: "instagram carousel",
    tagline: "clean, high-converting carousels for education, branding & storytelling.",
    price: rupees(pricing.carousels.amount),
    unit: pricing.carousels.unit,
    includes: ["slide design", "captions", "layout", "platform-ready export"],
    turnaround: pricing.carousels.turnaround,
    workTab: "carousels",
  },
  {
    id: "graphics",
    name: "graphic design",
    tagline: "thumbnails, posters, social creatives & brand visuals that get attention.",
    price: rupees(pricing.graphics.amount),
    unit: pricing.graphics.unit,
    badge: "new",
    includes: ["custom design", "brand-aligned layout", "export-ready files"],
    turnaround: pricing.graphics.turnaround,
    workTab: "graphics",
  },
];

export const productById = Object.fromEntries(products.map((p) => [p.id, p])) as Record<PriceKey, Product>;

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
