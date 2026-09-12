import "server-only";

import { randomUUID } from "node:crypto";

import webpush from "web-push";

import type { AdminNotificationPreference, PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";
import { publicEnv } from "@/lib/public-env";
import { runOnce } from "@/server/events/side-effects";

// Not imported from ./transports — that module imports sendAdminPush from
// here, and a shared `siteUrl` would make the two files circularly
// dependent. Same one-line logic, kept in both places deliberately.
function siteUrl(path: string): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The 7 categories an admin can turn off — every field on the preference row. */
export type PushPreferenceField = keyof Omit<
  AdminNotificationPreference,
  "id" | "adminUserId" | "updatedAt"
>;

export function isPushConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
  );
}

function vapidDetails() {
  return {
    subject: env.VAPID_SUBJECT!,
    publicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: env.VAPID_PRIVATE_KEY!,
  };
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Called once from the browser right after `pushManager.subscribe()` succeeds. */
export async function subscribeAdminPush(
  db: PrismaClient,
  input: { adminUserId: string; subscription: PushSubscriptionInput; userAgent?: string | null },
) {
  return db.adminPushSubscription.upsert({
    where: { endpoint: input.subscription.endpoint },
    update: { lastSeenAt: new Date(), userAgent: input.userAgent ?? null },
    create: {
      adminUserId: input.adminUserId,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

/** Called on explicit "turn off notifications" or when the SW's own unsubscribe fires. */
export async function unsubscribeAdminPush(db: PrismaClient, endpoint: string) {
  await db.adminPushSubscription.deleteMany({ where: { endpoint } });
}

export async function getNotificationPreference(db: PrismaClient, adminUserId: string) {
  return db.adminNotificationPreference.upsert({
    where: { adminUserId },
    update: {},
    create: { adminUserId },
  });
}

export async function updateNotificationPreference(
  db: PrismaClient,
  adminUserId: string,
  patch: Partial<Record<PushPreferenceField, boolean>>,
) {
  return db.adminNotificationPreference.upsert({
    where: { adminUserId },
    update: patch,
    create: { adminUserId, ...patch },
  });
}

export interface AdminPushInput {
  /** Identifies WHAT this is about — the dedupe unit, e.g. an AdminNotification
   *  row id, or `low-stock-push:<variantId>:<YYYY-MM-DD>`. Never reused across
   *  two genuinely different occurrences. */
  dedupeKey: string;
  preferenceField: PushPreferenceField;
  title: string;
  body: string;
  /** Relative admin path opened when the notification is tapped. */
  path?: string;
}

/**
 * Push to every admin who hasn't turned this category off, on every device
 * they've installed the app on. Wrapped in the same `runOnce` idempotency
 * used for outbox side effects — a redelivery or retry of whatever called
 * this can never send the same push twice. Never throws: an unconfigured
 * VAPID keypair, a channel failure, or a pruned-away subscription are all
 * "nothing to do" here, exactly like `sendNotification`'s email/WhatsApp
 * channels — a push failure must never affect the order/inventory logic
 * that triggered it.
 *
 * Deliberately only ever called from the moment an event/task first occurs
 * (see the two call sites: `dbInAppTransport` and `openOperationalTask`) —
 * never from a backfill, reconciliation sweep, or historical replay, so a
 * push is always about something that just happened, never something old.
 */
export async function sendAdminPush(
  db: PrismaClient,
  input: AdminPushInput,
): Promise<{ attempted: boolean; sent: number; pruned: number }> {
  if (!isPushConfigured()) return { attempted: false, sent: 0, pruned: 0 };

  const outcome = await runOnce(db, {
    executionKey: `push:${input.dedupeKey}`,
    handlerName: "admin-push",
    // No real DomainEvent backs most of these (a low-stock check, a task
    // open) — SideEffectExecution.eventId has no FK, it's an informational
    // column, so a fresh id here is fine; the actual dedup key is
    // `executionKey`, which is stable.
    eventId: randomUUID(),
    run: async () => {
      const subs = await db.adminPushSubscription.findMany({
        where: {
          admin: {
            OR: [
              { notificationPreference: null }, // no row yet = defaults = on
              { notificationPreference: { [input.preferenceField]: true } },
            ],
          },
        },
      });

      let sent = 0;
      let pruned = 0;
      const payload = JSON.stringify({
        title: input.title,
        body: input.body,
        url: input.path ? siteUrl(input.path) : siteUrl("/admin"),
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { vapidDetails: vapidDetails(), TTL: 60 * 60 * 12 },
          );
          sent += 1;
          await db.adminPushSubscription.update({
            where: { id: sub.id },
            data: { lastSeenAt: new Date() },
          });
        } catch (e) {
          const statusCode = (e as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // The push service says this install no longer exists — prune
            // it rather than retry it forever.
            await db.adminPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            pruned += 1;
          }
          // Any other failure (network blip, payload too large) is simply
          // not retried — the next real occurrence of this event will try
          // again with a fresh dedupeKey; there is nothing to queue this
          // one behind.
        }
      }
      return { result: { sent, pruned } };
    },
  });

  if (!outcome.ran) return { attempted: false, sent: 0, pruned: 0 };
  return { attempted: true, ...outcome.result };
}
