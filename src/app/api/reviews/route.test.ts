import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/server/reviews", () => ({
  hashIp: () => "hash",
  listApprovedReviews: async () => [],
  ReviewRateLimitError: class extends Error {},
  submitReview: vi.fn(),
}));

import { GET, OPTIONS, POST } from "./route";

const post = (body: unknown, origin?: string) =>
  new Request("http://localhost/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });

describe("/api/reviews", () => {
  it("refuses a POST with no Origin or an unknown one", async () => {
    expect((await POST(post({}))).status).toBe(403);
    expect((await POST(post({}, "https://evil.example"))).status).toBe(403);
  });

  it("answers the studio's preflight with CORS headers, and not a stranger's", () => {
    const ok = OPTIONS(
      new Request("http://localhost/api/reviews", {
        method: "OPTIONS",
        headers: { Origin: "https://studio.thepoojaedit.in" },
      }),
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://studio.thepoojaedit.in",
    );

    const no = OPTIONS(
      new Request("http://localhost/api/reviews", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(no.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("pretends success to bots that fill the hidden field", async () => {
    const res = await POST(post({ company: "spam" }, "https://studio.thepoojaedit.in"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("lists only for a known site", async () => {
    const bad = await GET(new Request("http://localhost/api/reviews?site=x"));
    expect(bad.status).toBe(400);
    const good = await GET(new Request("http://localhost/api/reviews?site=studio"));
    expect(good.status).toBe(200);
    expect(good.headers.get("cache-control")).toContain("s-maxage");
  });
});
