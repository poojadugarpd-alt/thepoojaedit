import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { openOperationalTask } from "../../src/server/events/operational-tasks";
import {
  getNotificationPreference,
  isPushConfigured,
  sendAdminPush,
  subscribeAdminPush,
  unsubscribeAdminPush,
  updateNotificationPreference,
} from "../../src/server/notifications/push";
import {
  applyDeliveryCallback,
  notifyForDomainEvent,
  retryNotification,
  sendNotification,
  TemplateVariableError,
} from "../../src/server/notifications/service";
import { fakeTransports } from "../../src/server/notifications/testing";
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

const orderVars = (orderNumber: string) => ({
  orderNumber,
  orderUrl: `https://x.example/order/${orderNumber}`,
  totalPaise: 100000,
  itemCount: 1,
});

async function seedOrder(opts: {
  method?: "PREPAID_RAZORPAY" | "COD";
  email?: string | null;
  phone?: string;
}) {
  return db.order.create({
    data: {
      orderNumber: `PE-${randomUUID().slice(0, 10)}`,
      contactEmail: opts.email === undefined ? "buyer@example.invalid" : opts.email,
      contactPhone: opts.phone ?? "+919812345678",
      paymentMethod: opts.method ?? "PREPAID_RAZORPAY",
      orderStatus: "CONFIRMED",
      paymentStatus: opts.method === "COD" ? "COD_PENDING" : "PAID",
      subtotalPaise: 100000,
      totalPaise: 100000,
      placedAt: new Date(),
    },
  });
}

describe("send eligibility (AC-14)", () => {
  it("a missing email is skipped, never throws, and creates no delivery row", async () => {
    const t = fakeTransports(db);
    const r = await sendNotification(db, t, {
      eventType: "order.payment_settled",
      dedupeSeed: "x",
      channel: "EMAIL",
      templateKey: "order_confirmation_prepaid",
      recipient: "",
      variables: orderVars("PE-1"),
    });
    expect(r.status).toBe("skipped");
    expect(await db.notificationDelivery.count()).toBe(0);
    expect(t.email.sent).toHaveLength(0);
  });

  it("no transactional consent skips WhatsApp", async () => {
    const t = fakeTransports(db);
    const customer = await db.customer.create({
      data: { authUserId: randomUUID(), transactionalConsent: false },
    });
    const r = await sendNotification(db, t, {
      eventType: "order.payment_settled",
      dedupeSeed: "x",
      channel: "WHATSAPP",
      templateKey: "order_confirmation_prepaid",
      recipient: "+919812345678",
      customerId: customer.id,
      variables: orderVars("PE-1"),
    });
    expect(r.status).toBe("skipped");
  });

  it("a disabled template row skips the channel", async () => {
    const t = fakeTransports(db);
    await db.notificationTemplate.create({
      data: {
        key: "order_confirmation_prepaid",
        channel: "EMAIL",
        version: 1,
        language: "en",
        isEnabled: false,
        variableSchema: {},
      },
    });
    const r = await sendNotification(db, t, {
      eventType: "e",
      dedupeSeed: "x",
      channel: "EMAIL",
      templateKey: "order_confirmation_prepaid",
      recipient: "a@b.com",
      variables: orderVars("PE-1"),
    });
    expect(r.status).toBe("skipped");
  });
});

describe("dedup + failure observability (AC-07/10/14)", () => {
  it("a duplicate logical delivery is deduped (one NotificationDelivery)", async () => {
    const t = fakeTransports(db);
    const input = {
      eventType: "order.payment_settled",
      dedupeSeed: "order-confirmed:o1",
      channel: "EMAIL" as const,
      templateKey: "order_confirmation_prepaid" as const,
      recipient: "buyer@example.invalid",
      variables: orderVars("PE-1"),
    };
    const a = await sendNotification(db, t, input);
    const b = await sendNotification(db, t, input);
    expect(a.status).toBe("sent");
    expect(b.status).toBe("deduped");
    expect(await db.notificationDelivery.count()).toBe(1);
    expect(t.email.sent).toHaveLength(1);
  });

  it("a provider outage marks the delivery FAILED + opens a task, and does not throw", async () => {
    const t = fakeTransports(db);
    t.email.failNext = true;
    const r = await sendNotification(db, t, {
      eventType: "e",
      dedupeSeed: "s",
      channel: "EMAIL",
      templateKey: "order_confirmation_prepaid",
      recipient: "buyer@example.invalid",
      variables: orderVars("PE-1"),
    });
    expect(r.status).toBe("failed");
    const d = await db.notificationDelivery.findFirstOrThrow();
    expect(d.status).toBe("FAILED");
    expect(
      await db.operationalTask.count({
        where: { dedupeKey: `notification:${d.id}`, status: "OPEN" },
      }),
    ).toBe(1);
  });

  it("bad template variables throw TemplateVariableError", async () => {
    const t = fakeTransports(db);
    await expect(
      sendNotification(db, t, {
        eventType: "e",
        dedupeSeed: "s",
        channel: "EMAIL",
        templateKey: "order_confirmation_prepaid",
        recipient: "buyer@example.invalid",
        variables: { orderNumber: "only" },
      }),
    ).rejects.toBeInstanceOf(TemplateVariableError);
  });
});

describe("delivery lifecycle (AC-10/14)", () => {
  it("API acceptance is SENT, not DELIVERED; a callback advances it; a stale callback cannot undo it", async () => {
    const t = fakeTransports(db);
    await sendNotification(db, t, {
      eventType: "e",
      dedupeSeed: "s",
      channel: "WHATSAPP",
      templateKey: "order_confirmation_prepaid",
      recipient: "+919812345678",
      variables: orderVars("PE-1"),
    });
    const d = await db.notificationDelivery.findFirstOrThrow();
    expect(d.status).toBe("SENT");
    expect(d.providerMessageId).toBeTruthy();

    const adv = await applyDeliveryCallback(db, {
      providerMessageId: d.providerMessageId!,
      status: "delivered",
    });
    expect(adv.applied).toBe(true);
    expect(
      (await db.notificationDelivery.findUniqueOrThrow({ where: { id: d.id } })).status,
    ).toBe("DELIVERED");

    // a late "sent" callback must not regress
    const stale = await applyDeliveryCallback(db, {
      providerMessageId: d.providerMessageId!,
      status: "sent",
    });
    expect(stale.applied).toBe(false);
    expect(
      (await db.notificationDelivery.findUniqueOrThrow({ where: { id: d.id } })).status,
    ).toBe("DELIVERED");
  });

  it("audited replay re-sends a FAILED delivery", async () => {
    const t = fakeTransports(db);
    t.email.failNext = true;
    const r = await sendNotification(db, t, {
      eventType: "e",
      dedupeSeed: "s",
      channel: "EMAIL",
      templateKey: "order_confirmation_prepaid",
      recipient: "buyer@example.invalid",
      variables: orderVars("PE-1"),
    });
    if (r.status !== "failed") throw new Error("expected failure");

    const admin = await db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
    });
    const retry = await retryNotification(db, t, {
      deliveryId: r.deliveryId,
      adminUserId: admin.id,
    });
    expect(retry.status).toBe("sent");
    expect(
      (await db.notificationDelivery.findUniqueOrThrow({ where: { id: r.deliveryId } }))
        .status,
    ).toBe("SENT");
    expect(
      await db.adminActivityLog.count({ where: { action: "notification.retry" } }),
    ).toBe(1);
  });
});

describe("event → notification mapping (AC-07/14)", () => {
  it("prepaid settlement notifies customer (email + whatsapp) + admin in-app", async () => {
    const order = await seedOrder({ method: "PREPAID_RAZORPAY" });
    const T = fakeTransports(db);
    const res = await notifyForDomainEvent(db, {
      domainEventId: randomUUID(),
      type: "order.payment_settled",
      aggregateType: "Order",
      aggregateId: order.id,
      payload: {},
    }, T);
    const sent = res.results.filter((r) => r.status === "sent").length;
    expect(sent).toBe(3);
    expect(await db.adminNotification.count({ where: { type: "NEW_ORDER" } })).toBe(1);
    const deliveries = await db.notificationDelivery.findMany({ where: { orderId: order.id } });
    expect(deliveries.every((d) => d.status === "SENT")).toBe(true);
  });

  it("COD placement never says 'paid' and raises an admin pending-COD task", async () => {
    const order = await seedOrder({ method: "COD" });
    const T = fakeTransports(db);
    await notifyForDomainEvent(db, {
      domainEventId: randomUUID(),
      type: "order.placed",
      aggregateType: "Order",
      aggregateId: order.id,
      payload: {},
    }, T);
    const deliveries = await db.notificationDelivery.findMany({
      where: { orderId: order.id, channel: "EMAIL" },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].templateKey).toBe("order_confirmation_cod");
    expect(await db.adminNotification.count({ where: { type: "PENDING_COD" } })).toBe(1);
  });

  it("a duplicate domain event for the same transition does not double-send", async () => {
    const order = await seedOrder({ method: "PREPAID_RAZORPAY" });
    const ev = {
      type: "order.payment_settled",
      aggregateType: "Order" as const,
      aggregateId: order.id,
      payload: {},
    };
    const T = fakeTransports(db);
    await notifyForDomainEvent(db, { ...ev, domainEventId: randomUUID() }, T);
    await notifyForDomainEvent(db, { ...ev, domainEventId: randomUUID() }, T); // different event id, same transition
    expect(await db.notificationDelivery.count({ where: { orderId: order.id } })).toBe(3);
    expect(await db.adminNotification.count({ where: { entityId: order.id } })).toBe(1);
  });

  it("one channel failing does not stop the others", async () => {
    // email transport unconfigured in this env → EMAIL is skipped, WHATSAPP + IN_APP still go
    const order = await seedOrder({ method: "PREPAID_RAZORPAY", email: null });
    const T = fakeTransports(db);
    const res = await notifyForDomainEvent(db, {
      domainEventId: randomUUID(),
      type: "order.payment_settled",
      aggregateType: "Order",
      aggregateId: order.id,
      payload: {},
    }, T);
    const statuses = res.results.map((r) => r.status);
    expect(statuses).toContain("skipped"); // email (no address)
    expect(statuses.filter((s) => s === "sent").length).toBeGreaterThanOrEqual(2);
  });
});

// Admin PWA Stage 4 — Web Push. VAPID keys are unset in this test env
// (vitest.integration.config.mts doesn't forward them), so `isPushConfigured()`
// is false throughout and `sendAdminPush` always short-circuits before ever
// calling the real web-push library against a fixture endpoint — this suite
// proves the DB-facing plumbing (subscribe/preference/dedupe wiring), not
// delivery itself.
describe("admin push subscriptions + preferences", () => {
  async function seedAdmin() {
    return db.adminUser.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@x.com`, role: "OWNER" },
    });
  }

  it("VAPID is not configured in the test environment", () => {
    expect(isPushConfigured()).toBe(false);
  });

  it("subscribing twice on the same endpoint upserts, not duplicates", async () => {
    const admin = await seedAdmin();
    const endpoint = `https://push.example/${randomUUID()}`;
    await subscribeAdminPush(db, {
      adminUserId: admin.id,
      subscription: { endpoint, keys: { p256dh: "p1", auth: "a1" } },
    });
    await subscribeAdminPush(db, {
      adminUserId: admin.id,
      subscription: { endpoint, keys: { p256dh: "p2", auth: "a2" } },
    });
    const rows = await db.adminPushSubscription.findMany({ where: { endpoint } });
    expect(rows).toHaveLength(1);
  });

  it("unsubscribe removes the row", async () => {
    const admin = await seedAdmin();
    const endpoint = `https://push.example/${randomUUID()}`;
    await subscribeAdminPush(db, {
      adminUserId: admin.id,
      subscription: { endpoint, keys: { p256dh: "p", auth: "a" } },
    });
    await unsubscribeAdminPush(db, endpoint);
    expect(await db.adminPushSubscription.count({ where: { endpoint } })).toBe(0);
  });

  it("preference defaults to all-on, lazily created on first read", async () => {
    const admin = await seedAdmin();
    expect(await db.adminNotificationPreference.count({ where: { adminUserId: admin.id } })).toBe(
      0,
    );
    const pref = await getNotificationPreference(db, admin.id);
    expect(pref.lowStock).toBe(true);
    expect(pref.newPaidOrder).toBe(true);
    expect(await db.adminNotificationPreference.count({ where: { adminUserId: admin.id } })).toBe(
      1,
    );
  });

  it("updating a preference persists and leaves others untouched", async () => {
    const admin = await seedAdmin();
    await getNotificationPreference(db, admin.id); // lazily create the row
    await updateNotificationPreference(db, admin.id, { lowStock: false });
    const pref = await getNotificationPreference(db, admin.id);
    expect(pref.lowStock).toBe(false);
    expect(pref.shipmentFailure).toBe(true);
  });

  it("sendAdminPush is a documented no-op when VAPID is unconfigured", async () => {
    const admin = await seedAdmin();
    await subscribeAdminPush(db, {
      adminUserId: admin.id,
      subscription: { endpoint: `https://push.example/${randomUUID()}`, keys: { p256dh: "p", auth: "a" } },
    });
    const outcome = await sendAdminPush(db, {
      dedupeKey: `test:${randomUUID()}`,
      preferenceField: "lowStock",
      title: "t",
      body: "b",
    });
    expect(outcome).toEqual({ attempted: false, sent: 0, pruned: 0 });
  });

  it("openOperationalTask never throws when push is unconfigured (LOW_STOCK path)", async () => {
    await expect(
      openOperationalTask(db, {
        dedupeKey: `low-stock:${randomUUID()}`,
        type: "LOW_STOCK",
        entityType: "ProductVariant",
        entityId: randomUUID(),
        priority: 3,
        reason: "available 0 ≤ threshold 2",
      }),
    ).resolves.toMatchObject({ status: "OPEN" });
  });
});
