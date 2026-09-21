import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/features/site-content/legal-page";

/**
 * Shipping / returns / privacy / terms. Text is adapted from the two legacy
 * stores and carries a "draft — pending review" banner. 2026-09-21: reconciled
 * the two return windows (Label 48h / Closet 2 days were the same duration,
 * just inconsistently worded — unified to 48 hours), removed a stale COD
 * mention on `terms` left over from D-90 (COD turned off at checkout), and
 * confirmed the refund turnaround (owner: 14 days from the return request,
 * not from inspection) — `returns-exchanges` now also carries FAQPage
 * JSON-LD alongside `shipping`.
 */
/**
 * Plain-text Q&A pairs, the single source of truth for both the visible
 * shipping page and its FAQPage JSON-LD (see `shippingFaqJsonLd` below) —
 * kept as plain strings, not JSX, specifically so the two can never drift
 * apart.
 */
const SHIPPING_FAQ: { q: string; a: string }[] = [
  { q: "Do you ship across India?", a: "Yes — we ship across India." },
  {
    q: "How long does The Label take to ship?",
    a: "The Label pieces are slow-made or made to order and currently ship in about 5–10 business days.",
  },
  {
    q: "How long does The Closet take to ship?",
    a: "The Closet (pre-loved) pieces are dispatched within about 2 working days of your order; delivery time then depends on your location.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We currently accept online payment only (UPI / card / netbanking) — cash on delivery isn't offered.",
  },
  {
    q: "How can I track my order?",
    a: "Tracking is via Shadowfax. Shipping charges and serviceable pincodes are shown at checkout.",
  },
];

/**
 * Same single-source-of-truth pattern as `SHIPPING_FAQ`, grouped by catalogue
 * for display (`section`) but flattened for `FAQPage` JSON-LD.
 */
const RETURNS_FAQ: { section: string; q: string; a: string }[] = [
  {
    section: "The Label (new apparel)",
    q: "Can I return or exchange a Label item?",
    a: "Yes. Raise a return or exchange request within 48 hours of delivery via Instagram DM, WhatsApp or email, with a complete, uncut unboxing video showing the sealed package being opened and the item clearly visible.",
  },
  {
    section: "The Label (new apparel)",
    q: "When are Label returns accepted?",
    a: "Returns are accepted when the item is damaged, dirty, stained, or the wrong item was sent. Shipping charges are non-refundable.",
  },
  {
    section: "The Label (new apparel)",
    q: "How long do Label refunds take?",
    a: "Refunds are processed within 14 days of your return request.",
  },
  {
    section: "The Label (new apparel)",
    q: "Can I exchange a Label item for a different size?",
    a: "Yes — exchanges are accepted for size issues. The item must be unused, unwashed and tagged. Two-way shipping is paid by the customer.",
  },
  {
    section: "The Closet (pre-loved, one of one)",
    q: "Can I return a Closet item?",
    a: "No — Closet pieces are final sale, with no returns or cancellations. Please read the condition, measurements and flaws carefully before buying.",
  },
  {
    section: "The Closet (pre-loved, one of one)",
    q: "What if my Closet item arrives damaged in transit?",
    a: "Damage-in-transit claims need a complete unboxing video and must be raised within 48 hours of delivery.",
  },
];

const POLICIES = {
  shipping: {
    title: "Shipping",
    body: (
      <>
        {SHIPPING_FAQ.map(({ q, a }) => (
          <div key={q}>
            <h2>{q}</h2>
            <p>{a}</p>
          </div>
        ))}
      </>
    ),
  },
  "returns-exchanges": {
    title: "Returns & exchanges",
    body: (
      <>
        <p>
          Return rules differ by catalogue, and each item shows its own on the
          product page and in your cart.
        </p>
        {(["The Label (new apparel)", "The Closet (pre-loved, one of one)"] as const).map(
          (section) => (
            <div key={section}>
              <h2>{section}</h2>
              {RETURNS_FAQ.filter((item) => item.section === section).map(({ q, a }) => (
                <div key={q}>
                  <h3>{q}</h3>
                  <p>{a}</p>
                </div>
              ))}
            </div>
          ),
        )}
      </>
    ),
  },
  privacy: {
    title: "Privacy",
    body: (
      <>
        <p>
          We collect only what we need to fulfil an order: your name, delivery
          address, phone number and (if you give it) email. Payment is handled
          by Razorpay — we never see or store your card or UPI details.
        </p>
        <p>
          We use your contact details to send order and delivery updates. We
          don&rsquo;t sell your data. Shipping details are shared with our
          courier (Shadowfax) to deliver your order.
        </p>
        <p>
          To ask what we hold about you, or to have it deleted, message{" "}
          <a href="https://www.instagram.com/poojadugar_/" target="_blank" rel="noreferrer noopener">
            @poojadugar_
          </a>
          .
        </p>
      </>
    ),
  },
  terms: {
    title: "Terms of service",
    body: (
      <>
        <p>
          By placing an order you confirm the details you provide are accurate
          and that you&rsquo;ve read the item&rsquo;s description, price and
          return policy.
        </p>
        <ul>
          <li>
            Prices are in Indian Rupees and shown inclusive of taxes where
            applicable. The price, shipping and any fees are confirmed at
            checkout before payment.
          </li>
          <li>
            Adding an item to your cart does not reserve it. Stock is only held
            briefly after a prepaid order is placed.
          </li>
          <li>
            All orders are prepaid — we accept online payment only (UPI /
            card / netbanking). Cash on delivery isn&rsquo;t offered.
          </li>
          <li>
            Closet pieces are sold as described, one of one, and final sale.
          </li>
        </ul>
        <p className="text-ink-soft">
          Full legal terms and the registered business details will be added
          here.
        </p>
      </>
    ),
  },
} as const;

type Slug = keyof typeof POLICIES;

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

const FAQ_BY_SLUG: Partial<Record<Slug, { q: string; a: string }[]>> = {
  shipping: SHIPPING_FAQ,
  "returns-exchanges": RETURNS_FAQ,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES[slug as Slug];
  if (!p) return { title: "Not found", robots: { index: false } };
  return { title: p.title, alternates: { canonical: `/policies/${slug}` } };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = POLICIES[slug as Slug];
  if (!p) notFound();
  const faq = FAQ_BY_SLUG[slug as Slug];
  return (
    <>
      {faq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }}
        />
      )}
      <LegalPage eyebrow="Policy" title={p.title} draft>
        {p.body}
      </LegalPage>
    </>
  );
}
