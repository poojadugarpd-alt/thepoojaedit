import type { ReelCategory } from "./types";

// Heuristic categoriser for Instagram captions. The Graph API does not expose the
// "Paid partnership" label for your own media, so we read the disclosure text that
// creators are required to add (#ad, #collab, "paid partnership", etc.).
// Any item can be overridden in content/instagram-overrides.json.

const AFFILIATE = [
  /\baffiliate\b/i,
  /\blink in (my )?bio\b/i,
  /\buse (my )?code\b/i,
  /\bdiscount code\b/i,
  /\bcode[:\s]+[A-Z0-9]{4,}\b/,
  /\bcommission\b/i,
  /\bamzn\.to\b|\bmyntr\.it\b|\bbitli\.in\b|\bwishlink\b|\bfktr\.in\b|\bajiio\.in\b/i,
  /🔗/,
];

const BRAND = [
  /paid partnership/i,
  /#ad\b/i,
  /#sponsored\b/i,
  /#collab(oration)?\b/i,
  /#partner(ship)?\b/i,
  /\bin collaboration with\b/i,
  /\bsponsored by\b/i,
  /\bgifted\b/i,
  /#pr\b/i,
];

const UGC = [
  /#ugc\b/i,
  /\bugc\b/i,
  /\bunboxing\b/i,
  /\breview\b/i,
  /\btry[\s-]?on\b/i,
  /\bhonest (review|opinion)\b/i,
  /\btestimonial\b/i,
  /\bdemo\b/i,
  /\bhaul\b/i,
];

export function categorize(caption: string, isCarousel: boolean): ReelCategory {
  if (isCarousel) return "carousel";
  if (BRAND.some((r) => r.test(caption))) return "brand";
  if (AFFILIATE.some((r) => r.test(caption))) return "affiliate";
  if (UGC.some((r) => r.test(caption))) return "ugc";
  // Default: most work on this account is brand-facing content.
  return "brand";
}

const CAROUSEL_LABELS: [string, RegExp][] = [
  ["Brand", /paid partnership|#ad\b|#collab|sponsored|gifted/i],
  ["Promotional", /\bsale\b|\boffer\b|\bdiscount\b|\blaunch\b|% off/i],
  ["Educational", /\btips?\b|\bhow to\b|\bguide\b|\bsteps?\b|\bmistakes\b|\blearn\b/i],
  ["UGC", /#ugc\b|\breview\b|\bunboxing\b/i],
];

export function carouselLabel(caption: string): string {
  for (const [label, re] of CAROUSEL_LABELS) if (re.test(caption)) return label;
  return "Lifestyle";
}

/** Brand = first @mention in the caption, if any. */
export function detectBrand(caption: string): string | undefined {
  const m = caption.match(/@([a-z0-9._]{2,30})/i);
  return m ? `@${m[1]}` : undefined;
}
