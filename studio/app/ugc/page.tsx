import type { Metadata } from "next";
import { getShowcase } from "@/lib/content";
import { site, waLink } from "@/lib/site";
import { ugcPage as pg } from "@/lib/pages";
import { personJsonLd } from "@/lib/schema";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { InstagramCard, ModalProvider } from "@/components/Media";
import { WhatsAppIcon } from "@/components/icons";

// Same hourly refresh as the home page, so the brand Reels stay current.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: pg.seoTitle },
  description: pg.seoDescription,
  alternates: { canonical: "/ugc" },
  // Setting openGraph here replaces the root's, so restate the share image.
  openGraph: {
    title: pg.seoTitle,
    description: pg.seoDescription,
    url: "/ugc",
    type: "website",
    locale: "en_IN",
    images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
  },
};

const message = "Hi Pooja! I'd like to talk about brand / UGC videos.";

/** "a, b and c" */
function listOf(names: string[]) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export default async function UgcPage() {
  const data = await getShowcase();
  // Brand, UGC and tagged-brand Reels: the work brands care about.
  const reels = data.reels.filter(
    (r) => !r.sample && r.thumbnailUrl && (r.brand || r.category === "brand" || r.category === "ugc"),
  );
  const brands = [...new Set(reels.flatMap((r) => (r.brand ? [r.brand] : [])))];
  const answer = brands.length > 0 ? `${pg.answer} i've edited for ${listOf(brands)}.` : pg.answer;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "UGC and brand video editing",
        serviceType: "Video editing",
        description: answer,
        url: `${site.url}/ugc`,
        provider: { "@id": `${site.url}#studio` },
        areaServed: "IN",
      },
      {
        "@type": "FAQPage",
        mainEntity: pg.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.studio, item: site.url },
          { "@type": "ListItem", position: 2, name: "ugc and brand videos", item: `${site.url}/ugc` },
        ],
      },
      personJsonLd(),
    ],
  };

  return (
    <ModalProvider>
      <PageHeader message={message} />

      <main id="top">
        <section className="block service-hero" aria-labelledby="ugc-title">
          <div>
            <p className="kicker">for brands · shoot + edit</p>
            <h1 id="ugc-title" className="display display-md">
              {pg.h1}
            </h1>
            <p className="service-answer">{answer}</p>
            <ul className="service-includes">
              {pg.edits.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <a className="btn btn-wa" href={waLink(message)} target="_blank" rel="noopener">
              <WhatsAppIcon size={18} /> talk on whatsapp
            </a>
          </div>
        </section>

        {reels.length > 0 && (
          <section className="block blush" aria-labelledby="samples-title">
            <h2 id="samples-title" className="section-title">
              brand reels i&rsquo;ve edited
            </h2>
            <div className="grid grid-reels">
              {reels.map((r, i) => (
                <InstagramCard key={r.id} item={r} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="block" aria-labelledby="why-title">
          <h2 id="why-title" className="section-title">
            why a fashion creator edits better fashion videos
          </h2>
          <p className="service-answer">{pg.why}</p>
          <h2 className="section-title page-subhead">price</h2>
          <p className="service-answer">
            {pg.price}{" "}
            <a className="text-link" href="/pricing">
              all prices
            </a>
            .
          </p>
        </section>

        <section className="block blush" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">
            questions
          </h2>
          <dl className="faq">
            {pg.faqs.map((f) => (
              <div key={f.q} className="faq-item">
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </ModalProvider>
  );
}
