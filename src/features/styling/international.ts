/**
 * "International Personal Shopping" on /styling (owner brief, 2026-11-27).
 * Copy is the owner's, so change facts (terms, dates, destinations) only
 * with her. Rendered by ./international-section.tsx.
 *
 * ── IMAGES ────────────────────────────────────────────────────────────────
 * Every `image` below is a placeholder (null). To add a photo:
 *   1. Save it as a JPG in  public/styling/international/  (e.g. vietnam.jpg).
 *      Square, around 1200×1200 px and under 300 KB is best; images are
 *      served as they are (next.config.ts has `unoptimized: true`).
 *   2. Set `image` to its path, e.g.  image: "/styling/international/vietnam.jpg"
 * A card without an image shows a plain sand panel with the destination name,
 * so the section looks finished either way.
 *
 * ── WHATSAPP ──────────────────────────────────────────────────────────────
 * No link to replace: every WhatsApp button uses Pooja's styling number from
 * ./whatsapp.ts with a pre-filled message naming the destination.
 *
 * ── TRIP DATES ────────────────────────────────────────────────────────────
 * Only a destination with a `trip` shows dates. Days are in India time. After
 * `listsBy` the card says lists are closed; after `ends` it reverts to a plain
 * "coming soon" card without dates, so an old trip never shows as live.
 */

export interface Trip {
  /** Shown as typed. */
  dates: string;
  /** Last day to send a list, YYYY-MM-DD (India time). */
  listsBy: string;
  /** Last day of the trip, YYYY-MM-DD (India time). */
  ends: string;
  headline: string;
  text: string;
}

export interface Destination {
  slug: string;
  name: string;
  /** [INSERT <NAME> DESTINATION IMAGE]: see IMAGES above. */
  image: string | null;
  alt: string;
  trip?: Trip;
}

export const DESTINATIONS: Destination[] = [
  {
    slug: "vietnam",
    name: "Vietnam",
    image: null, // [INSERT VIETNAM DESTINATION IMAGE]
    alt: "Vietnam shopping destinations curated by Pooja Dugar",
    trip: {
      dates: "10–26 December 2026",
      listsBy: "2026-12-08",
      ends: "2026-12-26",
      headline: "If you want to shop something from Vietnam, now is your chance.",
      text: "Make a list of all the items you need and send them over.",
    },
  },
  {
    slug: "singapore",
    name: "Singapore",
    image: null, // [INSERT SINGAPORE DESTINATION IMAGE]
    alt: "Singapore personal shopping destinations",
  },
  {
    slug: "dubai",
    name: "Dubai",
    image: null, // [INSERT DUBAI DESTINATION IMAGE]
    alt: "Dubai personal shopping destinations",
  },
  {
    slug: "china",
    name: "China",
    image: null, // [INSERT CHINA DESTINATION IMAGE]
    alt: "China personal shopping destinations",
  },
  {
    slug: "japan",
    name: "Japan",
    image: null, // [INSERT JAPAN DESTINATION IMAGE]
    alt: "Japan personal shopping destinations",
  },
];

/** [INSERT OPTIONAL LIFESTYLE OR SHOPPING IMAGE]: shown beside the intro when set. */
export const LIFESTYLE_IMAGE: { src: string; alt: string } | null = null;

export const INTERNATIONAL_OPTIONS = [
  {
    title: "Shop During My Trip",
    text: "If I am travelling to a destination, send me your shopping list. I can source pieces for you while I am there, share options for approval, and arrange delivery once I return.",
  },
  {
    title: "Travel With Me",
    text: "If you are planning a shopping trip, I can accompany you or shop independently on selected days. You arrange my travel and accommodation, and I create a personalised shopping plan around you.",
  },
];

export const SOURCE_LIST = [
  "Fashion and accessories",
  "Beauty and gifts",
  "Vintage and thrift finds",
  "Footwear and bags",
  "Boutique and local labels",
  "Picture-inspired pieces",
];

export const INTERNATIONAL_STEPS = [
  {
    title: "Send your list",
    text: "Share the items, references, budget, and delivery preferences on WhatsApp, email, or through the enquiry form on this page.",
  },
  {
    title: "Receive options",
    text: "I share 3–4 photo options for your approval before I buy anything.",
  },
  {
    title: "Approve quickly",
    text: "Please reply as soon as I share options, as shopping decisions may need to be made while I am at the store.",
  },
  {
    title: "Receive your pieces",
    text: "Delivery depends on the size and weight of the items. I may carry purchases in my luggage or arrange courier, local, or international shipping. Extra delivery costs are borne by the client.",
  },
];

export const GOOD_TO_KNOW = [
  "Minimum shopping budget: ₹10,000",
  "Minimum service fee: ₹2,000",
  "A partially refundable, adjustable advance is mandatory",
  "Booking or planning fee: up to ₹5,000",
  "The fee depends on the type of work and is discussed with each client",
  "Receipts and proof of purchase are provided",
  "High-value purchases may need a higher deposit or instant payment",
  "All sales are final; returns and exchanges are not accepted",
  "Currency conversion, bank, shipping, customs, duties, taxes, returns, and damage-related costs are borne by the client",
  "Items that are unavailable, damaged, incorrect, or cannot be shipped will not be entertained",
];

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export type TripState = "open" | "closed" | "none";

/** open: lists still accepted; closed: past the deadline, trip not over; none: no live trip. */
export function tripState(d: Destination, today: string = todayInIndia()): TripState {
  if (!d.trip || today > d.trip.ends) return "none";
  return today > d.trip.listsBy ? "closed" : "open";
}
