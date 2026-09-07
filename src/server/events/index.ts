import "server-only";

/**
 * Events domain service (master §8). Composition of the transactional outbox
 * producer, the leased dispatcher, durable consumer dedup, operational tasks and
 * the scheduled-recovery job bodies. Inngest wiring lives in `src/inngest`.
 */
import { prisma } from "@/lib/db";
import { requireOwner } from "@/server/auth/require-admin";

import { replayOutboxEvent } from "./dispatcher";

export * from "./emit";
export * from "./dispatcher";
export * from "./side-effects";
export * from "./operational-tasks";
export * from "./scheduled";

/** Owner-only, audited replay for a stuck/failed outbox event. */
export async function replayOutboxAsOwner(outboxEventId: string, reason?: string) {
  const owner = await requireOwner();
  return replayOutboxEvent(prisma, {
    outboxEventId,
    adminUserId: owner.id,
    reason,
  });
}
