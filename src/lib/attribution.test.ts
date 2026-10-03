import { describe, expect, it } from "vitest";

import { parseUtmCookie, serializeUtm, utmFromSearchParams } from "./attribution";

describe("utmFromSearchParams", () => {
  it("reads and normalises the three tags", () => {
    const p = new URLSearchParams("utm_source=Instagram&utm_medium=story&utm_campaign=e4_closet_w1");
    expect(utmFromSearchParams(p)).toEqual({ source: "instagram", medium: "story", campaign: "e4_closet_w1" });
  });

  it("returns null without a source", () => {
    expect(utmFromSearchParams(new URLSearchParams("utm_medium=story"))).toBeNull();
    expect(utmFromSearchParams(new URLSearchParams(""))).toBeNull();
  });

  it("keeps the source when other tags are missing or unsafe", () => {
    const p = new URLSearchParams("utm_source=instagram&utm_campaign=<script>");
    expect(utmFromSearchParams(p)).toEqual({ source: "instagram", medium: null, campaign: null });
  });

  it("drops a source with unsafe characters and caps length", () => {
    expect(utmFromSearchParams(new URLSearchParams("utm_source=a|b"))).toBeNull();
    const long = "x".repeat(200);
    expect(utmFromSearchParams(new URLSearchParams(`utm_source=${long}`))?.source).toHaveLength(64);
  });
});

describe("cookie round-trip", () => {
  it("serialises and parses back", () => {
    const utm = { source: "instagram", medium: "bio", campaign: "profile" };
    expect(parseUtmCookie(serializeUtm(utm))).toEqual(utm);
  });

  it("handles missing medium/campaign", () => {
    expect(parseUtmCookie(serializeUtm({ source: "instagram", medium: null, campaign: null }))).toEqual({
      source: "instagram",
      medium: null,
      campaign: null,
    });
  });

  it("rejects empty or tampered cookies", () => {
    expect(parseUtmCookie(undefined)).toBeNull();
    expect(parseUtmCookie("")).toBeNull();
    expect(parseUtmCookie("|story|x")).toBeNull();
    expect(parseUtmCookie("insta gram|story|x")).toBeNull();
  });
});
