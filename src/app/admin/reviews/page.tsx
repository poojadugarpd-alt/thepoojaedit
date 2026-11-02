import Link from "next/link";

import type { ReviewSite, ReviewStatus } from "@/generated/prisma";
import { Pill, ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { REVIEW_STATUSES, listReviews } from "@/server/reviews";

import { ReviewTabs } from "./review-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

type Filter = ReviewStatus | "ALL";
const FILTERS: { value: Filter; label: string }[] = [
  ...REVIEW_STATUSES.map((s) => ({
    value: s as Filter,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
  { value: "ALL", label: "All" },
];
const SITE_LABEL: Record<ReviewSite, string> = {
  STYLING: "Styling",
  STUDIO: "Editing",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  await requireAdmin();
  const { status, site } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === status)
    ? (status as Filter)
    : "PENDING";
  const siteFilter: ReviewSite | undefined =
    site === "STYLING" || site === "STUDIO" ? site : undefined;
  const reviews = await listReviews(prisma, { status: filter, site: siteFilter });

  const q = (s: Filter, st?: ReviewSite) =>
    `/admin/reviews?status=${s}${st ? `&site=${st}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Reviews</h1>
      <ReviewTabs current="reviews" />
      <p className="text-sm text-ink">
        Nothing shows on the site until you approve it here. Email and WhatsApp numbers
        are private and never shown.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={q(f.value, siteFilter)}
            aria-current={f.value === filter ? "true" : undefined}
            className={`flex min-h-9 items-center rounded border px-3 text-sm ${
              f.value === filter
                ? "border-foreground bg-foreground text-background"
                : "border-line text-ink-strong"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by site">
        <Link
          href={q(filter)}
          className={`flex min-h-9 items-center rounded border px-3 text-sm ${!siteFilter ? "border-foreground" : "border-line"}`}
        >
          Both
        </Link>
        {(["STYLING", "STUDIO"] as const).map((s) => (
          <Link
            key={s}
            href={q(filter, s)}
            className={`flex min-h-9 items-center rounded border px-3 text-sm ${siteFilter === s ? "border-foreground" : "border-line"}`}
          >
            {SITE_LABEL[s]}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-[10px] border border-line p-4 text-sm text-ink-soft">
          {filter === "PENDING"
            ? "No reviews waiting. New ones appear here, and you get an email."
            : "Nothing here."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[10px] border border-line">
          {reviews.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reviews/${r.id}`}
                className="flex min-h-11 flex-col gap-1 p-3 hover:bg-fill"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="text-ink-strong">{r.displayName}</b>
                  <Pill value={r.status} />
                  <span className="text-ink-soft">
                    {SITE_LABEL[r.site]} · {r.service}
                    {r.rating ? ` · ${r.rating}/5` : ""}
                    {r.source === "INVITE" ? " · invited" : ""}
                  </span>
                </span>
                <span className="line-clamp-2 text-sm text-ink">{r.text}</span>
                <span className="text-xs text-ink-soft">{ts(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
