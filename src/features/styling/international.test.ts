import { describe, expect, it } from "vitest";

import { DESTINATIONS, todayInIndia, tripState } from "./international";

const vietnam = DESTINATIONS.find((d) => d.slug === "vietnam")!;
const japan = DESTINATIONS.find((d) => d.slug === "japan")!;

describe("tripState", () => {
  it("is open up to and including the list deadline", () => {
    expect(tripState(vietnam, "2026-11-27")).toBe("open");
    expect(tripState(vietnam, "2026-12-08")).toBe("open");
  });
  it("is closed after the deadline until the trip ends", () => {
    expect(tripState(vietnam, "2026-12-09")).toBe("closed");
    expect(tripState(vietnam, "2026-12-26")).toBe("closed");
  });
  it("drops the trip after it ends, and for places without one", () => {
    expect(tripState(vietnam, "2026-12-27")).toBe("none");
    expect(tripState(japan, "2026-11-27")).toBe("none");
  });
  it("only Vietnam has dates", () => {
    expect(DESTINATIONS.filter((d) => d.trip).map((d) => d.slug)).toEqual(["vietnam"]);
  });
});

describe("todayInIndia", () => {
  it("uses India time, not UTC", () => {
    // 20:00 UTC on 8 Dec is already 9 Dec in India.
    expect(todayInIndia(new Date("2026-12-08T20:00:00Z"))).toBe("2026-12-09");
  });
});
