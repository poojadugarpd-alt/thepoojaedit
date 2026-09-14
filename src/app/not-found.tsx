import type { Metadata } from "next";
import Link from "next/link";

import { SEGMENT_BY_CATALOG } from "@/lib/catalog-routes";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/**
 * Next's own fallback for any unmatched route — was never overridden, so a
 * mistyped or dead link fell through to Next's bare default screen (found
 * during a full site pass, 2026-09-14). Root layout still wraps this (header,
 * announcement bar, footer), so only the content area needed building.
 */
export default function NotFound() {
  return (
    <div className="u-page py-14 sm:py-20">
      <div className="max-w-[62ch]">
        <p className="u-eyebrow">404</p>
        <h1 className="u-display mt-4">We can&rsquo;t find that page.</h1>
        <p className="u-lead mt-5">
          The link may be out of date, or the page may have moved. Try one of
          these instead.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href={`/${SEGMENT_BY_CATALOG.THE_POOJA_EDIT}`} className="u-pill">
            Shop the Label
          </Link>
          <Link href={`/${SEGMENT_BY_CATALOG.THRIFT}`} className="u-textlink">
            Shop the Closet
          </Link>
          <Link href="/search" className="u-textlink">
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
