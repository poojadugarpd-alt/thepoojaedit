import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { auditLog } from "./audit";

/**
 * Nonsecret store settings + credential health (master §10 — "Show credential
 * health without exposing credentials"). Values written here are business /
 * checkout / shipping / policy config only; secrets never pass through
 * `StoreSettings`.
 */

const EDITABLE_KEYS = [
  "business.profile",
  "checkout.rules",
  "shipping.rules",
  "policy.returns",
  "policy.shipping",
  "policy.privacy",
] as const;
export type SettingKey = (typeof EDITABLE_KEYS)[number];

export async function listSettings(db: PrismaClient) {
  const rows = await db.storeSettings.findMany({ orderBy: { key: "asc" } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return EDITABLE_KEYS.map((key) => ({
    key,
    value: byKey.get(key)?.value ?? null,
    version: byKey.get(key)?.version ?? 0,
    updatedAt: byKey.get(key)?.updatedAt ?? null,
  }));
}

export async function updateSetting(
  db: PrismaClient,
  input: { key: string; value: unknown; adminUserId: string; reason?: string },
): Promise<void> {
  if (!EDITABLE_KEYS.includes(input.key as SettingKey)) {
    throw new Error(`"${input.key}" is not an editable setting.`);
  }
  if (input.value === null || typeof input.value !== "object") {
    throw new Error("Setting value must be a JSON object.");
  }
  await db.$transaction(async (tx) => {
    const before = await tx.storeSettings.findUnique({ where: { key: input.key } });
    await tx.storeSettings.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        value: input.value as object,
        version: 1,
        updatedById: input.adminUserId,
      },
      update: {
        value: input.value as object,
        version: { increment: 1 },
        updatedById: input.adminUserId,
      },
    });
    await auditLog(tx, {
      adminUserId: input.adminUserId,
      action: "settings.update",
      entityType: "StoreSettings",
      entityId: input.key,
      before: before?.value ?? null,
      after: input.value,
      reason: input.reason ?? null,
    });
  });
}

export interface CredentialHealth {
  group: string;
  configured: boolean;
  detail: string;
}

/** Which integrations have their credentials present — never the values. */
export function credentialHealth(): CredentialHealth[] {
  const has = (v: unknown) => Boolean(v);
  return [
    {
      group: "Supabase (auth + storage)",
      configured: isSupabaseConfigured(),
      detail: isSupabaseConfigured() ? "configured" : "not set — admin uses DEV_ADMIN_AUTH",
    },
    {
      group: "Razorpay (prepaid)",
      configured:
        has(publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID) &&
        has(env.RAZORPAY_KEY_SECRET) &&
        has(env.RAZORPAY_WEBHOOK_SECRET),
      detail: "key id / secret / webhook secret",
    },
    {
      group: "Shadowfax (shipping)",
      configured: has(env.SHADOWFAX_API_TOKEN) && has(env.SHADOWFAX_CLIENT_ID),
      detail: "api token / client id" + (has(env.SHADOWFAX_WEBHOOK_TOKEN) ? " / callback token" : ""),
    },
    {
      group: "Resend (email)",
      configured: has(env.RESEND_API_KEY) && has(env.EMAIL_FROM),
      detail: "api key / from" + (has(env.RESEND_WEBHOOK_SECRET) ? " / webhook secret" : ""),
    },
    {
      group: "WhatsApp (Meta)",
      configured: has(env.WHATSAPP_ACCESS_TOKEN) && has(env.WHATSAPP_PHONE_NUMBER_ID),
      detail: "access token / phone id / verify token / app secret",
    },
    {
      group: "Inngest (jobs)",
      configured: has(env.INNGEST_EVENT_KEY) && has(env.INNGEST_SIGNING_KEY),
      detail: "event key / signing key",
    },
  ];
}
