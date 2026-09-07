import "server-only";

import type { PrismaClient } from "@/generated/prisma";

import { openOperationalTask } from "./operational-tasks";

/**
 * Lease-based outbox dispatcher (master §8).
 *
 * A single query claims a bounded batch — fresh `PENDING` events AND stale
 * `DISPATCHING` events whose lease has expired — with `FOR UPDATE SKIP LOCKED`.
 * Each claimed event is sent to the transport; only after the transport
 * acknowledges is it marked `DISPATCHED`. A crash after send but before mark
 * leaves the lease to expire and the event to be re-claimed and re-sent, so
 * consumers must be idempotent (`runOnce`). `DISPATCHED` ≠ effect completed.
 */

export interface OutboxMessage {
  outboxEventId: string;
  domainEventId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payloadVersion: number;
  payload: unknown;
  attempts: number;
}

export interface OutboxTransport {
  /** Deliver the event. Throw on any failure — the dispatcher will retry. */
  send(message: OutboxMessage): Promise<void>;
}

const DEFAULTS = {
  leaseMs: 30_000,
  batchLimit: 50,
  maxAttempts: 8,
  backoffBaseMs: 2_000,
};

function backoffMs(attempts: number, base: number): number {
  const capped = Math.min(base * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
  return Math.round(capped * (0.5 + Math.random() * 0.5)); // full jitter (lower half)
}

/** Claim a batch: fresh PENDING + recovered stale leases. Attempts incremented. */
export async function claimOutboxBatch(
  db: PrismaClient,
  input: { owner: string; leaseMs?: number; limit?: number; now?: Date },
): Promise<OutboxMessage[]> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? DEFAULTS.leaseMs;
  const limit = Math.min(Math.max(input.limit ?? DEFAULTS.batchLimit, 1), 200);
  const leaseUntil = new Date(now.getTime() + leaseMs);

  return db.$queryRawUnsafe<OutboxMessage[]>(
    `WITH claimed AS (
       SELECT o."id"
       FROM "OutboxEvent" o
       WHERE o."availableAt" <= $1
         AND (
           o."status" = 'PENDING'
           OR (o."status" = 'DISPATCHING' AND o."leaseExpiresAt" IS NOT NULL AND o."leaseExpiresAt" < $1)
         )
       ORDER BY o."availableAt" ASC
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
     )
     UPDATE "OutboxEvent" o
        SET "status" = 'DISPATCHING',
            "leaseOwner" = $2,
            "leaseExpiresAt" = $3,
            "attempts" = o."attempts" + 1,
            "updatedAt" = now()
       FROM claimed, "DomainEvent" d
      WHERE o."id" = claimed."id" AND d."id" = o."domainEventId"
      RETURNING
        o."id"            AS "outboxEventId",
        o."domainEventId" AS "domainEventId",
        d."type"          AS "type",
        o."aggregateType" AS "aggregateType",
        o."aggregateId"   AS "aggregateId",
        o."payloadVersion" AS "payloadVersion",
        d."payload"       AS "payload",
        o."attempts"      AS "attempts"`,
    now,
    input.owner,
    leaseUntil,
  );
}

export async function markDispatched(
  db: PrismaClient,
  input: { outboxEventId: string; owner: string },
): Promise<boolean> {
  const res = await db.outboxEvent.updateMany({
    where: { id: input.outboxEventId, leaseOwner: input.owner },
    data: {
      status: "DISPATCHED",
      dispatchedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: null,
    },
  });
  return res.count > 0;
}

export async function markFailedAttempt(
  db: PrismaClient,
  input: {
    outboxEventId: string;
    owner: string;
    error: string;
    maxAttempts?: number;
    backoffBaseMs?: number;
    now?: Date;
  },
): Promise<"retry" | "exhausted"> {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? DEFAULTS.maxAttempts;
  const row = await db.outboxEvent.findUniqueOrThrow({
    where: { id: input.outboxEventId },
    select: { attempts: true },
  });

  if (row.attempts >= maxAttempts) {
    await db.outboxEvent.update({
      where: { id: input.outboxEventId },
      data: { status: "FAILED", lastError: input.error, leaseOwner: null, leaseExpiresAt: null },
    });
    await openOperationalTask(db, {
      dedupeKey: `outbox:${input.outboxEventId}`,
      type: "JOB_FAILURE",
      entityType: "OutboxEvent",
      entityId: input.outboxEventId,
      priority: 1,
      reason: `Delivery exhausted after ${row.attempts} attempts: ${input.error}`,
    });
    return "exhausted";
  }

  await db.outboxEvent.update({
    where: { id: input.outboxEventId },
    data: {
      status: "PENDING",
      lastError: input.error,
      leaseOwner: null,
      leaseExpiresAt: null,
      availableAt: new Date(
        now.getTime() + backoffMs(row.attempts, input.backoffBaseMs ?? DEFAULTS.backoffBaseMs),
      ),
    },
  });
  return "retry";
}

export interface DispatchSummary {
  claimed: number;
  dispatched: number;
  retried: number;
  exhausted: number;
}

export async function dispatchPending(
  db: PrismaClient,
  input: {
    transport: OutboxTransport;
    owner: string;
    leaseMs?: number;
    batchLimit?: number;
    maxAttempts?: number;
    now?: Date;
  },
): Promise<DispatchSummary> {
  const batch = await claimOutboxBatch(db, {
    owner: input.owner,
    leaseMs: input.leaseMs,
    limit: input.batchLimit,
    now: input.now,
  });
  const summary: DispatchSummary = {
    claimed: batch.length,
    dispatched: 0,
    retried: 0,
    exhausted: 0,
  };

  for (const message of batch) {
    try {
      await input.transport.send(message);
      await markDispatched(db, { outboxEventId: message.outboxEventId, owner: input.owner });
      summary.dispatched++;
    } catch (err) {
      const outcome = await markFailedAttempt(db, {
        outboxEventId: message.outboxEventId,
        owner: input.owner,
        error: err instanceof Error ? err.message : String(err),
        maxAttempts: input.maxAttempts,
        now: input.now,
      });
      if (outcome === "exhausted") summary.exhausted++;
      else summary.retried++;
    }
  }
  return summary;
}

/**
 * Authorised, audited replay of a FAILED (or stuck) outbox event (master §8).
 */
export async function replayOutboxEvent(
  db: PrismaClient,
  input: { outboxEventId: string; adminUserId: string; reason?: string },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.outboxEvent.findUniqueOrThrow({
      where: { id: input.outboxEventId },
      select: { status: true, attempts: true },
    });
    await tx.outboxEvent.update({
      where: { id: input.outboxEventId },
      data: {
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "outbox.replay",
        entityType: "OutboxEvent",
        entityId: input.outboxEventId,
        before: { status: row.status, attempts: row.attempts },
        after: { status: "PENDING", attempts: 0 },
        reason: input.reason ?? null,
      },
    });
    await tx.operationalTask.updateMany({
      where: { dedupeKey: `outbox:${input.outboxEventId}`, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  });
}
