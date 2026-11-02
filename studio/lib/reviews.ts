// Client reviews live in the store's database (one Admin, one place to approve).
// The studio reads approved ones from the store's public API and posts new ones
// to it from the browser. See docs/review-system-plan-2026-11-02.md in the store.

export const REVIEWS_API = "https://thepoojaedit.in/api/reviews";

export interface StudioReview {
  id: string;
  service: string;
  rating: number | null;
  text: string;
  displayName: string;
  instagram: string | null;
  verified: boolean;
}

/** Approved editing reviews, refreshed every few minutes. Empty on any failure. */
export async function getStudioReviews(): Promise<StudioReview[]> {
  try {
    const res = await fetch(`${REVIEWS_API}?site=studio`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; reviews?: StudioReview[] };
    return data.ok && Array.isArray(data.reviews) ? data.reviews : [];
  } catch {
    return [];
  }
}
