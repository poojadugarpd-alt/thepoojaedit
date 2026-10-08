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

  it("uploads with a known length (R2 answers 411 to a chunked PUT)", async () => {
    const { createR2Client } = await load({
      R2_ACCOUNT_ID: "acc123",
      R2_ACCESS_KEY_ID: "AKID",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "poojaedit-photos",
    });
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await createR2Client().put(
        "site-media/a.jpg",
        new Uint8Array(1234),
        "image/jpeg",
      );
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://acc123.r2.cloudflarestorage.com/poojaedit-photos/site-media/a.jpg",
    );
    expect(init.body).toBeInstanceOf(Blob);
    expect((init.body as Blob).size).toBe(1234);
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//);
    expect(headers.get("content-type")).toBe("image/jpeg");
    expect(headers.get("x-amz-content-sha256")).toBeTruthy();
  });
});
