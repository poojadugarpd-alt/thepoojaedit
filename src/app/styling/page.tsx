import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnquiryForm } from "@/features/styling/enquiry-form";
import { FaqList } from "@/features/styling/faq-list";
import { STYLING_LINKS, stylingFaqs, WHERE_I_WORK } from "@/features/styling/guides";
import { Rail } from "@/features/styling/rail";
import { prisma } from "@/lib/db";
import { personId } from "@/lib/organization-jsonld";
import { publicEnv } from "@/lib/public-env";
import { faqPageJsonLd, stylingServicesJsonLd } from "@/lib/styling-jsonld";
import { isSignedInAdmin } from "@/server/auth/require-admin";
import {
  getStylingContent,
  serviceOptions,
  visibleTestimonials,
  type StylingPhoto,
} from "@/server/styling";

// Content is edited live from admin, and a draft is shown to signed-in admins
// only — both need a per-request render.
export const dynamic = "force-dynamic";

/** Pooja's styling WhatsApp; wa.me wants the country code and digits only. */
const WHATSAPP_URL = `https://wa.me/919971572036?text=${encodeURIComponent(
  "Hi Pooja, I'd like to know more about personal styling.",
)}`;

export async function generateMetadata(): Promise<Metadata> {
  const c = await getStylingContent(prisma);
  return {
    // Search title chosen by the owner (2026-10-20); too long for the brand
    // suffix, so it's absolute. The on-page heading stays the admin's.
    title: { absolute: "Personal Stylist & Shopper in Delhi NCR | Pooja Dugar" },
    description: c.seoDescription,
    alternates: { canonical: "/styling" },
    ...(c.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function StylingPage() {
  const c = await getStylingContent(prisma);
  // Not published: a 404 for shoppers; Pooja sees the draft to check it.
  if (!c.published && !(await isSignedInAdmin())) notFound();
  const testimonials = visibleTestimonials(c);

  const base = publicEnv.NEXT_PUBLIC_SITE_URL;

  return (
    <div>
      {c.offers.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              stylingServicesJsonLd(c.offers, base, personId(base)),
            ),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            ...faqPageJsonLd(stylingFaqs),
          }),
        }}
      />
      {!c.published && (
        <p className="u-page pt-6">
          <span className="block rounded-[10px] border border-line bg-fill px-4 py-3 text-sm text-ink">
            Draft: only you can see this page. Switch it on in{" "}
            <Link href="/admin/styling/edit" className="underline underline-offset-2">
              Admin → Styling → Edit page
            </Link>{" "}
            when it&rsquo;s ready.
          </span>
        </p>
      )}

      <section className="u-page grid gap-10 pt-14 pb-16 sm:grid-cols-[1fr_minmax(0,24rem)] sm:items-end sm:pt-20 sm:pb-24">
        <div>
          <p className="u-eyebrow">{c.eyebrow}</p>
          <h1 className="u-display mt-6 max-w-[16ch]">{c.heading}</h1>
          <p className="u-lead mt-7 whitespace-pre-line">{c.intro}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#enquire" className="u-pill inline-flex">
              {c.formHeading}
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Connect Now on WhatsApp"
              className="u-pill u-pill--ghost inline-flex"
            >
              Connect Now
            </a>
          </div>
        </div>
        {c.portrait?.url && (
          <div className="u-media relative aspect-[4/5] overflow-hidden">
            <Image
              src={c.portrait.url}
              alt={c.portrait.alt || "Pooja Dugar"}
              fill
              priority
              sizes="(min-width: 640px) 24rem, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </section>

      {c.designs.length > 0 && (
        <section className="u-section u-rule" aria-labelledby="designs">
          <div className="u-page">
            <h2 id="designs" className="u-h2">
              {c.designsHeading}
            </h2>
            {c.designsIntro && (
              <p className="mt-4 max-w-[62ch] whitespace-pre-line text-ink">
                {c.designsIntro}
              </p>
            )}
            <div className="mt-10">
              <Rail count={c.designs.length} label="designs">
                {c.designs.map((p) => (
                  <figure key={p.id}>
                    <RailPhoto photo={p} fallbackAlt="A design by Pooja Dugar" />
                    {p.caption && (
                      <figcaption className="mt-3 text-sm text-ink">
                        {p.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </Rail>
            </div>
          </div>
        </section>
      )}

      {c.offers.length > 0 && (
        <section className="u-section u-section--fill" aria-labelledby="offers">
          <div className="u-page">
            <h2 id="offers" className="u-h2">
              What I offer
            </h2>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2">
              {c.offers.map((o) => (
                <li key={o.title} className="flex flex-col border-t border-line pt-6">
                  <h3 className="u-label">{o.title}</h3>
                  {o.includes && (
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-ink">
                      {o.includes
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                    </ul>
                  )}
                  {o.fee && <p className="mt-5 font-medium text-ink-strong">{o.fee}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Custom-made clothes: the section the custom-tailoring searches land on (SEO plan X1). */}
      <section
        id="custom"
        className="u-section u-rule scroll-mt-24"
        aria-labelledby="custom-heading"
      >
        <div className="u-page">
          <h2 id="custom-heading" className="u-h2">
            Custom-made Indian clothes, designed and tailored for you
          </h2>
          <div className="mt-6 max-w-[62ch] space-y-4 text-ink">
            <p>
              When the right piece doesn&rsquo;t exist, I make it. I&rsquo;m a fashion
              designer, so I can design an outfit for you from scratch or recreate one
              you&rsquo;ve seen. For other pieces I work with tailors and boutiques, and
              I manage the fittings and quality checks for you. Which route we take
              depends on the order, and I tell you before we start.
            </p>
            <p>
              Custom pieces are made to your measurements, whether you live in Delhi or
              abroad. You can send measurements from my guide, or measure a garment that
              fits you well and send me those. Pieces are fitted and checked here in
              India, then couriered to you if you live abroad.
            </p>
          </div>
          <h3 className="u-label mt-8">What I can make</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">
            <li>Indian ethnic wear and festive outfits designed to your measurements</li>
            <li>Wedding outfits made to measure</li>
            <li>Alterations to bought pieces so they fit before they ship</li>
            <li>Fittings and a final quality check on every piece</li>
          </ul>
          <p className="mt-6 font-medium text-ink-strong">Quote on request</p>
          <a href="#enquire" className="u-pill mt-6 inline-flex">
            Ask about a custom piece
          </a>
        </div>
      </section>

      {c.steps.length > 0 && (
        <section className="u-section u-rule" aria-labelledby="how">
          <div className="u-page">
            <h2 id="how" className="u-h2">
              How it works
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {c.steps.map((s, i) => (
                <li key={i}>
                  <span className="u-eyebrow">Step {i + 1}</span>
                  <p className="mt-3 text-ink">{s}</p>
                </li>
              ))}
            </ol>
            {c.abroadNote && (
              <p className="mt-12 max-w-[62ch] rounded-[10px] border border-line px-5 py-4 text-ink">
                {c.abroadNote}
              </p>
            )}
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="u-section u-section--fill" aria-labelledby="testimonials">
          <div className="u-page">
            <h2 id="testimonials" className="u-h2">
              {c.testimonialsHeading}
            </h2>
            <div className="mt-10">
              <Rail count={testimonials.length} label="testimonials">
                {testimonials.map((t) => (
                  <figure
                    key={t.id}
                    className="flex flex-col border-t border-line pt-6"
                  >
                    {t.photos.length === 1 && (
                      <RailPhoto
                        photo={t.photos[0] as StylingPhoto}
                        fallbackAlt={`${t.name}, styled by Pooja`}
                      />
                    )}
                    {t.photos.length > 1 && (
                      <div className="grid grid-cols-2 gap-2">
                        {t.photos.map((p) => (
                          <RailPhoto
                            key={p.id}
                            photo={p}
                            fallbackAlt={`${t.name}, styled by Pooja`}
                            square
                          />
                        ))}
                      </div>
                    )}
                    {t.quote && (
                      <blockquote
                        className={`whitespace-pre-line text-ink-strong ${t.photos.length > 0 ? "mt-5" : ""}`}
                      >
                        &ldquo;{t.quote}&rdquo;
                      </blockquote>
                    )}
                    <figcaption className="mt-4">
                      <span className="u-label block">{t.name}</span>
                      {t.detail && (
                        <span className="mt-1 block text-sm text-ink-soft">
                          {t.detail}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </Rail>
            </div>
          </div>
        </section>
      )}

      {c.gallery.length > 0 && (
        <section className="u-section u-rule" aria-label="Gallery">
          <div className="u-page">
            <Rail count={c.gallery.length} label="photos" compact>
              {c.gallery.map((p) => (
                <RailPhoto key={p.id} photo={p} fallbackAlt="Styled by Pooja Dugar" />
              ))}
            </Rail>
          </div>
        </section>
      )}

      {/* Where she works, the guide pages and the questions (D-175). */}
      <section className="u-section u-rule" aria-labelledby="questions">
        <div className="u-page">
          <p className="max-w-[62ch] text-ink">{WHERE_I_WORK}</p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {STYLING_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="u-pill u-pill--ghost inline-flex">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <h2 id="questions" className="u-h2 mt-16">
            Questions
          </h2>
          <FaqList faqs={stylingFaqs} />
        </div>
      </section>

      <section id="enquire" className="u-section u-rule scroll-mt-24">
        <div className="u-page max-w-2xl">
          <h2 className="u-h2">{c.formHeading}</h2>
          <p className="mt-4 text-ink">{c.formIntro}</p>
          <div className="mt-10">
            <EnquiryForm services={serviceOptions(c)} whatsappUrl={WHATSAPP_URL} />
          </div>
          <p className="mt-10 text-sm text-ink-soft">
            Want to know more about me first?{" "}
            <Link href="/about" className="underline underline-offset-2">
              Read about Pooja
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

function RailPhoto({
  photo,
  fallbackAlt,
  square = false,
}: {
  photo: StylingPhoto;
  fallbackAlt: string;
  square?: boolean;
}) {
  if (!photo.url) return null;
  return (
    <div
      className={`u-media relative overflow-hidden ${square ? "aspect-square" : "aspect-[4/5]"}`}
    >
      <Image
        src={photo.url}
        alt={photo.alt || fallbackAlt}
        fill
        sizes={
          square ? "(min-width: 640px) 150px, 39vw" : "(min-width: 640px) 300px, 78vw"
        }
        className="object-cover"
      />
    </div>
  );
}
