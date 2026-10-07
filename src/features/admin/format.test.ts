import { describe, expect, it } from "vitest";

import { ts } from "./format";

describe("ts", () => {
  it("shows India time whatever the server's zone (Vercel runs UTC)", () => {
    // 16:23 UTC = 21:53 IST
    expect(ts("2026-10-07T16:23:00Z")).toMatch(/9:53\s?pm/i);
    // 20:00 UTC on the 7th is already the 8th in India
    expect(ts("2026-10-07T20:00:00Z")).toMatch(/^8 Oct 2026/);
  });
});
