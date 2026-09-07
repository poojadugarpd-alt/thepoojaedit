import "server-only";

import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Transactional outbox producer (master §8). Writes a `DomainEvent` and its
 * `OutboxEvent` in the SAME transaction as the state change that caused it, so a
 * committed change always has a pending event and a rolled-back change leaves
 * nothing to dispatch.
 */
export async function emitDomainEvent(
  tx: Tx,
  input: {
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    version?: number;
    /** Delay first delivery (e.g. a scheduled effect). */
    availableAt?: Date;
  },
): Promise<{ domainEventId: string; outboxEventId: string }> {
  const domainEvent = await tx.domainEvent.create({
    data: {
      type: input.type,
      version: input.version ?? 1,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  const outbox = await tx.outboxEvent.create({
    data: {
      domainEventId: domainEvent.id,
      payloadVersion: input.version ?? 1,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      availableAt: input.availableAt ?? new Date(),
    },
    select: { id: true },
  });
  return { domainEventId: domainEvent.id, outboxEventId: outbox.id };
}
