import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/site-content/legal-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach The Pooja Edit — by Pooja Dugar.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage eyebrow="Help" title="Contact" draft>
      <p>
        The fastest way to reach us is a direct message on Instagram —{" "}
        <a href="https://www.instagram.com/poojadugar_/" target="_blank" rel="noreferrer noopener">
          @poojadugar_
        </a>
        . We usually reply within a day.
      </p>
      <h2>Order questions</h2>
      <p>
        Have your order number ready (it starts with <code>PE-</code>). For a
        delivery or payment issue, include the number and a short description.
      </p>
      <h2>Returns &amp; exchanges</h2>
      <p>
        See <Link href="/policies/returns-exchanges">Returns &amp; exchanges</Link>.
        Raise any request within the window stated there and keep a complete,
        uncut unboxing video.
      </p>
      <p className="text-ink-soft">
        A dedicated support email and phone number will be added here.
      </p>
    </LegalPage>
  );
}
