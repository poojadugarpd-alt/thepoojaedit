import type { StylingPhoto } from "@/server/styling";

/**
 * Spreads the /styling gallery photos down the page in strips (owner,
 * 2026-11-28) instead of one carousel near the bottom.
 */

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
