import "server-only";

import { z } from "zod";

import type {
  AdminUser,
  PrismaClient,
  StylingEnquiry,
  StylingEnquiryStatus,
} from "@/generated/prisma";
import type { Utm } from "@/lib/attribution";
import { logger } from "@/lib/logger";
import { auditLog } from "@/server/admin/audit";
import { assertActiveAdmin } from "@/server/admin/guards";
import { sendNotification, type Transports } from "@/server/notifications/service";
import { getTransports, siteUrl } from "@/server/notifications/transports";

import { getStylingContent, serviceOptions } from "./content";

/**
 * Personal Styling enquiries (D-162). The enquiry row is the source of truth:
 * the form says "thank you" only once it is saved, and the email / phone push
 * to Pooja that follow can fail without losing it (it's still in Admin →
 * Styling).
 */

export class EnquiryUnavailableError extends Error {
  constructor() {
    super("Styling enquiries are not open right now.");
    this.name = "EnquiryUnavailableError";
  }
}

const trimmed = (max: number) => z.string().trim().max(max);

export const EnquiryInputSchema = z.object({
  name: trimmed(100).min(1, "Please add your name."),
  email: z.string().trim().max(200).email("Please check your email address."),
  phone: trimmed(30)
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 8, {
      message: "Please check your WhatsApp number.",
    })
    .optional(),
  location: trimmed(100).min(1, "Please tell us where you're based."),
  service: trimmed(120).min(1, "Please pick a service."),
  budget: trimmed(60).optional(),
  message: trimmed(2000).min(10, "Please tell us a little more (a sentence or two)."),
});
export type EnquiryInput = z.input<typeof EnquiryInputSchema>;

export async function submitStylingEnquiry(
  db: PrismaClient,
  raw: EnquiryInput | Record<string, string>,
  opts: { utm?: Utm | null; transports?: Transports } = {},
): Promise<StylingEnquiry> {
  const content = await getStylingContent(db);
  if (!content.published) throw new EnquiryUnavailableError();

  const input = EnquiryInputSchema.parse(raw);
  // A stale tab can post a service that's since been renamed; keep the
  // enquiry rather than reject it, but never store an arbitrary label.
  const service = serviceOptions(content).includes(input.service)
    ? input.service
    : "Not sure yet";

  const enquiry = await db.stylingEnquiry.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      location: input.location,
      service,
      budget: input.budget || null,
      message: input.message,
      utmSource: opts.utm?.source ?? null,
      utmMedium: opts.utm?.medium ?? null,
      utmCampaign: opts.utm?.campaign ?? null,
    },
  });

  const transports = opts.transports ?? getTransports(db);
  const variables = {
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    location: enquiry.location,
    service: enquiry.service,
    budget: enquiry.budget,
    message: enquiry.message,
    adminUrl: siteUrl(`/admin/styling/${enquiry.id}`),
  };
  const sends = [
    { channel: "EMAIL" as const, recipient: content.enquiryEmail },
    { channel: "IN_APP" as const, recipient: "admin" },
  ];
  for (const s of sends) {
    try {
      await sendNotification(db, transports, {
        eventType: "styling.enquiry_received",
        dedupeSeed: `styling-enquiry:${enquiry.id}`,
        channel: s.channel,
        templateKey: "admin_styling_enquiry",
        recipient: s.recipient,
        variables,
        entityType: "StylingEnquiry",
        entityId: enquiry.id,
      });
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e), enquiryId: enquiry.id },
        "styling enquiry notification failed",
      );
    }
  }
  return enquiry;
}

export const ENQUIRY_STATUSES: StylingEnquiryStatus[] = [
  "NEW",
  "REPLIED",
  "BOOKED",
  "CLOSED",
];

export function listStylingEnquiries(
  db: PrismaClient,
  filter: { status?: StylingEnquiryStatus | "OPEN" | "ALL" } = {},
) {
  const status = filter.status ?? "OPEN";
  return db.stylingEnquiry.findMany({
    where:
      status === "ALL"
        ? {}
        : status === "OPEN"
          ? { status: { in: ["NEW", "REPLIED", "BOOKED"] } }
          : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function countNewStylingEnquiries(db: PrismaClient): Promise<number> {
  return db.stylingEnquiry.count({ where: { status: "NEW" } });
}

export async function updateStylingEnquiry(
  db: PrismaClient,
  admin: AdminUser | null,
  id: string,
  patch: { status?: StylingEnquiryStatus; note?: string | null },
): Promise<StylingEnquiry> {
  assertActiveAdmin(admin);
  return db.$transaction(async (tx) => {
    const before = await tx.stylingEnquiry.findUniqueOrThrow({ where: { id } });
    const after = await tx.stylingEnquiry.update({
      where: { id },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
      },
    });
    await auditLog(tx, {
      adminUserId: admin.id,
      action: "styling_enquiry.update",
      entityType: "StylingEnquiry",
      entityId: id,
      before: { status: before.status, note: before.note },
      after: { status: after.status, note: after.note },
    });
    return after;
  });
}
