import { describe, expect, it } from "vitest";

import type { StylingPhoto, StylingTestimonial } from "@/server/styling";

import { photoBands, reviewMoments, sentences } from "./spread";

const photo = (id: string): StylingPhoto => ({ id, url: `/p/${id}.jpg`, caption: "", alt: "" });
const review = (id: string, quote: string, photos = 0): StylingTestimonial => ({
  id,
  name: `Client ${id}`,
  detail: "Delhi",
  quote,
  photos: Array.from({ length: photos }, (_, i) => photo(`${id}${i}`)),
});

const QUOTE =
  "Love how Pooja treats my wishes as her own. She listened to every detail I could ask for and delivered the best product each time. I got more than 50 items made over a period of time, and she even did some shopping for me. She has a very good eye and gives proper time. She is more like a friend to me now and I would reach out to nobody else.";

describe("sentences", () => {
  it("splits on sentence ends and keeps the words", () => {
    expect(sentences(QUOTE)).toHaveLength(5);
    expect(sentences(QUOTE).join(" ")).toBe(QUOTE);
    expect(sentences("No full stop")).toEqual(["No full stop"]);
  });
});

describe("reviewMoments", () => {
  it("splits one review with four photos into four moments, words unchanged", () => {
    const { moments, rest } = reviewMoments([review("a", QUOTE, 4)], 4);
    expect(moments).toHaveLength(4);
    expect(rest).toHaveLength(0);
    expect(moments.map((m) => m.quote).join(" ")).toBe(QUOTE);
    expect(moments.map((m) => m.photo?.id)).toEqual(["a0", "a1", "a2", "a3"]);
  });

  it("never makes more moments than a review has photos (min 1)", () => {
    expect(reviewMoments([review("a", QUOTE, 2)], 4).moments).toHaveLength(2);
    expect(reviewMoments([review("a", QUOTE, 0)], 4).moments).toHaveLength(1);
  });

  it("gives each review one whole spot once there are enough", () => {
    const rs = ["a", "b", "c", "d", "e"].map((id) => review(id, QUOTE, 1));
    const { moments, rest } = reviewMoments(rs, 4);
    expect(moments.map((m) => m.key)).toEqual(["a", "b", "c", "d"]);
    expect(moments[0]!.quote).toBe(QUOTE);
    expect(rest.map((r) => r.id)).toEqual(["e"]);
  });

  it("shares the spots between two reviews", () => {
    const { moments } = reviewMoments([review("a", QUOTE, 4), review("b", QUOTE, 4)], 4);
    expect(moments).toHaveLength(4);
    expect(moments.filter((m) => m.name === "Client a")).toHaveLength(2);
  });
});

describe("photoBands", () => {
  it("fills bands in order and keeps the rest", () => {
    const ps = Array.from({ length: 24 }, (_, i) => photo(String(i)));
    const { bands, rest } = photoBands(ps, 5, 4);
    expect(bands).toHaveLength(5);
    expect(bands[0]!.map((p) => p.id)).toEqual(["0", "1", "2", "3"]);
    expect(rest.map((p) => p.id)).toEqual(["20", "21", "22", "23"]);
  });

  it("makes fewer bands when there are fewer photos", () => {
    const { bands, rest } = photoBands([photo("x"), photo("y")], 5, 4);
    expect(bands).toEqual([[photo("x"), photo("y")]]);
    expect(rest).toEqual([]);
  });
});
