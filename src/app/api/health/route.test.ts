import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns ok with the environment identity and no secrets", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("poojaedit");
    expect(["development", "preview", "production"]).toContain(body.env);
    expect(typeof body.time).toBe("string");

    // Nothing secret-shaped leaked into the payload.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/secret|password|token|key/i);
  });
});
