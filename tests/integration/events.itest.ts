import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  claimOutboxBatch,
  dispatchPending,
  emitDomainEvent,
  markDispatched,
  markFailedAttempt,
  replayOutboxEvent,
  runOnce,
  runReservationSweep,
  type OutboxMessage,
  type OutboxTransport,
} from "../../src/server/events";
import { reserveAll } from "../../src/server/inventory/reservations";
import {
  ingestWebhook,
  WebhookVerificationError,
} from "../../src/server/webhooks/inbox";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
});

async function emit(type = "order.placed") {
  return db.$transaction((tx) =>
    emitDomainEvent(tx, {
      type,
      aggregateType: "Order",
      aggregateId: randomUUID(),
      payload: { n: 1 },
    }),
  );
}

class FakeTransport implements OutboxTransport {
  sent: OutboxMessage[] = [];
  mode: "ok" | "throw" | "throw-after-accept" = "ok";
  remoteAccepted = new Set<string>();
  onSend?: (m: OutboxMessage) => void | Promise<void>;
  async send(m: OutboxMessage) {
    if (this.mode === "throw-after-accept") {
      this.remoteAccepted.add(m.outboxEventId);
      if (this.onSend) await this.onSend(m);
      throw new Error("network dropped after remote accepted");
    }
    if (this.mode === "throw") throw new Error("send failed");
    this.sent.push(m);
    if (this.onSend) await this.onSend(m);
  }
}

describe("transactional outbox", () => {
  it("a committed domain event survives a dispatcher outage and is claimable later", async () => {
    await emit();
    expect(await db.outboxEvent.count({ where: { status: "PENDING" } })).toBe(1);

    // no dispatcher runs for a while... then it comes back
    const batch = await claimOutboxBatch(db, { owner: "w1" });
    expect(batch).toHaveLength(1);
    expect(batch[0].type).toBe("order.placed");
    expect(await db.outboxEvent.count({ where: { status: "DISPATCHING" } })).toBe(1);
  });

  it("a stale lease is recovered by another worker; the original owner cannot mark it", async () => {
    const { outboxEventId } = await emit();
    const t0 = new Date();

    const a = await claimOutboxBatch(db, { owner: "A", leaseMs: 1000, now: t0 });
    expect(a).toHaveLength(1);
    // still leased — a fresh claim gets nothing
    expect(await claimOutboxBatch(db, { owner: "A2", now: t0 })).toHaveLength(0);

    const later = new Date(t0.getTime() + 5000);
    const b = await claimOutboxBatch(db, { owner: "B", now: later });
    expect(b.map((m) => m.outboxEventId)).toEqual([outboxEventId]);
    expect(b[0].attempts).toBe(2);

    // the original owner's mark is rejected
    expect(await markDispatched(db, { outboxEventId, owner: "A" })).toBe(false);
    expect(await markDispatched(db, { outboxEventId, owner: "B" })).toBe(true);
  });

  it("redelivery after a crash between send and mark does not duplicate the local effect", async () => {
    const { outboxEventId, domainEventId } = await emit();
    let effect = 0;
    const consume = (m: OutboxMessage) =>
      runOnce(db, {
        executionKey: `${m.domainEventId}:h`,
        handlerName: "h",
        eventId: m.domainEventId,
        run: async () => {
          effect++;
          return { result: null };
        },
      });

    // delivery 1: claim + send + CONSUME, then "crash" (no markDispatched)
    const t0 = new Date();
    const [msg] = await claimOutboxBatch(db, { owner: "A", leaseMs: 1000, now: t0 });
    await consume(msg);
    expect(effect).toBe(1);

    // delivery 2: lease expired → re-claimed, re-consumed → runOnce skips
    const t1 = new Date(t0.getTime() + 5000);
    const t = new FakeTransport();
    t.onSend = (m) => consume(m).then(() => undefined);
    await dispatchPending(db, { transport: t, owner: "B", now: t1 });

    expect(effect).toBe(1);
    expect(await db.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).toMatchObject({
      status: "DISPATCHED",
    });
    const se = await db.sideEffectExecution.findUniqueOrThrow({
      where: { executionKey: `${domainEventId}:h` },
    });
    expect(se.status).toBe("SUCCEEDED");
  });

  it("remote-unknown outcome: send throws after the remote accepted → next delivery reconciles without a double effect", async () => {
    const { domainEventId } = await emit();
    let effect = 0;
    const t = new FakeTransport();
    t.mode = "throw-after-accept";
    t.onSend = (m) =>
      runOnce(db, {
        executionKey: `${m.domainEventId}:pay`,
        handlerName: "pay",
        eventId: m.domainEventId,
        run: async () => {
          effect++;
          return { result: null, providerRef: "prov_123" };
        },
      }).then(() => undefined);

    const t0 = new Date();
    await dispatchPending(db, { transport: t, owner: "W", now: t0 }); // fails → retry scheduled
    expect(effect).toBe(1);

    // retry (advance past backoff)
    t.mode = "ok";
    await dispatchPending(db, { transport: t, owner: "W", now: new Date(t0.getTime() + 60_000) });
    expect(effect).toBe(1); // deduped by execution key
    const se = await db.sideEffectExecution.findUniqueOrThrow({
      where: { executionKey: `${domainEventId}:pay` },
    });
    expect(se.providerRef).toBe("prov_123");
  });
});

describe("runOnce — durable consumer dedup", () => {
  it("a SUCCEEDED effect is not replayed", async () => {
    let calls = 0;
    const run = async () => {
      calls++;
      return { result: calls };
    };
    const key = randomUUID();
    const eventId = randomUUID();
    const r1 = await runOnce(db, { executionKey: key, handlerName: "h", eventId, run });
    const r2 = await runOnce(db, { executionKey: key, handlerName: "h", eventId, run });
    expect(r1).toMatchObject({ ran: true });
    expect(r2).toMatchObject({ ran: false, reason: "already_succeeded" });
    expect(calls).toBe(1);
  });

  it("a FAILED effect can be retried", async () => {
    let attempt = 0;
    const key = randomUUID();
    const eventId = randomUUID();
    const run = async () => {
      attempt++;
      if (attempt === 1) throw new Error("boom");
      return { result: "ok" };
    };
    await expect(
      runOnce(db, { executionKey: key, handlerName: "h", eventId, run }),
    ).rejects.toThrow("boom");
    const ok = await runOnce(db, { executionKey: key, handlerName: "h", eventId, run });
    expect(ok).toMatchObject({ ran: true });
    const se = await db.sideEffectExecution.findUniqueOrThrow({ where: { executionKey: key } });
    expect(se.status).toBe("SUCCEEDED");
    expect(se.attempts).toBe(2);
  });
});

describe("retry exhaustion → one operational task", () => {
  it("marks the outbox event FAILED and opens exactly one deduped task", async () => {
    const { outboxEventId } = await emit();
    const t = new FakeTransport();
    t.mode = "throw";

    let now = new Date();
    for (let i = 0; i < 5; i++) {
      await dispatchPending(db, { transport: t, owner: "W", maxAttempts: 2, now });
      now = new Date(now.getTime() + 10 * 60_000); // past any backoff
    }

    const ev = await db.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } });
    expect(ev.status).toBe("FAILED");
    const tasks = await db.operationalTask.findMany({ where: { dedupeKey: `outbox:${outboxEventId}` } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("OPEN");
  });
});

describe("authorised, audited replay", () => {
  it("re-queues a FAILED event, writes an audit row and resolves its task", async () => {
    const { outboxEventId } = await emit();
    await markFailedAttempt(db, {
      outboxEventId,
      owner: "W",
      error: "x",
      maxAttempts: 0, // force straight to FAILED + task
    });
    expect(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status,
    ).toBe("FAILED");

    const admin = await db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
    });
    await replayOutboxEvent(db, {
      outboxEventId,
      adminUserId: admin.id,
      reason: "manual recovery",
    });

    const ev = await db.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } });
    expect(ev.status).toBe("PENDING");
    expect(ev.attempts).toBe(0);
    const log = await db.adminActivityLog.findFirstOrThrow({ where: { action: "outbox.replay" } });
    expect(log.entityId).toBe(outboxEventId);
    const task = await db.operationalTask.findUniqueOrThrow({
      where: { dedupeKey: `outbox:${outboxEventId}` },
    });
    expect(task.status).toBe("RESOLVED");
  });
});

describe("scheduled recovery", () => {
  it("the reservation sweep releases expired reservations while the storefront is idle", async () => {
    const p = await db.product.create({
      data: { catalog: "THRIFT", slug: `s-${randomUUID().slice(0, 8)}`, title: "s", status: "PUBLISHED" },
    });
    const v = await db.productVariant.create({
      data: { productId: p.id, sku: `SKU-${randomUUID().slice(0, 8)}`, pricePaise: 1000, onHandQty: 2 },
    });
    const order = await db.order.create({
      data: {
        orderNumber: `O-${randomUUID().slice(0, 10)}`,
        contactPhone: "+910000000000",
        paymentMethod: "PREPAID_RAZORPAY",
        subtotalPaise: 1000,
        totalPaise: 1000,
      },
    });
    await db.$transaction((tx) =>
      reserveAll(tx, { orderId: order.id, lines: [{ variantId: v.id, quantity: 2 }], ttlSeconds: -1 }),
    );
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).reservedQty).toBe(2);

    const { released } = await runReservationSweep(db);
    expect(released).toBe(1);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).reservedQty).toBe(0);
  });
});

describe("webhook inbox", () => {
  const goodVerify = (id: string) => () => ({
    externalEventId: id,
    eventType: "payment.captured",
    parsed: { id },
  });

  it("stores once and deduplicates a redelivered event", async () => {
    const id = `evt_${randomUUID().slice(0, 8)}`;
    const raw = Buffer.from(JSON.stringify({ id }));
    const first = await ingestWebhook(db, {
      provider: "razorpay",
      rawBody: raw,
      headers: new Headers(),
      verify: goodVerify(id),
    });
    const second = await ingestWebhook(db, {
      provider: "razorpay",
      rawBody: raw,
      headers: new Headers(),
      verify: goodVerify(id),
    });
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.event.id).toBe(first.event.id);
    expect(await db.webhookEvent.count()).toBe(1);
  });

  it("rejects an unverified signature before persisting", async () => {
    await expect(
      ingestWebhook(db, {
        provider: "razorpay",
        rawBody: Buffer.from("{}"),
        headers: new Headers(),
        verify: () => {
          throw new WebhookVerificationError();
        },
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
    expect(await db.webhookEvent.count()).toBe(0);
  });
});
