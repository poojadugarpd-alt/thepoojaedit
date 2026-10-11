import { describe, expect, it } from "vitest";

import {
  DEFAULT_STYLING_CONTENT,
  MAX_OFFERS,
  NOT_SURE_SERVICE,
  publishProblems,
  resolveStylingContent,
  serviceOptions,
} from "./content";

describe("resolveStylingContent (D-162)", () => {
  it("is an unpublished default page when nothing is saved", () => {
    const c = resolveStylingContent(null);
    expect(c).toEqual(DEFAULT_STYLING_CONTENT);
    expect(c.published).toBe(false);
  });

  it("falls back per field for blank text, but keeps a deliberately blank abroad note", () => {
    const c = resolveStylingContent({ heading: "  ", intro: "Mine", abroadNote: "" });
    expect(c.heading).toBe(DEFAULT_STYLING_CONTENT.heading);
    expect(c.intro).toBe("Mine");
    expect(c.abroadNote).toBe("");
  });

  it("drops untitled offers and caps the list", () => {
    const offers = Array.from({ length: 6 }, (_, i) => ({
      title: i === 1 ? "" : `Offer ${i}`,
      includes: "a\nb",
      fee: "₹1",
    }));
    const c = resolveStylingContent({ offers });
    expect(c.offers).toHaveLength(MAX_OFFERS);
    expect(c.offers.map((o) => o.title)).not.toContain("");
  });

  it("only publishes when a non-boolean flag is exactly true", () => {
    expect(resolveStylingContent({ published: "yes" }).published).toBe(false);
    expect(resolveStylingContent({ published: true }).published).toBe(true);
  });

  it("ignores a portrait with no file", () => {
    expect(resolveStylingContent({ portrait: { alt: "x" } }).portrait).toBeNull();
  });
});

describe("publishProblems", () => {
  it("needs an offer and a valid enquiry email", () => {
    expect(publishProblems(DEFAULT_STYLING_CONTENT)).toHaveLength(2);
    const ready = resolveStylingContent({
      offers: [{ title: "Wardrobe edit", includes: "", fee: "" }],
      enquiryEmail: "pooja@example.com",
    });
    expect(publishProblems(ready)).toEqual([]);
    expect(publishProblems({ ...ready, enquiryEmail: "pooja" })).toHaveLength(1);
  });
});

describe("serviceOptions", () => {
  it("lists each offer, then 'Not sure yet'", () => {
    const c = resolveStylingContent({
      offers: [
        { title: "A", includes: "", fee: "" },
        { title: "B", includes: "", fee: "" },
      ],
    });
    expect(serviceOptions(c)).toEqual(["A", "B", NOT_SURE_SERVICE]);
  });
});
