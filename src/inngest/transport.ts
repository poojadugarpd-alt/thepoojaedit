import "server-only";

import type { OutboxTransport } from "@/server/events";

import { inngest } from "./client";

/**
 * Outbox → Inngest transport. `id` = the outbox event id, so a redelivery (after
 * a crash between send and mark-dispatched) is deduplicated by Inngest as well
 * as by the consumer's `runOnce`. A crash after this send may still cause the
 * consumer to run twice — that is why consumers must be idempotent.
 */
export const inngestTransport: OutboxTransport = {
  async send(message) {
    await inngest.send({
      name: "poojaedit/outbox.dispatched",
      id: message.outboxEventId,
      data: {
        outboxEventId: message.outboxEventId,
        domainEventId: message.domainEventId,
        type: message.type,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        payloadVersion: message.payloadVersion,
        payload: message.payload,
      },
    });
  },
};
