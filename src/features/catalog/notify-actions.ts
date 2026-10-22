"use server";

import { cookies, headers } from "next/headers";

import type { CatalogType } from "@/generated/prisma";
import { parseUtmCookie, UTM_COOKIE } from "@/lib/attribution";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { InMemoryRateLimiter } from "@/lib/rate-limit";
import {
  InterestEmailSchema,
  InterestUnavailableError,
  registerInterest,
} from "@/server/catalog/interest";

export type NotifyState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string; email: string };

const notifyLimiter = new InMemoryRateLimiter(10, 10 * 60_000);

/** The "Notify me" box on a notify-only product page (D-178). */
export async function notifyMeAction(
  target: { catalog: CatalogType; slug: string },
  _prev: NotifyState,
  form: FormData,
): Promise<NotifyState> {
  const email = String(form.get("email") ?? "");
  // Honeypot: hidden from people, filled in by bots. Pretend it worked.
  if (String(form.get("company") ?? "") !== "") return { status: "sent" };

  if (!InterestEmailSchema.safeParse(email).success) {
    return { status: "error", message: "Please check your email address.", email };
  }
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!notifyLimiter.check(`notify:${ip}`).allowed) {
    return {
      status: "error",
      message: "Too many sign-ups from here. Please wait a few minutes and try again.",
      email,
    };
  }
  try {
    const utm = parseUtmCookie((await cookies()).get(UTM_COOKIE)?.value);
    await registerInterest(prisma, { ...target, email, utm });
    return { status: "sent" };
  } catch (e) {
    if (e instanceof InterestUnavailableError) {
      return { status: "error", message: e.message, email };
    }
    logger.error(
      { err: e instanceof Error ? e.message : String(e) },
      "notify me failed",
    );
    return {
      status: "error",
      message: "Sorry, that didn't go through. Please try again.",
      email,
    };
  }
}
