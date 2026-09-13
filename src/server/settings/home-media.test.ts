import { describe, expect, it } from "vitest";

import type { AdminUser } from "@/generated/prisma";
import { AuthorizationError } from "@/server/auth/errors";
import type { StoragePort } from "@/lib/storage";

import {
  HomeMediaValidationError,
  buildHomeMediaPath,
  confirmHomeMediaUpload,
  homeMediaPublicUrl,
  requestHomeMediaUpload,
} from "./home-media";

const admin = { id: "a1", isActive: true } as AdminUser;
const inactiveAdmin = { id: "a2", isActive: false } as AdminUser;

function fakeStorage(size = 1000): StoragePort {
  return {
    async createSignedUploadUrl(bucket, path) {
      return { signedUrl: `https://fake/${bucket}/${path}`, token: "tok", path };
    },
    async statObject() {
      return { exists: true, size, contentType: "image/webp" };
    },
    async createSignedDownloadUrl(_b, path) {
      return `https://fake/download/${path}`;
    },
    async deleteObjects() {},
  };
}

describe("buildHomeMediaPath", () => {
  it("derives the path from slot/mediaId/kind — never from client input", () => {
    expect(buildHomeMediaPath("editorial", "m1", "image", "image/webp")).toBe(
      "home/editorial/m1.webp",
    );
    expect(buildHomeMediaPath("labelBlock", "m2", "video", "video/mp4")).toBe(
      "home/labelBlock/m2.mp4",
    );
  });

  it("rejects an unsupported content type for the given kind", () => {
    expect(() => buildHomeMediaPath("editorial", "m1", "image", "image/gif")).toThrow(
      HomeMediaValidationError,
    );
    expect(() => buildHomeMediaPath("editorial", "m1", "video", "video/quicktime")).toThrow(
      HomeMediaValidationError,
    );
  });
});

describe("requestHomeMediaUpload", () => {
  it("requires an active admin", async () => {
    await expect(
      requestHomeMediaUpload(fakeStorage(), null, {
        slot: "editorial",
        kind: "image",
        contentType: "image/webp",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      requestHomeMediaUpload(fakeStorage(), inactiveAdmin, {
        slot: "editorial",
        kind: "image",
        contentType: "image/webp",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns a signed URL scoped to a fresh path in the site-media bucket", async () => {
    const ticket = await requestHomeMediaUpload(fakeStorage(), admin, {
      slot: "closetBlock",
      kind: "video",
      contentType: "video/mp4",
    });
    expect(ticket.path).toMatch(/^home\/closetBlock\/.+\.mp4$/);
    expect(ticket.signedUrl).toContain("site-media");
  });
});

describe("confirmHomeMediaUpload", () => {
  it("requires an active admin", async () => {
    await expect(
      confirmHomeMediaUpload(fakeStorage(), null, { path: "home/editorial/x.webp", kind: "image" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws when the object was never actually uploaded", async () => {
    const storage: StoragePort = {
      ...fakeStorage(),
      async statObject() {
        return { exists: false, size: null, contentType: null };
      },
    };
    await expect(
      confirmHomeMediaUpload(storage, admin, { path: "home/editorial/x.webp", kind: "image" }),
    ).rejects.toBeInstanceOf(HomeMediaValidationError);
  });

  it("enforces the 8MB image limit and the separate, larger 15MB video limit", async () => {
    const bigImage = fakeStorage(9 * 1024 * 1024);
    await expect(
      confirmHomeMediaUpload(bigImage, admin, { path: "home/editorial/x.webp", kind: "image" }),
    ).rejects.toThrow(/8MB/);

    // The same byte size is fine for video — a real, deliberately larger cap
    // since a short clip is naturally bigger than a photo.
    const sameSizeVideo = fakeStorage(9 * 1024 * 1024);
    await expect(
      confirmHomeMediaUpload(sameSizeVideo, admin, { path: "home/editorial/x.mp4", kind: "video" }),
    ).resolves.toBeUndefined();

    const bigVideo = fakeStorage(16 * 1024 * 1024);
    await expect(
      confirmHomeMediaUpload(bigVideo, admin, { path: "home/editorial/x.mp4", kind: "video" }),
    ).rejects.toThrow(/15MB/);
  });

  it("succeeds for a normal, within-limit upload", async () => {
    await expect(
      confirmHomeMediaUpload(fakeStorage(500_000), admin, {
        path: "home/editorial/x.webp",
        kind: "image",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("homeMediaPublicUrl", () => {
  it("builds the same public-object URL shape Supabase Storage itself uses", () => {
    expect(homeMediaPublicUrl("https://abcd.supabase.co", "home/editorial/x.webp")).toBe(
      "https://abcd.supabase.co/storage/v1/object/public/site-media/home/editorial/x.webp",
    );
  });
});
