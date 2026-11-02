import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import type {
  AdminUser,
  PrismaClient,
  Review,
  ReviewInvite,
  ReviewSite,
  ReviewStatus,
} from "@/generated/prisma";
import type { Utm } from "@/lib/attribution";
import { logger } from "@/lib/logger";
import { auditLog } from "@/server/admin/audit";
import { assertActiveAdmin } from "@/server/admin/guards";
import { sendNotification, type Transports } from "@/server/notifications/service";
import { getTransports, siteUrl } from "@/server/notifications/transports";
import { getStylingContent } from "@/server/styling/content";

/**
 * Client reviews for Personal Styling and the editing studio.
 *
 * The row is the source of truth: the form says thank you once it is saved,
 * and the email to Pooja that follows may fail without losing it. Every review
 * starts PENDING and only shows publicly after Pooja approves it. Email, phone
 * and the IP hash are private and never leave this module in a public shape.
 */

export class ReviewRateLimitError extends Error {
  constructor() {
    super("Too many reviews from this connection. Please try again later.");
    this.name = "ReviewRateLimitError";
  }
}

/** Cache tag for anything that shows approved reviews. */
export const REVIEWS_TAG = "reviews";

const trimmed = (max: number) => z.string().trim().max(max);

/** No links in a review: keeps spam and ads out. */
const NO_LINKS = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|co|net|org|io|me|ly)\b)/i;

export const ReviewInputSchema = z.object({
  site: z.enum(["STYLING", "STUDIO"]),
  service: trimmed(120).min(1, "Please pick the service you used."),
  rating: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(5).optional(),
  ),
  text: trimmed(1500)
    .min(10, "Please write a sentence or two.")
    .refine((v) => !NO_LINKS.test(v), { message: "Please leave out web links." }),
  displayName: trimmed(60).min(1, "Please add the name to show with your review."),
  instagram: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/^@/, "") : v),
    z
      .string()
      .regex(/^[A-Za-z0-9._]{1,30}$/, "Please check your Instagram handle.")
      .or(z.literal(""))
      .optional(),
  ),
  showInstagram: z.boolean().optional().default(false),
  email: z.string().trim().max(200).email("Please check your email address."),
  phone: trimmed(30)
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 8, {
      message: "Please check your WhatsApp number.",
    })
    .optional(),
  consentPublish: z.literal(true, {
    error: "Please tick the box to let us show your review.",
  }),
  consentContact: z.boolean().optional().default(false),
});
export type ReviewInput = z.input<typeof ReviewInputSchema>;

const SITE_LABEL: Record<ReviewSite, string> = {
  STYLING: "styling",
  STUDIO: "editing",
};

/** Salted hash of an IP. Used only to rate-limit; the IP itself is never stored. */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.REVIEW_IP_SALT ?? "tpe-review"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

const MAX_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

export async function submitReview(
  db: PrismaClient,
  raw: ReviewInput | Record<string, unknown>,
  opts: {
    inviteToken?: string | null;
    ipHash?: string | null;
    utm?: Utm | null;
    transports?: Transports;
  } = {},
): Promise<Review> {
  const input = ReviewInputSchema.parse(raw);
  const email = input.email.toLowerCase();

  if (opts.ipHash) {
    const recent = await db.review.count({
      where: { ipHash: opts.ipHash, createdAt: { gt: new Date(Date.now() - HOUR_MS) } },
    });
    if (recent >= MAX_PER_HOUR) throw new ReviewRateLimitError();
  }

  // The same person posting the same words twice (a double tap) is one review.
  const dup = await db.review.findFirst({
    where: {
      site: input.site,
      email,
      text: input.text,
      createdAt: { gt: new Date(Date.now() - 24 * HOUR_MS) },
    },
  });
  if (dup) return dup;

  // A valid, unused, unexpired invite for this site marks the review verified.
  // Anything else (bad, used or expired link) just posts as an open review.
  let invite: ReviewInvite | null = null;
  if (opts.inviteToken) {
    const found = await db.reviewInvite.findUnique({
      where: { token: opts.inviteToken },
    });
    if (
      found &&
      found.site === input.site &&
      !found.usedAt &&
      (!found.expiresAt || found.expiresAt > new Date())
    ) {
      invite = found;
    }
  }

  const review = await db.$transaction(async (tx) => {
    if (invite) {
      const claimed = await tx.reviewInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) invite = null;
    }
    return tx.review.create({
      data: {
        site: input.site,
        service: input.service,
        rating: input.rating ?? null,
        text: input.text,
        displayName: input.displayName,
        instagram: input.instagram || null,
        showInstagram: Boolean(input.instagram) && input.showInstagram,
        email,
        phone: input.phone || null,
        consentPublish: true,
        consentContact: input.consentContact,
        source: invite ? "INVITE" : "OPEN",
        inviteId: invite?.id ?? null,
        ipHash: opts.ipHash ?? null,
        utmSource: opts.utm?.source ?? null,
        utmMedium: opts.utm?.medium ?? null,
        utmCampaign: opts.utm?.campaign ?? null,
      },
    });
  });

  const transports = opts.transports ?? getTransports(db);
  let ownerEmail = "";
  try {
    ownerEmail = (await getStylingContent(db)).enquiryEmail;
  } catch {
    ownerEmail = "";
  }
  const variables = {
    displayName: review.displayName,
    siteLabel: SITE_LABEL[review.site],
    service: review.service,
    rating: review.rating,
    text: review.text,
    email: review.email,
    phone: review.phone,
    verified: review.source === "INVITE",
    adminUrl: siteUrl("/admin/reviews"),
  };
  const sends = [
    ...(ownerEmail ? [{ channel: "EMAIL" as const, recipient: ownerEmail }] : []),
    { channel: "IN_APP" as const, recipient: "admin" },
  ];
  for (const s of sends) {
    try {
      await sendNotification(db, transports, {
        eventType: "review.received",
        dedupeSeed: `review:${review.id}`,
        channel: s.channel,
        templateKey: "admin_review_received",
        recipient: s.recipient,
        variables,
        entityType: "Review",
        entityId: review.id,
      });
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e), reviewId: review.id },
        "review notification failed",
      );
    }
  }
  return review;
}

/** What the public may see. Never includes email, phone, notes or the IP hash. */
export interface PublicReview {
  id: string;
  site: ReviewSite;
  service: string;
  rating: number | null;
  text: string;
  displayName: string;
  instagram: string | null;
  verified: boolean;
  approvedAt: string;
}

export function toPublicReview(r: Review): PublicReview {
  return {
    id: r.id,
    site: r.site,
    service: r.service,
    rating: r.rating,
    text: r.text,
    displayName: r.displayName,
    instagram: r.showInstagram ? r.instagram : null,
    verified: r.source === "INVITE",
    approvedAt: (r.approvedAt ?? r.createdAt).toISOString(),
  };
}

export async function listApprovedReviews(
  db: PrismaClient,
  site: ReviewSite,
  limit = 50,
): Promise<PublicReview[]> {
  const rows = await db.review.findMany({
    where: { site, status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(toPublicReview);
}

// ── Admin ──────────────────────────────────────────────────────────────

export const REVIEW_STATUSES: ReviewStatus[] = ["PENDING", "APPROVED", "HIDDEN"];

export function listReviews(
  db: PrismaClient,
  filter: { status?: ReviewStatus | "ALL"; site?: ReviewSite } = {},
) {
  const status = filter.status ?? "PENDING";
  return db.review.findMany({
    where: {
      ...(status === "ALL" ? {} : { status }),
      ...(filter.site ? { site: filter.site } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function countPendingReviews(db: PrismaClient): Promise<number> {
  return db.review.count({ where: { status: "PENDING" } });
}

export async function updateReview(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
  patch: {
    status?: ReviewStatus;
    text?: string;
    displayName?: string;
    note?: string | null;
  },
): Promise<Review> {
  assertActiveAdmin(admin);
  return db.$transaction(async (tx) => {
    const before = await tx.review.findUniqueOrThrow({ where: { id } });
    const text = patch.text?.trim();
    const displayName = patch.displayName?.trim();
    if (text !== undefined && text.length < 10)
      throw new Error("Review text is too short.");
    if (displayName !== undefined && !displayName) throw new Error("Name is required.");
    const after = await tx.review.update({
      where: { id },
      data: {
        ...(patch.status
          ? {
              status: patch.status,
              approvedAt:
                patch.status === "APPROVED" ? (before.approvedAt ?? new Date()) : null,
            }
          : {}),
        ...(text !== undefined ? { text } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
      },
    });
    await auditLog(tx, {
      adminUserId: admin.id,
      action: "review.update",
      entityType: "Review",
      entityId: id,
      before: {
        status: before.status,
        text: before.text,
        displayName: before.displayName,
      },
      after: { status: after.status, text: after.text, displayName: after.displayName },
    });
    return after;
  });
}

export async function deleteReview(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
): Promise<void> {
  assertActiveAdmin(admin);
  await db.$transaction(async (tx) => {
    const before = await tx.review.findUniqueOrThrow({ where: { id } });
    await tx.review.delete({ where: { id } });
    await auditLog(tx, {
      adminUserId: admin.id,
      action: "review.delete",
      entityType: "Review",
      entityId: id,
      before: { status: before.status, site: before.site },
      after: null,
    });
  });
}

export async function createReviewInvite(
  db: PrismaClient,
  admin: AdminUser | null,
  input: {
    clientName: string;
    site: ReviewSite;
    service: string;
    expiresInDays?: number;
  },
): Promise<ReviewInvite> {
  assertActiveAdmin(admin);
  const clientName = input.clientName.trim();
  const service = input.service.trim();
  if (!clientName || !service) throw new Error("Client name and service are required.");
  const days = input.expiresInDays ?? 60;
  return db.reviewInvite.create({
    data: {
      token: randomBytes(18).toString("base64url"),
      clientName,
      site: input.site,
      service,
      expiresAt: new Date(Date.now() + days * 24 * HOUR_MS),
    },
  });
}

export function listReviewInvites(db: PrismaClient) {
  return db.reviewInvite.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getReviewInvite(
  db: PrismaClient,
  token: string,
): Promise<ReviewInvite | null> {
  const found = await db.reviewInvite.findUnique({ where: { token } });
  if (!found || found.usedAt) return null;
  if (found.expiresAt && found.expiresAt <= new Date()) return null;
  return found;
}
