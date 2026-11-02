import { getShowcase } from "@/lib/content";
import { site, waLink } from "@/lib/site";
import { personJsonLd } from "@/lib/schema";
import {
  creatorBrands,
  type CreatorPageData,
  type CreatorSection,
} from "@/lib/creator-pages";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { ModalProvider } from "@/components/Media";
import { ReviewsBlock } from "@/components/ReviewsBlock";
import { WhatsAppIcon } from "@/components/icons";

/** Shared layout for the creator pages: split hero with real reels, proof band, plain sections. */
export async function CreatorPage({ pg }: { pg: CreatorPageData }) {
  const data = await getShowcase();
  // Three real posts for the hero: brand and UGC reels first, then any other real reel.
  const real = data.reels.filter((r) => !r.sample && r.thumbnailUrl);
  const preferred = real.filter(
    (r) => r.brand || r.category === "brand" || r.category === "ugc",
  );
  const heroReels = [...preferred, ...real.filter((r) => !preferred.includes(r))].slice(
    0,
    3,
  );

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
        <section className="cp-hero" aria-labelledby="page-title">
          <div>
            <p className="cp-kicker">{pg.kicker}</p>
            <h1 id="page-title" className="cp-h1">
              {pg.h1}
            </h1>
            <p className="cp-sub">{pg.heroSub}</p>
            <div className="cp-btns">
              <a
                className="btn btn-wa"
                href={waLink(pg.whatsappMessage)}
                target="_blank"
                rel="noopener"
              >
                <WhatsAppIcon size={18} /> talk on whatsapp
              </a>
              <a
                className="btn btn-ghost"
                href={site.instagramUrl}
                target="_blank"
                rel="noopener"
              >
                see {site.instagramHandle}
              </a>
            </div>
          </div>
          {heroReels.length > 0 && (
            <div className="cp-reels">
              {heroReels.map((r) => (
                <a
                  key={r.id}
                  className="cp-reel"
                  href={r.permalink}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Watch this reel on Instagram${r.brand ? `: ${r.brand}` : ""}`}
                >
                  <img
                    src={r.thumbnailUrl}
                    alt={`Reel by Pooja Dugar${r.brand ? ` for ${r.brand}` : ""}`}
                    loading="eager"
                    decoding="async"
                  />
                </a>
              ))}
            </div>
          )}
        </section>

        <div className="cp-shortwrap">
          <p className="cp-short">
            <strong>in short:</strong> {pg.answer}
          </p>
        </div>

        <section className="cp-sec blush" aria-label="proof">
          <div className="cp-in cp-proof">
            <div>
              <p className="cp-big">40k+</p>
              <p className="cp-big-cap">
                followers on{" "}
                <a
                  className="text-link"
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noopener"
                >
                  {site.instagramHandle}
                </a>
              </p>
            </div>
            <div>
              <p className="cp-text">videos made for</p>
              <ul className="cp-brands">
                {creatorBrands.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {pg.sections.map((s) => (
          <Section key={s.id} s={s} />
        ))}

        <ReviewsBlock tone="blush" />

        <section className="cp-sec" aria-labelledby="faq-title">
          <div className="cp-in">
            <h2 id="faq-title" className="cp-title">
              questions
            </h2>
            <dl className="cp-faq">
              {pg.faqs.map((f) => (
                <div key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="cp-cta" aria-label="contact">
          <p className="display display-sm">have footage in your camera roll?</p>
          <a
            className="btn btn-wa"
            href={waLink(pg.whatsappMessage)}
            target="_blank"
            rel="noopener"
          >
            <WhatsAppIcon size={18} /> chat on whatsapp
          </a>
        </section>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </ModalProvider>
  );
}

function Section({ s }: { s: CreatorSection }) {
  if (s.kind === "price") {
    return (
      <section className="cp-sec" aria-label="price">
        <div className="cp-in">
          <div className="cp-price">
            <p className="cp-big">
              <small>from</small>
              {s.from}
            </p>
            <ul>
              {s.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </div>
          {s.after && <p className="cp-text">{s.after}</p>}
        </div>
      </section>
    );
  }
  const tone = s.kind === "cards" ? " mist" : "";
  return (
    <section className={`cp-sec${tone}`} aria-labelledby={`${s.id}-title`}>
      <div className="cp-in">
        <h2 id={`${s.id}-title`} className="cp-title">
          {s.heading}
        </h2>
        {s.kind === "text" &&
          s.paras.map((para, i) => (
            <p key={i} className="cp-text">
              {para}
            </p>
          ))}
        {s.kind === "list" && (
          <ul className="cp-list">
            {s.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        {s.kind === "cards" && (
          <ol className="cp-cards">
            {s.items.map((i, n) => (
              <li key={n} className="cp-card">
                {i}
              </li>
            ))}
          </ol>
        )}
        {s.kind === "numbered" && (
          <ol className="cp-numbered">
            {s.items.map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
