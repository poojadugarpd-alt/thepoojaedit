import { afterEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./r2");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("R2 client (D-159)", () => {
  it("is off until every R2 setting is present", async () => {
    const { r2Configured } = await load({ R2_ACCOUNT_ID: "acc", R2_BUCKET: "b" });
    expect(r2Configured()).toBe(false);
  });

  it("presigns a browser PUT to the bucket's S3 endpoint, expiring in 10 min", async () => {
    const { createR2Client } = await load({
      R2_ACCOUNT_ID: "acc123",
      R2_ACCESS_KEY_ID: "AKID",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "poojaedit-photos",
    });
    const url = new URL(
      await createR2Client().presignPut("product-images/thrift/p 1/a.webp"),
    );
    expect(url.origin).toBe("https://acc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/poojaedit-photos/product-images/thrift/p%201/a.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(
      /^AKID\/\d{8}\/auto\/s3\//,
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
