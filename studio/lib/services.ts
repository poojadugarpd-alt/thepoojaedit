import { pricing, type PriceKey } from "./site";

// One page per service (/reels, /youtube, /carousels, /graphics), linked from the footer.
// Every answer here restates what the home page already promises; prices and turnaround come
// from lib/site.ts so they can't drift.

export type Faq = { q: string; a: string };

export type Service = {
  id: PriceKey;
  /** Search-result title (Google cuts at ~60 characters). */
  seoTitle: string;
  seoDescription: string;
  h1: string;
  /** Opening answer: what it is, who it's for, price and turnaround, in two sentences. */
  answer: string;
  includes: string[];
  samplesTitle: string;
  faqs: Faq[];
};

const p = pricing;

/** Questions that apply to every service. */
export const commonFaqs: Faq[] = [
  {
    q: "how do i send my footage?",
    a: "message me on whatsapp. send your raw clips, any reference videos, brand assets, captions and the music you'd like, and i'll confirm the plan before i start.",
  },
  {
    q: "how many revisions do i get?",
    a: "1–2 revisions are included on every order.",
  },
  {
    q: "can you edit from raw footage?",
    a: "yes. send what's in your camera roll and you get back a finished, platform-ready file.",
  },
  {
    q: "do you offer bulk or monthly pricing?",
    a: "yes, there are bulk discounts and monthly packages, and rush delivery is available. ask on whatsapp for a quote.",
  },
];

export const services: Record<PriceKey, Service> = {
  reels: {
    id: "reels",
    seoTitle: "Instagram Reel Editing Service from ₹200 | Pooja Dugar",
    seoDescription: `Instagram Reels edited for fashion and lifestyle creators and brands: captions, sound design and transitions. From ${p.reels.amount} ${p.reels.unit}, ready in ${p.reels.turnaround}.`,
    h1: "instagram reel editing",
    answer: `i edit instagram reels and shorts for fashion and lifestyle creators and brands, including brand reels, affiliate content and ugc. starter edits are ${p.reels.amount} ${p.reels.unit} and ready in ${p.reels.turnaround}.`,
    includes: ["editing & pacing", "captions", "sound design", "transitions", "platform-ready export for instagram & shorts"],
    samplesTitle: "reels i've edited",
    faqs: [
      {
        q: "what's the difference between a starter and a premium reel?",
        a: `${p.reels.amount} reels are starter edits. premium reels with advanced motion graphics, sound design, colour grading and stronger hook editing are quoted separately.`,
      },
      {
        q: "do you edit ugc and brand reels?",
        a: "yes. brand reels, affiliate content and ugc for brands are all part of the reel service.",
      },
    ],
  },
  youtube: {
    id: "youtube",
    seoTitle: "YouTube Video Editing Service from ₹1,000 | Pooja Dugar",
    seoDescription: `YouTube long-form editing with a custom thumbnail and Shorts clippings included. From ${p.youtube.amount} ${p.youtube.unit}, ready in ${p.youtube.turnaround}.`,
    h1: "youtube video editing",
    answer: `i edit long-form youtube videos with retention-focused pacing, and every video comes with a custom thumbnail and shorts clippings. it's ${p.youtube.amount} ${p.youtube.unit}, ready in ${p.youtube.turnaround}.`,
    includes: ["long-form edit", "custom thumbnail", "shorts clippings", "platform-ready export"],
    samplesTitle: "youtube videos i've edited",
    faqs: [
      {
        q: "is the thumbnail included?",
        a: "yes. every youtube edit includes a custom thumbnail and shorts clippings cut from the video.",
      },
    ],
  },
  carousels: {
    id: "carousels",
    seoTitle: "Instagram Carousel Design from ₹200 | Pooja Dugar",
    seoDescription: `Instagram carousels designed for education, branding and storytelling: slide design, captions and layout. From ${p.carousels.amount} ${p.carousels.unit}, ready in ${p.carousels.turnaround}.`,
    h1: "instagram carousel design",
    answer: `i design clean instagram carousels for education, branding and storytelling posts. a carousel is ${p.carousels.amount}, ready in ${p.carousels.turnaround}.`,
    includes: ["slide design", "captions", "layout", "platform-ready export"],
    samplesTitle: "carousels i've designed",
    faqs: [],
  },
  graphics: {
    id: "graphics",
    seoTitle: "Thumbnail & Social Graphic Design from ₹500 | Pooja Dugar",
    seoDescription: `Thumbnails, posters, social creatives and brand visuals, designed to match your brand. From ${p.graphics.amount} ${p.graphics.unit}, ready in ${p.graphics.turnaround}.`,
    h1: "graphic design",
    answer: `i design thumbnails, posters, social creatives and brand visuals that match your brand. a graphic is ${p.graphics.amount}, ready in ${p.graphics.turnaround}.`,
    includes: ["custom design", "brand-aligned layout", "export-ready files"],
    samplesTitle: "graphics i've designed",
    faqs: [],
  },
};

export const serviceIds = Object.keys(services) as PriceKey[];
export const isServiceId = (s: string): s is PriceKey => s in services;
