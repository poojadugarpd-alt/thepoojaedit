import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const rl = new InMemoryRateLimiter(3, 1000);
    const t = 10_000;
    expect(rl.check("k", t).allowed).toBe(true);
    expect(rl.check("k", t).allowed).toBe(true);
    expect(rl.check("k", t).allowed).toBe(true);
    const blocked = rl.check("k", t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const rl = new InMemoryRateLimiter(1, 1000);
    expect(rl.check("k", 0).allowed).toBe(true);
    expect(rl.check("k", 500).allowed).toBe(false);
    expect(rl.check("k", 1001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = new InMemoryRateLimiter(1, 1000);
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("b", 0).allowed).toBe(true);
    expect(rl.check("a", 0).allowed).toBe(false);
  });
});
