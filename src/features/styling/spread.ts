import type { StylingPhoto, StylingTestimonial } from "@/server/styling";

/**
 * Spreads the /styling photos and reviews down the page (owner, 2026-11-28)
 * instead of one carousel each near the bottom.
 *
 * Reviews: while there are only a few, each one is split into "moments", a
 * few of its own sentences beside one of its own photos, so a single review
 * with four photos fills four spots. The words are never changed, only split.
 * Once there are at least as many reviews as spots, each review takes one
 * spot whole, and any extras go in the carousel.
 */

export interface ReviewMoment {
  key: string;
  quote: string;
  photo: StylingPhoto | null;
  name: string;
  detail: string;
}

/** Splits text into sentences, keeping the closing punctuation. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Splits `items` into `n` runs of near-equal length, in order. */
function chunk<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const end = Math.round(((i + 1) * items.length) / n);
    out.push(items.slice(start, end));
    start = end;
  }
  return out.filter((c) => c.length > 0);
}

export function reviewMoments(
  reviews: StylingTestimonial[],
  slots: number,
): { moments: ReviewMoment[]; rest: StylingTestimonial[] } {
  const photo = (t: StylingTestimonial, i: number) =>
    t.photos.filter((p) => p.url)[i] ?? null;

  if (reviews.length >= slots) {
    return {
      moments: reviews.slice(0, slots).map((t) => ({
        key: t.id,
        quote: t.quote,
        photo: photo(t, 0),
        name: t.name,
        detail: t.detail,
      })),
      rest: reviews.slice(slots),
    };
  }

  // Fewer reviews than spots: share the spots out, then split each review
  // into as many moments as it has spots (capped by its photos and sentences).
  const moments: ReviewMoment[] = [];
  let left = slots;
  reviews.forEach((t, r) => {
    const fair = Math.ceil(left / (reviews.length - r));
    const parts = sentences(t.quote);
    const photos = t.photos.filter((p) => p.url).length;
    const n = Math.max(1, Math.min(fair, parts.length, Math.max(photos, 1)));
    chunk(parts, n).forEach((run, i) =>
      moments.push({
        key: `${t.id}-${i}`,
        quote: run.join(" "),
        photo: photo(t, i),
        name: t.name,
        detail: t.detail,
      }),
    );
    left -= n;
  });
  return { moments, rest: [] };
}

/** Splits gallery photos into bands of `size`, at most `bands` of them. */
export function photoBands(
  photos: StylingPhoto[],
  bands: number,
  size: number,
): { bands: StylingPhoto[][]; rest: StylingPhoto[] } {
  const shown = photos.filter((p) => p.url);
  const out: StylingPhoto[][] = [];
  for (let i = 0; i < bands && i * size < shown.length; i++) {
    out.push(shown.slice(i * size, (i + 1) * size));
  }
  return { bands: out, rest: shown.slice(bands * size) };
}
