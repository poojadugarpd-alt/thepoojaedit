import { describe, expect, it } from "vitest";

import { getGuide, guides, STYLING_LINKS, stylingFaqs } from "./guides";

describe("styling guides", () => {
  it("keep search titles and descriptions within what Google shows", () => {
    for (const g of guides) {
      expect(g.title.length, g.slug).toBeLessThanOrEqual(60);
      expect(g.description.length, g.slug).toBeLessThanOrEqual(160);
    }
  });

  it("have unique slugs that the links point at", () => {
    const slugs = guides.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const l of STYLING_LINKS) {
      expect(getGuide(l.href.replace("/styling/", "")), l.href).toBeDefined();
    }
  });

  it("link only to guides that exist", () => {
    const links = [...guides.flatMap((g) => g.faqs), ...stylingFaqs].flatMap((f) =>
      f.link ? [f.link.href] : [],
    );
    for (const href of links) {
      expect(getGuide(href.replace("/styling/", "")), href).toBeDefined();
    }
  });
});
