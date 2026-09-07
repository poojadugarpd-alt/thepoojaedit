import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/**
 * Durable consumer deduplication (master §8). A side effect is keyed by a stable
 * `executionKey` (typically `<eventId>:<handlerName>`). `runOnce`:
 *  - SUCCEEDED already  → skip (redelivery / replay does not re-run it)
 *  - RUNNING elsewhere  → skip (another worker holds it)
 *  - FAILED / new       → run it, recording SUCCEEDED (+ providerRef) or FAILED
 *
 * `DISPATCHED` on the outbox means "handed to Inngest", NOT "effect completed" —
 * this is where completion is tracked.
 */
export type RunOnceResult<T> =
  | { ran: true; skipped: false; result: T; providerRef?: string }
  | { ran: false; skipped: true; reason: "already_succeeded" | "in_progress" };

export async function runOnce<T>(
  db: PrismaClient,
  input: {
    executionKey: string;
    handlerName: string;
    eventId: string;
    run: () => Promise<{ result: T; providerRef?: string }>;
  },
): Promise<RunOnceResult<T>> {
  // Claim (or discover) the execution row.
  let claimed = false;
  try {
    await db.sideEffectExecution.create({
      data: {
        executionKey: input.executionKey,
        handlerName: input.handlerName,
        eventId: input.eventId,
        status: "RUNNING",
        attempts: 1,
      },
    });
    claimed = true;
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
    const existing = await db.sideEffectExecution.findUniqueOrThrow({
      where: { executionKey: input.executionKey },
    });
    if (existing.status === "SUCCEEDED") {
      return { ran: false, skipped: true, reason: "already_succeeded" };
    }
    if (existing.status === "RUNNING") {
      return { ran: false, skipped: true, reason: "in_progress" };
    }
    // FAILED → retry
    const retook = await db.sideEffectExecution.updateMany({
      where: { executionKey: input.executionKey, status: "FAILED" },
      data: { status: "RUNNING", attempts: { increment: 1 } },
    });
    if (retook.count === 0) {
      return { ran: false, skipped: true, reason: "in_progress" };
    }
    claimed = true;
  }
  void claimed;

  try {
    const { result, providerRef } = await input.run();
    await db.sideEffectExecution.update({
      where: { executionKey: input.executionKey },
      data: { status: "SUCCEEDED", providerRef: providerRef ?? null, lastError: null },
    });
    return { ran: true, skipped: false, result, providerRef };
  } catch (err) {
    await db.sideEffectExecution.update({
      where: { executionKey: input.executionKey },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err; // let the job runner apply its retry policy
  }
}
