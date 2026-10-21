import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FaqList } from "@/features/styling/faq-list";
import {
  getGuide,
  guides,
  STYLING_LINKS,
  type GuideSection,
} from "@/features/styling/guides";
import { prisma } from "@/lib/db";
import { personId } from "@/lib/organization-jsonld";
import { publicEnv } from "@/lib/public-env";
import { stylingGuideJsonLd } from "@/lib/styling-jsonld";
import { isSignedInAdmin } from "@/server/auth/require-admin";
import {
  getStylingContent,
  visibleTestimonials,
  type StylingContent,
} from "@/server/styling";

// Fees and testimonials come live from Admin → Styling, and the guides follow
// /styling's published switch, so this renders per request like /styling.
export const dynamic = "force-dynamic";
export const dynamicParams = false;

type Params = { params: Promise<{ guide: string }> };

export function generateStaticParams() {
  return guides.map((g) => ({ guide: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const g = getGuide((await params).guide);
  if (!g) return {};
  const c = await getStylingContent(prisma);
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: `/styling/${g.slug}` },
    ...(c.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function StylingGuidePage({ params }: Params) {
  const g = getGuide((await params).guide);
  if (!g) notFound();
  const c = await getStylingContent(prisma);
  // Same rule as /styling: a 404 for shoppers until Pooja publishes it.
  if (!c.published && !(await isSignedInAdmin())) notFound();

  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const others = STYLING_LINKS.filter((l) => l.href !== `/styling/${g.slug}`);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(stylingGuideJsonLd(g, base, personId(base))),
        }}
      />

      <section className="u-page pt-14 pb-16 sm:pt-20 sm:pb-20">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
          <Link href="/styling" className="underline underline-offset-2">
            Personal styling
          </Link>{" "}
          / {g.name}
        </nav>
        <p className="u-eyebrow mt-8">{g.eyebrow}</p>
        <h1 className="u-h2 mt-5 max-w-[24ch]">{g.h1}</h1>
        <p className="u-lead mt-7 max-w-[62ch]">{g.answer}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/styling#enquire" className="u-pill inline-flex">
            Send an enquiry
          </Link>
        </div>
      </section>

      {g.sections.map((s, i) => (
        <Section key={s.heading} section={s} content={c} fill={i % 2 === 0} />
      ))}

      <section className="u-section u-rule" aria-labelledby="questions">
        <div className="u-page">
          <h2 id="questions" className="u-h2">
            Questions
          </h2>
          <FaqList faqs={g.faqs} />
        </div>
      </section>

      <section className="u-section u-section--fill">
        <div className="u-page">
          <h2 className="u-h2">Ready to start?</h2>
          <p className="mt-4 max-w-[62ch] text-ink">
            Send me an enquiry with a little about you and what you need. I reply to
            every one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/styling#enquire" className="u-pill inline-flex">
              Send an enquiry
            </Link>
          </div>
          <p className="mt-10 text-sm text-ink-soft">
            Also:{" "}
            {others.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link href={l.href} className="underline underline-offset-2">
                  {l.label}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </section>
    </div>
  );
}

function Section({
  section: s,
  content: c,
  fill,
}: {
  section: GuideSection;
  content: StylingContent;
  fill: boolean;
}) {
  const id = s.heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const testimonials = s.kind === "testimonials" ? visibleTestimonials(c) : [];
  if (s.kind === "testimonials" && testimonials.every((t) => !t.quote)) return null;
  if (s.kind === "fees" && c.offers.length === 0) return null;

  return (
    <section
      className={`u-section ${fill ? "u-section--fill" : "u-rule"}`}
      aria-labelledby={id}
    >
      <div className="u-page">
        <h2 id={id} className="u-h2 max-w-[30ch]">
          {s.heading}
        </h2>

        {s.kind === "text" && (
          <div className="mt-8 grid max-w-[65ch] gap-4 text-ink">
            {s.paras.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.link && (
              <p>
                <Link href={s.link.href} className="underline underline-offset-2">
                  {s.link.label}
                </Link>
              </p>
            )}
          </div>
        )}

        {s.kind === "list" && (
          <>
            <ul className="mt-8 grid max-w-[65ch] list-disc gap-2 pl-5 text-ink">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {s.after && <p className="mt-6 max-w-[65ch] text-ink">{s.after}</p>}
          </>
        )}

        {s.kind === "steps" && (
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((item, i) => (
              <li key={item}>
                <span className="u-eyebrow">Step {i + 1}</span>
                <p className="mt-3 text-ink">{item}</p>
              </li>
            ))}
          </ol>
        )}

        {s.kind === "fees" && (
          <>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2">
              {c.offers.map((o) => (
                <li key={o.title} className="flex flex-col border-t border-line pt-6">
                  <h3 className="u-label">{o.title}</h3>
                  {o.includes && (
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-ink">
                      {o.includes
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                    </ul>
                  )}
                  {o.fee && <p className="mt-4 font-medium text-ink-strong">{o.fee}</p>}
                </li>
              ))}
            </ul>
            {s.extra && <p className="mt-8 max-w-[65ch] text-ink">{s.extra}</p>}
            {s.after && <p className="mt-4 max-w-[65ch] text-ink">{s.after}</p>}
          </>
        )}

        {s.kind === "testimonials" && (
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {testimonials
              .filter((t) => t.quote)
              .map((t) => (
                <figure key={t.id} className="border-t border-line pt-6">
                  <blockquote className="whitespace-pre-line text-ink-strong">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
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
          </div>
        )}
      </div>
    </section>
  );
}
