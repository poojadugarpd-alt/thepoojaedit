import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { expireReservations } from "@/server/inventory/reservations";
import type { ReconcilePort } from "@/server/webhooks/inbox";

import { openOperationalTask } from "./operational-tasks";

/**
 * Bodies for the recurring recovery jobs (master §8). Scheduled by Inngest
 * (src/inngest); kept as plain functions so they are testable and never depend
 * on a request process staying alive.
 */

/** Release reservations whose TTL has passed — even while the storefront is idle. */
export async function runReservationSweep(
  db: PrismaClient,
  opts: { batchLimit?: number; now?: Date } = {},
): Promise<{ released: number }> {
  const released = await db.$transaction((tx) =>
    expireReservations(tx, { now: opts.now, limit: opts.batchLimit }),
  );
  return { released };
}

/**
 * Alert on outbox events that have been FAILED or stuck DISPATCHING beyond a
 * threshold — surfaced once as an OperationalTask.
 */
export async function runStaleOutboxAlert(
  db: PrismaClient,
  opts: { stuckAfterMs?: number; now?: Date } = {},
): Promise<{ failed: number; stuck: number }> {
  const now = opts.now ?? new Date();
  const stuckBefore = new Date(now.getTime() - (opts.stuckAfterMs ?? 10 * 60_000));

  const [failed, stuck] = await Promise.all([
    db.outboxEvent.count({ where: { status: "FAILED" } }),
    db.outboxEvent.count({
      where: { status: "DISPATCHING", leaseExpiresAt: { lt: stuckBefore } },
    }),
  ]);

  if (failed + stuck > 0) {
    await openOperationalTask(db, {
      dedupeKey: "outbox:health",
      type: "JOB_FAILURE",
      priority: 2,
      reason: `${failed} failed, ${stuck} stuck outbox events`,
    });
  }
  return { failed, stuck };
}

/** Run each provider's reconciliation pass (payment / shipment). */
export async function runReconciliation(
  ports: ReconcilePort[],
  now: Date = new Date(),
): Promise<Record<string, { checked: number; updated: number; unresolved: number }>> {
  const out: Record<string, { checked: number; updated: number; unresolved: number }> = {};
  for (const port of ports) {
    out[port.name] = await port.reconcilePending(now);
  }
  return out;
}
