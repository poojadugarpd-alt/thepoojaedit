import { pricing, site } from "./site";

// Structured data shared by every page. Pooja is the same Person the shop
// (thepoojaedit.in) describes — same @id and profiles — so search and answer
// engines join the studio, the shop and her channels into one person.

const SHOP = "https://thepoojaedit.in";
export const PERSON_ID = `${SHOP}#pooja-dugar`;

export function personJsonLd() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.name,
    url: `${SHOP}/about`,
    jobTitle: "Fashion designer, personal stylist and video editor",
    sameAs: [
      "https://www.instagram.com/poojadugar_/",
      "https://www.youtube.com/@poojadugar",
      "https://www.instagram.com/poojasclosett/",
      SHOP,
      site.url,
    ],
  };
}

export function studioJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        "@id": `${site.url}#studio`,
        name: site.studio,
        url: site.url,
        image: `${site.url}/opengraph-image.jpg`,
        description:
          "Video editing and design for fashion and lifestyle creators and brands: Instagram Reels and Shorts, YouTube long-form, carousels and graphics.",
        founder: { "@id": PERSON_ID },
        email: site.email,
        telephone: site.whatsappDisplay.replace(/\s/g, ""),
        areaServed: "IN",
        sameAs: [site.instagramUrl, site.youtubeUrl],
        makesOffer: (["reels", "youtube", "carousels", "graphics"] as const).map((k) => ({
          "@type": "Offer",
          url: `${site.url}/${k}`,
          itemOffered: { "@type": "Service", name: pricing[k].service },
          price: Number(pricing[k].amount.replace(/[^\d]/g, "")),
          priceCurrency: "INR",
        })),
      },
      personJsonLd(),
    ],
  };
}
