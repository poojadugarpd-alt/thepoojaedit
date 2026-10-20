import { describe, expect, it } from "vitest";

import { rupeeAmounts, stylingServicesJsonLd } from "./styling-jsonld";

describe("rupeeAmounts", () => {
  it("reads a range", () => {
    expect(rupeeAmounts("₹5,000 to ₹10,000")).toEqual([5000, 10000]);
  });

  it("reads a single fee", () => {
    expect(rupeeAmounts("₹4,000")).toEqual([4000]);
  });

  it("finds nothing in a quote-only fee", () => {
    expect(rupeeAmounts("Quote on request")).toEqual([]);
  });
});

describe("stylingServicesJsonLd", () => {
  const base = "https://thepoojaedit.in";
  const [range, quote] = stylingServicesJsonLd(
    [
      { title: "Personal Shopping (in person)", includes: "Let's go\nshopping", fee: "₹10,000 to ₹50,000" },
      { title: "Personal Styling", includes: "", fee: "Quote on request" },
    ],
    base,
    `${base}#pooja-dugar`,
  )["@graph"];

  it("turns a fee range into a min/max price", () => {
    expect(range.offers).toEqual({
      "@type": "Offer",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "INR",
        minPrice: 10000,
        maxPrice: 50000,
      },
    });
    expect(range.description).toBe("Let's go. shopping.");
    expect(range.provider).toEqual({ "@id": `${base}#pooja-dugar` });
  });

  it("gives a quote-only offer no price and no empty description", () => {
    expect(quote.offers).toBeUndefined();
    expect(quote.description).toBeUndefined();
  });
});
