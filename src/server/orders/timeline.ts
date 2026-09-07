import "server-only";

import type { Prisma } from "@/generated/prisma";
import { emitDomainEvent } from "@/server/events/emit";

type Tx = Prisma.TransactionClient;

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
}
