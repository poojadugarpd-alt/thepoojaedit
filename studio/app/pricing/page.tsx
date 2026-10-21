import type { Metadata } from "next";
import { pricing, site, waLink } from "@/lib/site";
import { priceRows, pricingPage as pg } from "@/lib/pages";
import { personJsonLd } from "@/lib/schema";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { WhatsAppIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: { absolute: pg.seoTitle },
  description: pg.seoDescription,
  alternates: { canonical: "/pricing" },
  // Setting openGraph here replaces the root's, so restate the share image.
  openGraph: {
    title: pg.seoTitle,
    description: pg.seoDescription,
    url: "/pricing",
    type: "website",
    locale: "en_IN",
    images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
  },
};

const message = "Hi Pooja! I'd like a price for some editing.";

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
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
          { "@type": "ListItem", position: 2, name: "pricing", item: `${site.url}/pricing` },
        ],
      },
      personJsonLd(),
    ],
  };

  return (
    <>
      <PageHeader message={message} />

      <main id="top">
        <section className="block service-hero" aria-labelledby="pricing-title">
          <div>
            <p className="kicker">prices · 2026</p>
            <h1 id="pricing-title" className="display display-md">
              {pg.h1}
            </h1>
            <p className="service-answer">{pg.answer}</p>
            <a className="btn btn-wa" href={waLink(message)} target="_blank" rel="noopener">
              <WhatsAppIcon size={18} /> ask on whatsapp
            </a>
          </div>
        </section>

        <section className="block blush" aria-labelledby="rates-title">
          <h2 id="rates-title" className="section-title">
            my rates
          </h2>
          <div className="price-table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th scope="col">service</th>
                  <th scope="col">price</th>
                  <th scope="col">ready in</th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((k) => (
                  <tr key={k}>
                    <th scope="row">
                      <a className="text-link" href={`/${k}`}>
                        {pricing[k].service.toLowerCase()}
                      </a>
                    </th>
                    <td>
                      {pricing[k].amount} {pricing[k].unit}
                    </td>
                    <td>{pricing[k].turnaround}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="service-answer page-note">every order includes 1–2 revisions.</p>
        </section>

        <section className="block" aria-labelledby="drivers-title">
          <h2 id="drivers-title" className="section-title">
            what changes the price of an edit
          </h2>
          <ul className="page-list">
            {pg.drivers.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>

        <section className="block blush" aria-labelledby="why-title">
          <h2 id="why-title" className="section-title">
            why my rates are lower than many agencies&rsquo;
          </h2>
          <p className="service-answer">{pg.why}</p>
          <h2 className="section-title page-subhead">monthly work</h2>
          <p className="service-answer">{pg.monthly}</p>
        </section>

        <section className="block" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">
            questions
          </h2>
          <dl className="faq">
            {pg.faqs.map((f) => (
              <div key={f.q} className="faq-item">
                <dt>{f.q}</dt>
                <dd>
                  {f.a}
                  {f.q === "do you work with brands?" && (
                    <>
                      {" "}
                      <a className="text-link" href="/ugc">
                        see ugc and brand videos
                      </a>
                      .
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
