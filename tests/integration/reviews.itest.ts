import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { fakeTransports } from "../../src/server/notifications/testing";
import {
  ReviewRateLimitError,
  createReviewInvite,
  deleteReview,
  hashIp,
  listApprovedReviews,
  listReviews,
  submitReview,
  updateReview,
} from "../../src/server/reviews";
import { makeClient, resetDb } from "./helpers";

/** Client reviews for styling and the editing studio. */

let db: PrismaClient;
let admin: AdminUser;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
  admin = await db.adminUser.create({
    data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
  });
});

const valid = {
  site: "STUDIO" as const,
  service: "Instagram Reels",
  rating: 5,
  text: "Quick turnaround and the captions were spot on.",
  displayName: "Meera",
  instagram: "@meera.styles",
  showInstagram: true,
  email: "Meera@Example.com",
  phone: "98123 45678",
  consentPublish: true,
  consentContact: true,
};

describe("submitReview", () => {
  it("saves a PENDING review, lowercases email, and strips the @", async () => {
    const r = await submitReview(db, valid, { transports: fakeTransports(db) });
    expect(r.status).toBe("PENDING");
    expect(r.email).toBe("meera@example.com");
    expect(r.instagram).toBe("meera.styles");
    expect(r.source).toBe("OPEN");
    expect(await listApprovedReviews(db, "STUDIO")).toHaveLength(0);
  });

  it("rejects bad input and saves nothing", async () => {
    const bad = [
      { ...valid, text: "short" },
      { ...valid, text: "Great work, see https://spam.example for more" },
      { ...valid, text: "Visit my site at example.com today please" },
      { ...valid, email: "not-an-email" },
      { ...valid, rating: 9 },
      { ...valid, consentPublish: false },
      { ...valid, displayName: "  " },
      { ...valid, instagram: "not valid!!" },
    ];
    for (const b of bad) {
      await expect(
        submitReview(db, b, { transports: fakeTransports(db) }),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect(await db.review.count()).toBe(0);
  });

  it("accepts a review with no rating, no phone and no Instagram", async () => {
    const r = await submitReview(
      db,
      { ...valid, rating: "", phone: "", instagram: "", showInstagram: false },
      { transports: fakeTransports(db) },
    );
    expect(r.rating).toBeNull();
    expect(r.phone).toBeNull();
    expect(r.instagram).toBeNull();
    expect(r.showInstagram).toBe(false);
  });

  it("treats a double submit as one review", async () => {
    const t = fakeTransports(db);
    const a = await submitReview(db, valid, { transports: t });
    const b = await submitReview(db, valid, { transports: t });
    expect(b.id).toBe(a.id);
    expect(await db.review.count()).toBe(1);
  });

  it("limits three reviews an hour per connection", async () => {
    const t = fakeTransports(db);
    const ipHash = hashIp("203.0.113.9");
    for (let i = 0; i < 3; i++) {
      await submitReview(
        db,
        { ...valid, text: `Review number ${i} was lovely.` },
        { ipHash, transports: t },
      );
    }
    await expect(
      submitReview(
        db,
        { ...valid, text: "A fourth review right away." },
        { ipHash, transports: t },
      ),
    ).rejects.toBeInstanceOf(ReviewRateLimitError);
    expect(await db.review.count()).toBe(3);
  });

  it("tells Pooja by email (reply goes to the client) and in-app", async () => {
    await db.storeSettings.create({
      data: { key: "styling.content", value: { enquiryEmail: "pooja@example.com" } },
    });
    const fake = fakeTransports(db);
    const r = await submitReview(db, valid, { transports: fake });
    expect(fake.email.sent).toHaveLength(1);
    expect(fake.email.sent[0]!.to).toBe("pooja@example.com");
    expect(fake.email.sent[0]!.replyTo).toBe("meera@example.com");
    const rows = await db.adminNotification.findMany({ where: { entityId: r.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("REVIEW_RECEIVED");
  });

  it("keeps the review when a notification fails", async () => {
    await db.storeSettings.create({
      data: { key: "styling.content", value: { enquiryEmail: "pooja@example.com" } },
    });
    const fake = fakeTransports(db);
    fake.email.failNext = true;
    const r = await submitReview(db, valid, { transports: fake });
    expect(await db.review.findUnique({ where: { id: r.id } })).not.toBeNull();
  });
});

describe("invites", () => {
  it("marks the review verified once, then the link is spent", async () => {
    const t = fakeTransports(db);
    const invite = await createReviewInvite(db, admin, {
      clientName: "Meera",
      site: "STUDIO",
      service: "Instagram Reels",
    });
    const first = await submitReview(db, valid, {
      inviteToken: invite.token,
      transports: t,
    });
    expect(first.source).toBe("INVITE");
    expect(first.inviteId).toBe(invite.id);
    expect(
      (await db.reviewInvite.findUniqueOrThrow({ where: { id: invite.id } })).usedAt,
    ).not.toBeNull();

    const second = await submitReview(
      db,
      { ...valid, text: "Posting again with the same link." },
      { inviteToken: invite.token, transports: t },
    );
    expect(second.source).toBe("OPEN");
  });

  it("ignores an expired, wrong-site or unknown link (review still saves, unverified)", async () => {
    const t = fakeTransports(db);
    const expired = await createReviewInvite(db, admin, {
      clientName: "A",
      site: "STUDIO",
      service: "Reels",
      expiresInDays: -1,
    });
    const otherSite = await createReviewInvite(db, admin, {
      clientName: "B",
      site: "STYLING",
      service: "Wardrobe edit",
    });
    for (const [i, token] of [expired.token, otherSite.token, "nope"].entries()) {
      const r = await submitReview(
        db,
        { ...valid, text: `Unverified review number ${i} here.` },
        { inviteToken: token, transports: t },
      );
      expect(r.source).toBe("OPEN");
    }
  });
});

describe("moderation and public output", () => {
  it("shows only approved reviews and never private fields", async () => {
    const t = fakeTransports(db);
    const r = await submitReview(db, valid, { transports: t });
    await updateReview(db, admin, r.id, { status: "APPROVED" });

    const pub = await listApprovedReviews(db, "STUDIO");
    expect(pub).toHaveLength(1);
    const keys = Object.keys(pub[0]!);
    for (const secret of [
      "email",
      "phone",
      "note",
      "ipHash",
      "consentContact",
      "status",
    ]) {
      expect(keys).not.toContain(secret);
    }
    expect(pub[0]!.instagram).toBe("meera.styles");
    expect(await listApprovedReviews(db, "STYLING")).toHaveLength(0);
  });

  it("hides Instagram when the client did not agree to show it", async () => {
    const r = await submitReview(
      db,
      { ...valid, showInstagram: false },
      { transports: fakeTransports(db) },
    );
    await updateReview(db, admin, r.id, { status: "APPROVED" });
    expect((await listApprovedReviews(db, "STUDIO"))[0]!.instagram).toBeNull();
  });

  it("hiding removes it from the public list; editing fixes spelling; delete removes it", async () => {
    const r = await submitReview(db, valid, { transports: fakeTransports(db) });
    await updateReview(db, admin, r.id, { status: "APPROVED" });
    const edited = await updateReview(db, admin, r.id, {
      text: "Quick turnaround, captions spot on.",
    });
    expect(edited.status).toBe("APPROVED");
    expect((await listApprovedReviews(db, "STUDIO"))[0]!.text).toBe(
      "Quick turnaround, captions spot on.",
    );

    await updateReview(db, admin, r.id, { status: "HIDDEN" });
    expect(await listApprovedReviews(db, "STUDIO")).toHaveLength(0);
    expect((await listReviews(db, { status: "HIDDEN" })).map((x) => x.id)).toEqual([
      r.id,
    ]);

    await deleteReview(db, admin, r.id);
    expect(await db.review.count()).toBe(0);
    expect(
      await db.adminActivityLog.count({ where: { action: "review.delete" } }),
    ).toBe(1);
  });

  it("refuses changes without an active admin", async () => {
    const r = await submitReview(db, valid, { transports: fakeTransports(db) });
    await expect(
      updateReview(db, null, r.id, { status: "APPROVED" }),
    ).rejects.toThrow();
    await expect(deleteReview(db, null, r.id)).rejects.toThrow();
    await expect(
      createReviewInvite(db, null, {
        clientName: "A",
        site: "STUDIO",
        service: "Reels",
      }),
    ).rejects.toThrow();
  });
});
