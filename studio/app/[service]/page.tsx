import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShowcase } from "@/lib/content";
import { pricing, site, waLink } from "@/lib/site";
import { commonFaqs, isServiceId, serviceIds, services } from "@/lib/services";
import { personJsonLd } from "@/lib/schema";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { GraphicCard, InstagramCard, ModalProvider, YouTubeCard } from "@/components/Media";
import { WhatsAppIcon } from "@/components/icons";

// Same hourly refresh as the home page, so YouTube samples stay current.
export const revalidate = 3600;

type Params = { params: Promise<{ service: string }> };

export function generateStaticParams() {
  return serviceIds.map((service) => ({ service }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { service } = await params;
  if (!isServiceId(service)) return { title: "Not found", robots: { index: false } };
  const s = services[service];
  return {
    title: { absolute: s.seoTitle },
    description: s.seoDescription,
    alternates: { canonical: `/${service}` },
    // Setting openGraph here replaces the root's, so restate the share image.
    openGraph: {
      title: s.seoTitle,
      description: s.seoDescription,
      url: `/${service}`,
      type: "website",
      locale: "en_IN",
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function ServicePage({ params }: Params) {
  const { service } = await params;
  // Unknown paths are a real 404 (no dynamicParams=false: it 404'd valid pages on Workers).
  if (!isServiceId(service)) notFound();
  const s = services[service];
  const price = pricing[service];
  const data = await getShowcase();
  const faqs = [...s.faqs, ...commonFaqs];
  const message = `Hi Pooja! I'd like to book ${price.service.toLowerCase()} (${price.amount} ${price.unit}).`;

  const reels = data.reels.filter((r) => !r.sample && r.thumbnailUrl);
  const carousels = data.carousels.filter((c) => !c.sample);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: s.h1,
        serviceType: price.service,
        description: s.answer,
        url: `${site.url}/${service}`,
        provider: { "@id": `${site.url}#studio` },
        areaServed: "IN",
        offers: {
          "@type": "Offer",
          price: Number(price.amount.replace(/[^\d]/g, "")),
          priceCurrency: "INR",
          description: `${price.amount} ${price.unit}, ready in ${price.turnaround}`,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.studio, item: site.url },
          { "@type": "ListItem", position: 2, name: s.h1, item: `${site.url}/${service}` },
        ],
      },
      personJsonLd(),
    ],
  };

  return (
    <ModalProvider>
      <PageHeader message={message} />

      <main id="top">
        <section className="block service-hero" aria-labelledby="service-title">
          <div>
            <p className="kicker">{price.turnaround} · 1–2 revisions included</p>
            <h1 id="service-title" className="display display-md">
              {s.h1}
            </h1>
            <p className="service-answer">{s.answer}</p>
            <p className="split-price">
              {price.amount} {price.unit}
            </p>
            <ul className="service-includes">
              {s.includes.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <a className="btn btn-wa" href={waLink(message)} target="_blank" rel="noopener">
              <WhatsAppIcon size={18} /> book on whatsapp
            </a>
          </div>
        </section>

        <section className="block blush" aria-labelledby="samples-title">
          <h2 id="samples-title" className="section-title">
            {s.samplesTitle}
          </h2>
          {service === "reels" && (
            <div className="grid grid-reels">
              {reels.map((r, i) => (
                <InstagramCard key={r.id} item={r} index={i} />
              ))}
            </div>
          )}
          {service === "youtube" && (
            <div className="grid grid-video">
              {data.longForm.slice(0, 9).map((v) => (
                <YouTubeCard key={v.id} video={v} />
              ))}
            </div>
          )}
          {service === "carousels" && (
            <div className="grid grid-carousel">
              {carousels.map((c, i) => (
                <InstagramCard key={c.id} item={c} index={i} />
              ))}
            </div>
          )}
          {service === "graphics" && (
            <div className="grid grid-carousel">
              {data.graphics.map((g, i) => (
                <GraphicCard key={g.id} item={g} index={i} />
              ))}
            </div>
          )}
        </section>

        <section className="block" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">
            questions
          </h2>
          <dl className="faq">
            {faqs.map((f) => (
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
