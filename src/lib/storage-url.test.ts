import { afterEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import("./storage-url");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storagePublicUrl (D-135)", () => {
  it("builds from the current project, ignoring a stale cached host", async () => {
    const { productImageUrl } = await load({
      NEXT_PUBLIC_SUPABASE_URL: "https://newproj.supabase.co",
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: undefined,
    });
    expect(
      productImageUrl({
        bucket: "product-images",
        path: "images/thepoojaedit/kurti-14/00-a.jpg",
        publicUrl:
          "https://oldproj.supabase.co/storage/v1/object/public/product-images/images/thepoojaedit/kurti-14/00-a.jpg",
      }),
    ).toBe(
      "https://newproj.supabase.co/storage/v1/object/public/product-images/images/thepoojaedit/kurti-14/00-a.jpg",
    );
  });

  it("keeps a cached URL's object path, so placeholder legacy-import rows still resolve", async () => {
    const { productImageUrl } = await load({
      NEXT_PUBLIC_SUPABASE_URL: "https://newproj.supabase.co",
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: undefined,
    });
    expect(
      productImageUrl({
        bucket: "legacy-import",
        path: "legacy/thepoojaedit:untitled-jul14/0",
        publicUrl:
          "https://oldproj.supabase.co/storage/v1/object/public/product-images/images/thepoojaedit/set-1/00-a.jpg",
      }),
    ).toBe(
      "https://newproj.supabase.co/storage/v1/object/public/product-images/images/thepoojaedit/set-1/00-a.jpg",
    );
    expect(
      productImageUrl({
        bucket: "x",
        path: "y",
        publicUrl: "https://cdn.shopify.com/a.jpg",
      }),
    ).toBe("https://cdn.shopify.com/a.jpg");
  });

  it("prefers the storage read override (Preview reading production images)", async () => {
    const { storagePublicUrl } = await load({
      NEXT_PUBLIC_SUPABASE_URL: "https://devproj.supabase.co",
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: "https://prodproj.supabase.co/",
    });
    expect(storagePublicUrl("site-media", "home/a b.mp4")).toBe(
      "https://prodproj.supabase.co/storage/v1/object/public/site-media/home/a%20b.mp4",
    );
  });

  it("falls back to the cached URL, then a relative path, when unconfigured", async () => {
    const { storagePublicUrl } = await load({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: undefined,
    });
    expect(storagePublicUrl("b", "p.jpg", "https://cdn.example/p.jpg")).toBe(
      "https://cdn.example/p.jpg",
    );
    expect(storagePublicUrl("b", "p.jpg")).toBe("/b/p.jpg");
  });
});

describe("R2 photos (D-159)", () => {
  it("serves an r2 row from the R2 public host, whatever Supabase is set to", async () => {
    const { productImageUrl } = await load({
      NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
      NEXT_PUBLIC_R2_PUBLIC_URL: "https://img.thepoojaedit.in/",
    });
    expect(
      productImageUrl({
        bucket: "r2",
        path: "product-images/images/thepoojaedit/kurti 2/00-a-1600.jpg",
        publicUrl: null,
      }),
    ).toBe(
      "https://img.thepoojaedit.in/product-images/images/thepoojaedit/kurti%202/00-a-1600.jpg",
    );
  });
});
