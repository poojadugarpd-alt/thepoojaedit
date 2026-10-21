import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { INDEXNOW_KEY, indexNowBody, pingIndexNow } from "./indexnow";

const base = "https://thepoojaedit.in";

describe("indexNowBody", () => {
  it("names the host, the key file and absolute, de-duplicated URLs", () => {
    expect(indexNowBody(["/closet/a", "/closet", "/closet/a"], base)).toEqual({
      host: "thepoojaedit.in",
      key: INDEXNOW_KEY,
      keyLocation: `https://thepoojaedit.in/${INDEXNOW_KEY}.txt`,
      urlList: ["https://thepoojaedit.in/closet/a", "https://thepoojaedit.in/closet"],
    });
  });
});

describe("pingIndexNow", () => {
  it("posts once in production", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await pingIndexNow(["/label/x"], { fetch, appEnv: "production", base });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(init.body).urlList).toEqual(["https://thepoojaedit.in/label/x"]);
  });

  it("does nothing outside production or with no URLs", async () => {
    const fetch = vi.fn();
    await pingIndexNow(["/label/x"], { fetch, appEnv: "preview", base });
    await pingIndexNow([], { fetch, appEnv: "production", base });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never throws when the engine is down", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      pingIndexNow(["/label/x"], { fetch, appEnv: "production", base }),
    ).resolves.toBeUndefined();
  });
});
