/**
 * Page titles for search results. Google cuts titles at roughly 60
 * characters, so the " · The Pooja Edit" brand suffix (the root layout's
 * title template) is kept only when it fits; otherwise the title is returned
 * as `absolute` and the suffix dropped.
 */

export const BRAND_SUFFIX = " · The Pooja Edit";
export const TITLE_MAX = 60;

export type SeoTitle = string | { absolute: string };

/** `text` with the brand suffix when it fits, without it when it doesn't. */
export function withBrandIfFits(text: string): SeoTitle {
  return (text + BRAND_SUFFIX).length <= TITLE_MAX ? text : { absolute: text };
}

/**
 * Closet title: the piece, its size and "Pre-loved", so a search result says
 * what it is at a glance, e.g. "Zara Linen Shirt - White, Size M · Pre-loved".
 */
export function closetSeoTitle(title: string, size: string | null): SeoTitle {
  const sized = size ? `${title}, Size ${size}` : title;
  return withBrandIfFits(`${sized} · Pre-loved`);
}
