import { site, waLink } from "@/lib/site";
import { personJsonLd } from "@/lib/schema";
import type { CreatorPageData } from "@/lib/creator-pages";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ModalProvider } from "@/components/Media";
import { WhatsAppIcon } from "@/components/icons";

/** Shared layout for the creator pages, matching /ugc and /pricing. */
export function CreatorPage({ pg }: { pg: CreatorPageData }) {
  const url = `${site.url}${pg.path}`;
  const main =
    pg.schemaType === "Article"
      ? {
          "@type": "Article",
          headline: pg.schemaName,
          description: pg.seoDescription,
          url,
          datePublished: pg.updated,
          dateModified: pg.updated,
          author: { "@id": personJsonLd()["@id"] },
          publisher: { "@id": `${site.url}#studio` },
          inLanguage: "en-IN",
        }
      : {
          "@type": "Service",
          name: pg.schemaName,
          serviceType: "Video editing",
          description: pg.answer,
          url,
          provider: { "@id": `${site.url}#studio` },
          areaServed: "IN",
        };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      main,
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
          { "@type": "ListItem", position: 2, name: pg.crumb, item: url },
        ],
      },
      personJsonLd(),
    ],
  };

  return (
    <ModalProvider>
      <PageHeader message={pg.whatsappMessage} />

      <main id="top">
        <section className="block service-hero" aria-labelledby="page-title">
          <div>
            <p className="kicker">{pg.kicker}</p>
            <h1 id="page-title" className="display display-md">
              {pg.h1}
            </h1>
            <p className="service-answer">{pg.answer}</p>
            <a className="btn btn-wa" href={waLink(pg.whatsappMessage)} target="_blank" rel="noopener">
              <WhatsAppIcon size={18} /> talk on whatsapp
            </a>
          </div>
        </section>

        {pg.sections.map((s) => (
          <section
            key={s.id}
            className={s.tone === "blush" ? "block blush" : "block"}
            aria-labelledby={`${s.id}-title`}
          >
            <h2 id={`${s.id}-title`} className="section-title">
              {s.heading}
            </h2>
            {s.body}
          </section>
        ))}

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
