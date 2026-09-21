import { publicEnv } from "@/lib/public-env";

/**
 * Site-wide Organization + WebSite JSON-LD (schema.org). Rendered once, in
 * the root layout, gated to storefront routes by `RouteChrome` the same way
 * the manifest link is. This is the GEO/SEO baseline every page benefits
 * from — per-page schema (Product, BreadcrumbList) layers on top of it.
 *
 * Only states facts confirmed in docs/01-master-specification.md — no
 * invented legal name/GSTIN (still an open owner-confirmation item, see
 * docs/HANDOVER.md §6).
 */
export function organizationJsonLd() {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}#organization`,
        name: "The Pooja Edit",
        url: base,
        logo: `${base}/brand/logo-maroon.png`,
        founder: { "@type": "Person", name: "Pooja Dugar" },
        sameAs: ["https://www.instagram.com/poojadugar_/"],
      },
      {
        "@type": "WebSite",
        "@id": `${base}#website`,
        name: "The Pooja Edit",
        url: base,
        publisher: { "@id": `${base}#organization` },
      },
    ],
  };
}
