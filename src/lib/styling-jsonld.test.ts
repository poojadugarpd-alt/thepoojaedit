import { describe, expect, it } from "vitest";

import {
  rupeeAmounts,
  stylingGuideJsonLd,
  stylingServicesJsonLd,
} from "./styling-jsonld";

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
      {
        title: "Personal Shopping (in person)",
        includes: "Let's go\nshopping",
        fee: "₹10,000 to ₹50,000",
      },
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

describe("stylingGuideJsonLd", () => {
  const g = {
    slug: "nri",
    name: "Shopping from abroad",
    answer: "I shop for clients abroad.",
    faqs: [{ q: "Do you ship abroad?", a: "Yes." }],
  };

  it("has a breadcrumb and the questions", () => {
    const ld = stylingGuideJsonLd(g, "https://x.test", "https://x.test#p");
    const types = ld["@graph"].map((n) => (n as { "@type": string })["@type"]);
    expect(types).toEqual(["BreadcrumbList", "FAQPage"]);
  });

  it("adds a Service only for service pages", () => {
    const ld = stylingGuideJsonLd(
      { ...g, service: { name: "Shopping", areaServed: "worldwide" } },
      "https://x.test",
      "https://x.test#p",
    );
    const service = ld["@graph"][2] as {
      "@type": string;
      url: string;
      provider: object;
    };
    expect(service["@type"]).toBe("Service");
    expect(service.url).toBe("https://x.test/styling/nri");
    expect(service.provider).toEqual({ "@id": "https://x.test#p" });
  });
});
