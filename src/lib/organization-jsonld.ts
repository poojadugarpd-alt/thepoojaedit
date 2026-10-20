import { publicEnv } from "@/lib/public-env";

/**
 * Site-wide Organization + Person + WebSite JSON-LD (schema.org). Rendered
 * once, in the root layout, gated to storefront routes by `RouteChrome` the
 * same way the manifest link is. This is the GEO/SEO baseline every page
 * benefits from — per-page schema (Product, BreadcrumbList, Service) layers on
 * top of it and points back here by `@id`.
 *
 * Only states facts confirmed in docs/01-master-specification.md or by the
 * owner — no invented legal name/GSTIN (still an open owner-confirmation item,
 * see docs/HANDOVER.md §6).
 */

/** Pooja's public profiles. `sameAs` lets search and answer engines join the
 * shop, the editing studio and her channels into one person (owner, 2026-10-20). */
export const POOJA_PROFILES = [
  "https://www.instagram.com/poojadugar_/",
  "https://www.youtube.com/@poojadugar",
  "https://www.instagram.com/poojasclosett/",
  "https://studio.thepoojaedit.in",
  "https://lehlah.club/poojadugar",
];

export function personId(base = publicEnv.NEXT_PUBLIC_SITE_URL) {
  return `${base}#pooja-dugar`;
}

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
        founder: { "@id": personId(base) },
        sameAs: [
          "https://www.instagram.com/thepoojaedit.in/",
          "https://www.instagram.com/poojasclosett/",
        ],
      },
      {
        "@type": "Person",
        "@id": personId(base),
        name: "Pooja Dugar",
        url: `${base}/about`,
        jobTitle: "Fashion designer, personal stylist and video editor",
        worksFor: { "@id": `${base}#organization` },
        sameAs: POOJA_PROFILES,
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
