import { describe, expect, it } from "vitest";

import {
  ImageValidationError,
  assertValidImageUpload,
  buildProductImagePath,
} from "./product-images";

describe("buildProductImagePath", () => {
  it("derives a server-controlled path per catalog", () => {
    expect(buildProductImagePath("THE_POOJA_EDIT", "p1", "img1", "image/webp")).toBe(
      "the-pooja-edit/p1/img1.webp",
    );
    expect(buildProductImagePath("THRIFT", "p2", "img2", "image/jpeg")).toBe(
      "thrift/p2/img2.jpg",
    );
  });

  it("rejects an unsupported content type", () => {
    expect(() => buildProductImagePath("THRIFT", "p", "i", "image/gif")).toThrow(
      ImageValidationError,
    );
  });
});

describe("assertValidImageUpload", () => {
  it("accepts a webp within limits", () => {
    expect(() =>
      assertValidImageUpload({
        contentType: "image/webp",
        bytes: 500_000,
        width: 1200,
        height: 1600,
      }),
    ).not.toThrow();
  });

  it("rejects a non-image type", () => {
    expect(() => assertValidImageUpload({ contentType: "application/pdf" })).toThrow(
      ImageValidationError,
    );
  });

  it("rejects an oversized file", () => {
    expect(() =>
      assertValidImageUpload({
        contentType: "image/png",
        bytes: 50 * 1024 * 1024,
      }),
    ).toThrow(/size limit/);
  });

  it("rejects tiny dimensions", () => {
    expect(() =>
      assertValidImageUpload({ contentType: "image/webp", width: 50, height: 50 }),
    ).toThrow(/dimensions/);
  });
});
