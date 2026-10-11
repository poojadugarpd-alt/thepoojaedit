import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnquiryForm } from "@/features/styling/enquiry-form";
import { prisma } from "@/lib/db";
import { isSignedInAdmin } from "@/server/auth/require-admin";
import { getStylingContent, serviceOptions } from "@/server/styling";

// Content is edited live from admin, and a draft is shown to signed-in admins
// only — both need a per-request render.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getStylingContent(prisma);
  return {
    title: "Personal styling",
    description: c.seoDescription,
    alternates: { canonical: "/styling" },
    ...(c.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function StylingPage() {
  const c = await getStylingContent(prisma);
  // Not published: a 404 for shoppers; Pooja sees the draft to check it.
  if (!c.published && !(await isSignedInAdmin())) notFound();

  return (
    <div>
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
          <a href="#enquire" className="u-pill mt-10 inline-flex">
            {c.formHeading}
          </a>
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

      <section id="enquire" className="u-section u-rule scroll-mt-24">
        <div className="u-page max-w-2xl">
          <h2 className="u-h2">{c.formHeading}</h2>
          <p className="mt-4 text-ink">{c.formIntro}</p>
          <div className="mt-10">
            <EnquiryForm services={serviceOptions(c)} />
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
