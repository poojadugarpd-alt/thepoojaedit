import { describe, expect, it } from "vitest";

import { ShadowfaxProvider } from "./shadowfax";

function provider(status: number, body: unknown) {
  return new ShadowfaxProvider({
    apiToken: "test",
    apiBase: "https://sfx.invalid/api",
    fetchImpl: (async () =>
      new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
  });
}

const req = {
  destinationPostcode: "400097",
  items: [{ weightGrams: 0, quantity: 1 }],
  paymentMethod: "PREPAID_RAZORPAY" as const,
  orderValuePaise: 50_000,
};

describe("ShadowfaxProvider.quote", () => {
  it("an empty serviceability answer means the PIN isn't served", async () => {
    const q = await provider(200, []).quote(req);
    expect(q.serviceable).toBe(false);
  });

  it("a listed PIN is served and confirmed", async () => {
    const q = await provider(200, [{ code: 400097, services: ["Regular"] }]).quote(req);
    expect(q).toMatchObject({ serviceable: true });
    expect(q.serviceabilityUnconfirmed).toBeUndefined();
  });

  it("a Shadowfax server error still sells but marks the PIN unconfirmed", async () => {
    const q = await provider(502, { message: "bad gateway" }).quote(req);
    expect(q).toMatchObject({ serviceable: true, serviceabilityUnconfirmed: true });
  });

  it("an auth error is not swallowed", async () => {
    await expect(provider(401, { detail: "no creds" }).quote(req)).rejects.toThrow();
  });
});
