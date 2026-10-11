"use server";

import { cookies, headers } from "next/headers";

import { parseUtmCookie, UTM_COOKIE } from "@/lib/attribution";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { InMemoryRateLimiter } from "@/lib/rate-limit";
import {
  EnquiryInputSchema,
  EnquiryUnavailableError,
  submitStylingEnquiry,
} from "@/server/styling";

export type EnquiryFormState =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<string, string>>;
      values: Record<string, string>;
    };

const enquiryLimiter = new InMemoryRateLimiter(5, 10 * 60_000);

const FIELDS = ["name", "email", "phone", "location", "service", "budget", "message"];

/**
 * The /styling enquiry form (D-162). "Thank you" is returned only after the
 * enquiry is saved; any failure sends back what was typed so nothing is lost.
 */
export async function submitEnquiryAction(
  _prev: EnquiryFormState,
  form: FormData,
): Promise<EnquiryFormState> {
  const values = Object.fromEntries(
    FIELDS.map((f) => [f, typeof form.get(f) === "string" ? String(form.get(f)) : ""]),
  );

  // Honeypot: hidden from people, filled in by bots. Pretend it worked.
  if (String(form.get("company") ?? "") !== "") {
    return { status: "sent", name: values.name.trim() };
  }

  // Field errors first and outside the limit, so fixing a typo never counts
  // against anyone; only enquiries that would really be sent are limited.
  const parsed = EnquiryInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
      values,
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!enquiryLimiter.check(`styling:${ip}`).allowed) {
    return {
      status: "error",
      message: "Too many enquiries from here. Please wait a few minutes and try again.",
      values,
    };
  }

  try {
    const utm = parseUtmCookie((await cookies()).get(UTM_COOKIE)?.value);
    const enquiry = await submitStylingEnquiry(prisma, values, { utm });
    return { status: "sent", name: enquiry.name };
  } catch (e) {
    if (e instanceof EnquiryUnavailableError) {
      return { status: "error", message: e.message, values };
    }
    logger.error(
      { err: e instanceof Error ? e.message : String(e) },
      "styling enquiry failed",
    );
    return {
      status: "error",
      message:
        "Sorry, your enquiry didn't go through. Please try again, or message @poojadugar_ on Instagram.",
      values,
    };
  }
}
