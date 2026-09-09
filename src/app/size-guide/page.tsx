import type { Metadata } from "next";

import { LegalPage } from "@/features/site-content/legal-page";

export const metadata: Metadata = {
  title: "Size guide",
  description: "How our sizes run, and how to read the measurements on each piece.",
  alternates: { canonical: "/size-guide" },
};

export default function SizeGuidePage() {
  return (
    <LegalPage eyebrow="Help" title="Size guide" draft>
      <h2>The Pooja Edit (new apparel)</h2>
      <p>
        Pieces are cut to standard India sizing and generally run true to size.
        Where a piece runs small or is meant to be relaxed, it&rsquo;s noted on
        the product page under <strong>Fit &amp; length</strong>. Kurti and set
        lengths are listed there too.
      </p>
      <h2>Thrift Store (pre-loved)</h2>
      <p>
        Thrift pieces are one of one, so there is no size chart — go by the
        <strong> measurements</strong> on each product page. They&rsquo;re taken
        flat by the seller, in inches unless stated otherwise. Compare them to a
        garment you already own that fits the way you like.
      </p>
      <ul>
        <li><strong>Bust / chest</strong> — measured flat across, doubled for the full circumference.</li>
        <li><strong>Waist</strong> — narrowest point, flat, doubled.</li>
        <li><strong>Length</strong> — top of shoulder (or waistband) to hem.</li>
      </ul>
      <p className="text-ink-soft">
        A printable size chart with detailed body measurements is on the way.
      </p>
    </LegalPage>
  );
}
