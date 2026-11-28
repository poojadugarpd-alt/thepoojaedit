import { describe, expect, it } from "vitest";

import type { StylingPhoto } from "@/server/styling";

import { photoBands } from "./spread";

const photo = (id: string): StylingPhoto => ({ id, url: `/p/${id}.jpg`, caption: "", alt: "" });
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
