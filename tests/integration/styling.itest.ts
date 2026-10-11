import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { AdminUser, PrismaClient } from "../../src/generated/prisma";
import { fakeTransports } from "../../src/server/notifications/testing";
import {
  EnquiryUnavailableError,
  listStylingEnquiries,
  submitStylingEnquiry,
  updateStylingEnquiry,
} from "../../src/server/styling";
import { makeClient, resetDb } from "./helpers";

/** Personal Styling enquiries (D-162). */

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

async function publish(extra: Record<string, unknown> = {}) {
  await db.storeSettings.create({
    data: {
      key: "styling.content",
      value: {
        published: true,
        offers: [{ title: "Wardrobe edit", includes: "Closet review", fee: "₹5,000" }],
        enquiryEmail: "pooja@example.com",
        ...extra,
      },
    },
  });
}

const valid = {
  name: "Asha Rao",
  email: "Asha@Example.com",
  phone: "98123 45678",
  location: "London, UK",
  service: "Wardrobe edit",
  budget: "",
  message: "I'd like help sorting my wardrobe before a move.",
};

describe("submitStylingEnquiry", () => {
  it("refuses while the page is a draft and saves nothing", async () => {
    await expect(
      submitStylingEnquiry(db, valid, { transports: fakeTransports(db) }),
    ).rejects.toBeInstanceOf(EnquiryUnavailableError);
    expect(await db.stylingEnquiry.count()).toBe(0);
  });

  it("saves the enquiry, emails Pooja with Reply going to the customer, and writes an in-app alert", async () => {
    await publish();
    const t = fakeTransports(db);
    const e = await submitStylingEnquiry(db, valid, {
      transports: t,
      utm: { source: "instagram", medium: "bio", campaign: null },
    });

    expect(e.status).toBe("NEW");
    expect(e.email).toBe("asha@example.com");
    expect(e.budget).toBeNull();
    expect(e.utmSource).toBe("instagram");

    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0].to).toBe("pooja@example.com");
    expect(t.email.sent[0].replyTo).toBe("asha@example.com");
    expect(t.email.sent[0].subject).toContain("Asha Rao");

    const inApp = await db.adminNotification.findMany();
    expect(inApp).toHaveLength(1);
    expect(inApp[0]).toMatchObject({
      type: "STYLING_ENQUIRY",
      entityType: "StylingEnquiry",
      entityId: e.id,
    });
  });

  it("escapes what the customer typed in the email HTML", async () => {
    await publish();
    const t = fakeTransports(db);
    await submitStylingEnquiry(
      db,
      { ...valid, message: "<script>alert(1)</script> hello there" },
      { transports: t },
    );
    expect(t.email.sent[0].html).not.toContain("<script>");
    expect(t.email.sent[0].html).toContain("&lt;script&gt;");
  });

  it("keeps the enquiry when the email provider is down", async () => {
    await publish();
    const t = fakeTransports(db);
    t.email.failNext = true;
    const e = await submitStylingEnquiry(db, valid, { transports: t });
    expect(await db.stylingEnquiry.findUnique({ where: { id: e.id } })).not.toBeNull();
  });

  it("rejects bad input field by field", async () => {
    await publish();
    const err = await submitStylingEnquiry(
      db,
      { ...valid, email: "nope", message: "hi" },
      { transports: fakeTransports(db) },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ZodError);
    const fields = (err as ZodError).issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "message"]));
    expect(await db.stylingEnquiry.count()).toBe(0);
  });

  it("stores an unknown service as 'Not sure yet'", async () => {
    await publish();
    const e = await submitStylingEnquiry(
      db,
      { ...valid, service: "Something made up" },
      { transports: fakeTransports(db) },
    );
    expect(e.service).toBe("Not sure yet");
  });
});

describe("admin inbox", () => {
  it("lists open enquiries and audits a status change", async () => {
    await publish();
    const e = await submitStylingEnquiry(db, valid, { transports: fakeTransports(db) });

    await updateStylingEnquiry(db, admin, e.id, { status: "CLOSED", note: " Moved " });
    const after = await db.stylingEnquiry.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.status).toBe("CLOSED");
    expect(after.note).toBe("Moved");

    expect(await listStylingEnquiries(db)).toHaveLength(0);
    expect(await listStylingEnquiries(db, { status: "ALL" })).toHaveLength(1);

    const log = await db.adminActivityLog.findFirst({
      where: { action: "styling_enquiry.update", entityId: e.id },
    });
    expect(log).not.toBeNull();
  });
});
