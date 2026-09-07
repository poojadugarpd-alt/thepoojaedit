import "server-only";

import { createHash } from "node:crypto";

import type { PrismaClient, WebhookEvent } from "@/generated/prisma";

/**
 * Durable webhook inbox (master §8). A provider callback is verified with the
 * provider's OWN documented mechanism, then stored + deduplicated BEFORE it is
 * acknowledged. If persistence fails, the caller returns a retriable error so
 * the provider redelivers. Processing is idempotent and keyed off the stored
 * event, never re-derived from the wire each time.
 */
export class WebhookVerificationError extends Error {
  constructor(message = "Webhook signature verification failed") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export interface VerifiedWebhook {
  externalEventId: string;
  eventType: string;
  parsed: unknown;
}

/** Provider-specific: validate the raw bytes and pull out the stable event id. */
export type WebhookVerifier = (
  rawBody: Buffer,
  headers: Headers,
) => VerifiedWebhook;

export interface IngestResult {
  isNew: boolean;
  event: WebhookEvent;
}

export async function ingestWebhook(
  db: PrismaClient,
  input: { provider: string; rawBody: Buffer; headers: Headers; verify: WebhookVerifier },
): Promise<IngestResult> {
  const verified = input.verify(input.rawBody, input.headers); // throws WebhookVerificationError
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");

  try {
    const event = await db.webhookEvent.create({
      data: {
        provider: input.provider,
        externalEventId: verified.externalEventId,
        eventType: verified.eventType,
        payloadHash,
        payload: verified.parsed as object,
        status: "RECEIVED",
      },
    });
    return { isNew: true, event };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      const event = await db.webhookEvent.findUniqueOrThrow({
        where: {
          provider_externalEventId: {
            provider: input.provider,
            externalEventId: verified.externalEventId,
          },
        },
      });
      return { isNew: false, event };
    }
    throw e; // persistence failure → caller returns a retriable 5xx
  }
}

export async function markWebhookProcessed(
  db: PrismaClient,
  id: string,
): Promise<void> {
  await db.webhookEvent.update({
    where: { id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
}

export async function markWebhookFailed(
  db: PrismaClient,
  id: string,
  error: string,
): Promise<void> {
  await db.webhookEvent.update({
    where: { id },
    data: { status: "FAILED", lastError: error, attempts: { increment: 1 } },
  });
}

/**
 * Reconciliation port for a provider whose callbacks may be missed or ambiguous
 * (master §8). Phase 7 (Razorpay) and Phase 8 (Shiprocket) implement it; a
 * scheduled job polls `reconcilePending`.
 */
export interface ReconcilePort {
  readonly name: string;
  reconcilePending(now: Date): Promise<{ checked: number; updated: number; unresolved: number }>;
}
