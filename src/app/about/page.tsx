import type { Metadata } from "next";

import { LegalPage } from "@/features/site-content/legal-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "The Pooja Edit — realistic, wearable clothes by Pooja Dugar. The Label for pieces she designs, and The Closet for one-of-one pieces from her own wardrobe.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalPage eyebrow="About" title="One brand, two ways to shop." draft>
      <p>
        The Label is Pooja&rsquo;s own designs — kurtis, co-ord sets and linen,
        made in real sizes and small runs.
      </p>
      <p>
        The Closet is Pooja&rsquo;s own wardrobe, passed on. Every piece is one
        of one, listed with its condition, measurements and any flaws, so you
        know exactly what you&rsquo;re getting. When it&rsquo;s gone, it&rsquo;s
        gone.
      </p>
      <p>
        One cart holds both. Each item keeps its own return policy, shown at
        checkout.
      </p>
      <p>
        Most of what we make and find is shared first on Instagram at{" "}
        <a href="https://www.instagram.com/poojadugar_/" target="_blank" rel="noreferrer noopener">
          @poojadugar_
        </a>
        .
      </p>
    </LegalPage>
  );
}
