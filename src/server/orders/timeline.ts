import "server-only";

import { after } from "next/server";

import type { Prisma } from "@poojaedit/db";
import { emitDomainEvent } from "@/server/events/emit";

type Tx = Prisma.TransactionClient;

/**
 * Deliver the just-written outbox event(s) to the in-process consumers (emails,
 * admin alert + phone push, invoice, shipment) as soon as the response has
 * gone out — i.e. after the caller's transaction has committed — instead of
 * waiting for a polling job. If the transaction rolled back there is nothing
 * pending and this is a no-op. Outside a request (scripts, tests) `after()`
 * throws; that is fine, the scheduled safety-net job delivers instead.
 * Imported lazily: the consumers import the order lifecycle, which imports
 * this file.
 */
function scheduleInlineDispatch(): void {
  try {
    after(async () => {
      try {
        const { dispatchInline } = await import("@/server/outbox-inline");
        await dispatchInline();
      } catch {
        // Never let delivery trouble surface to the buyer; the safety-net job retries.
      }
    });
  } catch {
    // No request context.
  }
}

/**
 * Append one entry to an order's timeline AND emit the matching domain event on
 * the transactional outbox — in the caller's transaction, so the state change,
 * the human-readable `OrderEvent` and the machine `DomainEvent`/`OutboxEvent`
 * commit or roll back together (master §8).
 */
export async function appendOrderTimeline(
  tx: Tx,
  input: {
    orderId: string;
    type: string;
    payload: Record<string, unknown>;
    /** Admin id/email when a human did this; absent → "system". */
    actor?: string;
  },
): Promise<void> {
  await tx.orderEvent.create({
    data: {
      orderId: input.orderId,
      type: input.type,
      source: input.actor ? "admin" : "system",
      actor: input.actor ?? null,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });
  await emitDomainEvent(tx, {
    type: input.type,
    aggregateType: "Order",
    aggregateId: input.orderId,
    payload: input.payload,
  });
  scheduleInlineDispatch();
}
