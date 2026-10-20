import { describe, expect, it } from "vitest";

import {
  DEFAULT_STYLING_CONTENT,
  MAX_GALLERY,
  MAX_OFFERS,
  MAX_TESTIMONIAL_PHOTOS,
  NOT_SURE_SERVICE,
  publishProblems,
  resolveStylingContent,
  serviceOptions,
  visibleTestimonials,
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

describe("styling carousels: designs, testimonials, gallery", () => {
  const photo = (id: string) => ({ id, url: `https://img.example/${id}.jpg`, alt: "" });

  it("defaults to empty lists and the default headings", () => {
    const c = resolveStylingContent(null);
    expect(c.designs).toEqual([]);
    expect(c.testimonials).toEqual([]);
    expect(c.gallery).toEqual([]);
    expect(c.designsHeading).toBe("My designs");
    expect(c.testimonialsHeading).toBe("Kind words");
  });

  it("drops photos without an id or a file, and caps each list", () => {
    const c = resolveStylingContent({
      designs: [photo("a"), { url: "https://img.example/x.jpg" }, { id: "b" }, null],
      gallery: Array.from({ length: MAX_GALLERY + 5 }, (_, i) => photo(`g${i}`)),
    });
    expect(c.designs.map((p) => p.id)).toEqual(["a"]);
    expect(c.designs[0]?.caption).toBe("");
    expect(c.gallery).toHaveLength(MAX_GALLERY);
  });

  it("keeps testimonials in order, caps their photos, and hides empty ones", () => {
    const c = resolveStylingContent({
      testimonials: [
        { id: "t1", name: "Asha", quote: "Loved it", photos: [] },
        { id: "t2", name: "Empty", quote: "", photos: [] },
        {
          id: "t3",
          name: "Riya",
          quote: "",
          photos: Array.from({ length: 6 }, (_, i) => photo(`p${i}`)),
        },
        { name: "No id" },
      ],
    });
    expect(c.testimonials.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(c.testimonials[2]?.photos).toHaveLength(MAX_TESTIMONIAL_PHOTOS);
    expect(visibleTestimonials(c).map((t) => t.id)).toEqual(["t1", "t3"]);
  });
});
