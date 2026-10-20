/**
 * Service JSON-LD for /styling, built from the offers Pooja types in Admin →
 * Styling → Edit page. In person in Gurugram and Delhi NCR, online for
 * everyone else (owner, 2026-10-20). Fees stay as typed on the page; here a
 * "₹5,000 to ₹10,000" style fee becomes a price range, and anything without a
 * rupee amount ("Quote on request") carries no price at all.
 */

interface Offer {
  title: string;
  includes: string;
  fee: string;
}

/** Rupee amounts in a fee, in order: "₹5,000 to ₹10,000" → [5000, 10000]. */
export function rupeeAmounts(fee: string): number[] {
  return [...fee.matchAll(/₹\s*([\d,]+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** "What's included" is one point per line; as one sentence-per-point text. */
function describe(includes: string): string | undefined {
  const text = includes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/[.!?]$/.test(l) ? l : `${l}.`))
    .join(" ");
  return text || undefined;
}

function priceOf(fee: string) {
  const amounts = rupeeAmounts(fee);
  if (amounts.length === 0) return undefined;
  if (amounts.length === 1) {
    return { "@type": "Offer", priceCurrency: "INR", price: amounts[0] };
  }
  return {
    "@type": "Offer",
    priceSpecification: {
      "@type": "PriceSpecification",
      priceCurrency: "INR",
      minPrice: Math.min(...amounts),
      maxPrice: Math.max(...amounts),
    },
  };
}

export function stylingServicesJsonLd(offers: Offer[], base: string, providerId: string) {
  return {
    "@context": "https://schema.org",
    "@graph": offers.map((o) => ({
      "@type": "Service",
      name: o.title,
      description: describe(o.includes),
      serviceType: "Personal styling and shopping",
      provider: { "@id": providerId },
      areaServed: [
        { "@type": "City", name: "Gurugram" },
        { "@type": "AdministrativeArea", name: "Delhi NCR" },
      ],
      availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: `${base}/styling`,
        name: "In person in Delhi NCR, or online over video call",
      },
      offers: priceOf(o.fee),
    })),
  };
}
