import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/features/site-content/legal-page";

/**
 * Shipping / returns / privacy / terms. Text is adapted from the two legacy
 * stores and carries a "draft — pending review" banner; the owner reconciles it
 * (notably the two different return windows) before launch.
 */
const POLICIES = {
  shipping: {
    title: "Shipping",
    body: (
      <>
        <p>We ship across India.</p>
        <h2>The Label</h2>
        <p>
          Pieces are slow-made or made to order and currently ship in about
          5–10 business days.
        </p>
        <h2>The Closet</h2>
        <p>
          Pre-loved pieces are dispatched within about 2 working days of your
          order. Delivery time then depends on your location.
        </p>
        <h2>Charges &amp; payment</h2>
        <p>
          Shipping charges and serviceable pincodes are shown at checkout.
          We currently accept online payment only (UPI / card / netbanking) —
          cash on delivery isn&rsquo;t offered. Tracking is via Shadowfax.
        </p>
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
        <h2>The Label (new apparel)</h2>
        <ul>
          <li>
            Raise a return or exchange request within <strong>48 hours of
            delivery</strong> (Instagram DM, WhatsApp or email).
          </li>
          <li>
            Provide a <strong>complete, uncut unboxing video</strong> showing the
            sealed package being opened and the item clearly visible.
          </li>
          <li>
            Returns are accepted when the item is <strong>damaged, dirty,
            stained, or the wrong item</strong> was sent. Shipping charges are
            non-refundable. Refunds are processed after inspection.
          </li>
          <li>
            Exchanges are for size issues; the item must be unused, unwashed and
            tagged. Two-way shipping is paid by the customer.
          </li>
        </ul>
        <h2>The Closet (pre-loved, one of one)</h2>
        <ul>
          <li>
            Closet pieces are <strong>final sale</strong> — no returns or
            cancellations. Please read the condition, measurements and flaws
            carefully before buying.
          </li>
          <li>
            Damage-in-transit claims need a complete unboxing video and must be
            raised within <strong>2 days</strong> of delivery.
          </li>
        </ul>
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
            A cash-on-delivery order is confirmed by us before dispatch and is
            not treated as paid until delivery.
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
  return (
    <LegalPage eyebrow="Policy" title={p.title} draft>
      {p.body}
    </LegalPage>
  );
}
