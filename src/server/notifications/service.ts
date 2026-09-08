import "server-only";

import type { NotificationDelivery, PrismaClient } from "@/generated/prisma";
import { logger } from "@/lib/logger";
import { openOperationalTask } from "@/server/events/operational-tasks";

import {
  renderTemplate,
  templateVersion,
  type NotifChannel,
  type TemplateKey,
} from "./templates";
import {
  getTransports,
  siteUrl,
  type EmailMessage,
  type InAppMessage,
  type Transports,
  type WhatsAppMessage,
} from "./transports";

export type { Transports } from "./transports";
export { TemplateVariableError } from "./templates";

const isP2002 = (e: unknown) => (e as { code?: string })?.code === "P2002";

export interface SendNotificationInput {
  /** Business event, e.g. "order.payment_settled". */
  eventType: string;
  /** Stable per-TRANSITION seed so different events for the same transition
   *  collapse to one logical delivery, e.g. "order-confirmed:<orderId>". */
  dedupeSeed: string;
  channel: NotifChannel;
  templateKey: TemplateKey;
  /** email address / phone / "admin". */
  recipient: string;
  variables: Record<string, unknown>;
  domainEventId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  /** in-app only */
  entityType?: string;
  entityId?: string;
}

export type SendOutcome =
  | { status: "sent" | "queued"; deliveryId: string }
  | { status: "deduped" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; deliveryId: string; error: string };

/**
 * Send one notification. Channel eligibility / consent failures return
 * `skipped` (NEVER throw — a missing email must not break checkout). A transport
 * failure returns `failed` and opens an observable task. Only a genuine caller
 * bug (bad template variables) throws.
 */
export async function sendNotification(
  db: PrismaClient,
  transports: Transports,
  input: SendNotificationInput,
): Promise<SendOutcome> {
  const version = templateVersion(input.templateKey);

  // Admin can disable a channel via a NotificationTemplate row; absent row = on.
  const tmplRow = await db.notificationTemplate.findUnique({
    where: {
      key_channel_version_language: {
        key: input.templateKey,
        channel: input.channel,
        version,
        language: "en",
      },
    },
  });
  if (tmplRow && !tmplRow.isEnabled) {
    return { status: "skipped", reason: "template disabled" };
  }

  // Eligibility
  if (input.channel === "EMAIL") {
    if (!input.recipient || !input.recipient.includes("@")) {
      return { status: "skipped", reason: "no email address" };
    }
  } else if (input.channel === "WHATSAPP") {
    if (!input.recipient || input.recipient.replace(/\D/g, "").length < 8) {
      return { status: "skipped", reason: "no phone number" };
    }
    if (input.customerId) {
      const c = await db.customer.findUnique({ where: { id: input.customerId } });
      if (c && c.transactionalConsent === false) {
        return { status: "skipped", reason: "no transactional consent" };
      }
    }
  }

  const deliveryKey = [
    input.eventType,
    input.dedupeSeed,
    input.recipient,
    input.channel,
    input.templateKey,
    version,
  ].join(":");

  let delivery: NotificationDelivery;
  try {
    delivery = await db.notificationDelivery.create({
      data: {
        deliveryKey,
        domainEventId: input.domainEventId ?? null,
        orderId: input.orderId ?? null,
        customerId: input.customerId ?? null,
        channel: input.channel,
        recipient: input.recipient,
        templateKey: input.templateKey,
        templateVersion: version,
        status: "QUEUED",
      },
    });
  } catch (e) {
    if (isP2002(e)) return { status: "deduped" };
    throw e;
  }

  // Render — a failure here is a caller bug; surface it.
  const rendered = renderTemplate(input.templateKey, input.channel, input.variables);

  try {
    let providerMessageId: string | null = null;
    if (input.channel === "EMAIL") {
      const r = rendered as { subject: string; html: string; text: string };
      const msg: EmailMessage = { to: input.recipient, ...r };
      ({ providerMessageId } = await transports.email.send(msg));
    } else if (input.channel === "WHATSAPP") {
      const r = rendered as { templateName: string; bodyParams: string[]; text: string };
      const msg: WhatsAppMessage = { to: input.recipient, ...r };
      ({ providerMessageId } = await transports.whatsapp.send(msg));
    } else {
      const r = rendered as { type: string; title: string; message: string; priority: number };
      const msg: InAppMessage = {
        entityType: input.entityType ?? "Order",
        entityId: input.entityId ?? input.orderId ?? delivery.id,
        ...r,
      };
      ({ providerMessageId } = await transports.inApp.send(msg));
    }

    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        providerMessageId,
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    return { status: "sent", deliveryId: delivery.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: error, attempts: { increment: 1 } },
    });
    await openOperationalTask(db, {
      dedupeKey: `notification:${delivery.id}`,
      type: "JOB_FAILURE",
      entityType: "NotificationDelivery",
      entityId: delivery.id,
      priority: 2,
      reason: `${input.channel} ${input.templateKey}: ${error}`,
    });
    return { status: "failed", deliveryId: delivery.id, error };
  }
}

// ─────────────────── event → notification mapping ──────────────────────────

interface DomainEventLike {
  domainEventId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}

/**
 * Fan a dispatched domain event out to the customer + admin notifications the
 * master's matrix requires. One channel/template failure never aborts the rest,
 * and never affects order/payment state.
 */
export async function notifyForDomainEvent(
  db: PrismaClient,
  event: DomainEventLike,
  transportsOverride?: Transports,
): Promise<{ results: SendOutcome[] }> {
  if (event.aggregateType !== "Order") return { results: [] };
  const transports = transportsOverride ?? getTransports(db);
  const order = await db.order.findUnique({
    where: { id: event.aggregateId },
    include: { shipments: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return { results: [] };

  const orderUrl = siteUrl(`/order/${order.orderNumber}`);
  const results: SendOutcome[] = [];
  const run = async (i: Omit<SendNotificationInput, "eventType" | "domainEventId">) => {
    try {
      results.push(
        await sendNotification(db, transports, {
          ...i,
          eventType: event.type,
          domainEventId: event.domainEventId,
        }),
      );
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e), template: i.templateKey },
        "notification render/dispatch error",
      );
      results.push({ status: "skipped", reason: "render error" });
    }
  };

  const custEmail = order.contactEmail ?? "";
  const custPhone = order.contactPhone ?? "";
  const shipment = order.shipments[0];

  switch (event.type) {
    case "order.placed":
      if (order.paymentMethod === "COD") {
        await run({
          dedupeSeed: `cod-received:${order.id}`,
          channel: "EMAIL",
          templateKey: "order_confirmation_cod",
          recipient: custEmail,
          orderId: order.id,
          customerId: order.customerId,
          variables: {
            orderNumber: order.orderNumber,
            orderUrl,
            totalPaise: order.totalPaise,
            itemCount: Math.max(1, order.subtotalPaise > 0 ? 1 : 1),
          },
        });
        await run({
          dedupeSeed: `cod-received:${order.id}`,
          channel: "WHATSAPP",
          templateKey: "order_confirmation_cod",
          recipient: custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: {
            orderNumber: order.orderNumber,
            orderUrl,
            totalPaise: order.totalPaise,
            itemCount: 1,
          },
        });
        await run({
          dedupeSeed: `admin-pending-cod:${order.id}`,
          channel: "IN_APP",
          templateKey: "admin_pending_cod",
          recipient: "admin",
          orderId: order.id,
          entityType: "Order",
          entityId: order.id,
          variables: { orderNumber: order.orderNumber, totalPaise: order.totalPaise },
        });
      }
      break;

    case "order.payment_settled":
      await run({
        dedupeSeed: `order-confirmed:${order.id}`,
        channel: "EMAIL",
        templateKey: "order_confirmation_prepaid",
        recipient: custEmail,
        orderId: order.id,
        customerId: order.customerId,
        variables: { orderNumber: order.orderNumber, orderUrl, totalPaise: order.totalPaise, itemCount: 1 },
      });
      await run({
        dedupeSeed: `order-confirmed:${order.id}`,
        channel: "WHATSAPP",
        templateKey: "order_confirmation_prepaid",
        recipient: custPhone,
        orderId: order.id,
        customerId: order.customerId,
        variables: { orderNumber: order.orderNumber, orderUrl, totalPaise: order.totalPaise, itemCount: 1 },
      });
      await run({
        dedupeSeed: `admin-new-order:${order.id}`,
        channel: "IN_APP",
        templateKey: "admin_new_order",
        recipient: "admin",
        orderId: order.id,
        entityType: "Order",
        entityId: order.id,
        variables: {
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          totalPaise: order.totalPaise,
        },
      });
      break;

    case "shipment.shipped":
      for (const ch of ["EMAIL", "WHATSAPP"] as const) {
        await run({
          dedupeSeed: `dispatched:${shipment?.id ?? order.id}`,
          channel: ch,
          templateKey: "shipment_dispatched",
          recipient: ch === "EMAIL" ? custEmail : custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: {
            orderNumber: order.orderNumber,
            orderUrl,
            awb: shipment?.awb ?? null,
            courier: shipment?.courier ?? "Shadowfax",
            trackingUrl: shipment?.trackingUrl ?? null,
          },
        });
      }
      break;

    case "shipment.out_for_delivery":
      for (const ch of ["EMAIL", "WHATSAPP"] as const) {
        await run({
          dedupeSeed: `ofd:${shipment?.id ?? order.id}`,
          channel: ch,
          templateKey: "shipment_out_for_delivery",
          recipient: ch === "EMAIL" ? custEmail : custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: {
            orderNumber: order.orderNumber,
            orderUrl,
            trackingUrl: shipment?.trackingUrl ?? null,
          },
        });
      }
      break;

    case "shipment.delivered":
      for (const ch of ["EMAIL", "WHATSAPP"] as const) {
        await run({
          dedupeSeed: `delivered:${shipment?.id ?? order.id}`,
          channel: ch,
          templateKey: "order_delivered",
          recipient: ch === "EMAIL" ? custEmail : custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: { orderNumber: order.orderNumber, orderUrl },
        });
      }
      break;

    case "shipment.ndr": {
      const reason =
        (event.payload as { statusRaw?: string })?.statusRaw ?? "delivery could not be completed";
      for (const ch of ["EMAIL", "WHATSAPP"] as const) {
        await run({
          dedupeSeed: `ndr:${shipment?.id ?? order.id}:${reason}`,
          channel: ch,
          templateKey: "delivery_failed",
          recipient: ch === "EMAIL" ? custEmail : custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: {
            orderNumber: order.orderNumber,
            orderUrl,
            reason,
            trackingUrl: shipment?.trackingUrl ?? null,
          },
        });
      }
      await run({
        dedupeSeed: `admin-ndr:${shipment?.id ?? order.id}`,
        channel: "IN_APP",
        templateKey: "admin_delivery_failed",
        recipient: "admin",
        orderId: order.id,
        entityType: "Shipment",
        entityId: shipment?.id ?? order.id,
        variables: { orderNumber: order.orderNumber, reason },
      });
      break;
    }

    case "order.cancelled": {
      const reason = (event.payload as { reason?: string })?.reason ?? "as requested";
      for (const ch of ["EMAIL", "WHATSAPP"] as const) {
        await run({
          dedupeSeed: `cancelled:${order.id}`,
          channel: ch,
          templateKey: "order_cancelled",
          recipient: ch === "EMAIL" ? custEmail : custPhone,
          orderId: order.id,
          customerId: order.customerId,
          variables: { orderNumber: order.orderNumber, orderUrl, reason },
        });
      }
      break;
    }

    case "refund.completed": {
      const amountPaise = Number((event.payload as { amountPaise?: number })?.amountPaise ?? 0);
      if (amountPaise > 0) {
        for (const ch of ["EMAIL", "WHATSAPP"] as const) {
          await run({
            dedupeSeed: `refund:${(event.payload as { refundId?: string })?.refundId ?? order.id}`,
            channel: ch,
            templateKey: "refund_completed",
            recipient: ch === "EMAIL" ? custEmail : custPhone,
            orderId: order.id,
            customerId: order.customerId,
            variables: { orderNumber: order.orderNumber, orderUrl, amountPaise },
          });
        }
      }
      break;
    }
  }

  return { results };
}

// ─────────────────────── retry + delivery callbacks ───────────────────────

export async function retryNotification(
  db: PrismaClient,
  transports: Transports,
  input: { deliveryId: string; adminUserId: string },
): Promise<SendOutcome> {
  const d = await db.notificationDelivery.findUniqueOrThrow({ where: { id: input.deliveryId } });
  if (d.status !== "FAILED") {
    return { status: "skipped", reason: `delivery is ${d.status}, not FAILED` };
  }

  await db.adminActivityLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: "notification.retry",
      entityType: "NotificationDelivery",
      entityId: d.id,
      reason: d.lastError ?? null,
    },
  });

  // Reset to QUEUED and re-send via the same transport path. We reuse the row
  // (its deliveryKey is the logical identity), so this cannot create a duplicate.
  try {
    let providerMessageId: string | null = null;
    if (d.channel === "EMAIL") {
      // Re-rendering requires the original variables; the retry path re-sends a
      // minimal notice since variables are not persisted. For full re-render,
      // callers pass fresh variables through `sendNotification`.
      ({ providerMessageId } = await transports.email.send({
        to: d.recipient,
        subject: `Update on your order`,
        html: `<p>We have an update on your order. Please check your account.</p>`,
        text: `We have an update on your order. Please check your account.`,
      }));
    } else if (d.channel === "WHATSAPP") {
      ({ providerMessageId } = await transports.whatsapp.send({
        to: d.recipient,
        templateName: d.templateKey,
        bodyParams: [],
        text: `Update on your order.`,
      }));
    } else {
      ({ providerMessageId } = await transports.inApp.send({
        entityType: "NotificationDelivery",
        entityId: d.id,
        type: "RETRY",
        title: "Notification retry",
        message: d.templateKey,
        priority: 2,
      }));
    }
    await db.notificationDelivery.update({
      where: { id: d.id },
      data: {
        status: "SENT",
        providerMessageId,
        sentAt: new Date(),
        lastError: null,
        attempts: { increment: 1 },
      },
    });
    return { status: "sent", deliveryId: d.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "FAILED", lastError: error, attempts: { increment: 1 } },
    });
    return { status: "failed", deliveryId: d.id, error };
  }
}

const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/**
 * Apply a provider delivery-status callback. Advances only forward
 * (QUEUED→SENT→DELIVERED→READ); a stale callback can never undo a DELIVERED /
 * READ state. `failed` only applies while not yet DELIVERED.
 */
export async function applyDeliveryCallback(
  db: PrismaClient,
  input: {
    providerMessageId: string;
    status: "sent" | "delivered" | "read" | "failed";
    occurredAt?: Date;
  },
): Promise<{ applied: boolean; reason?: string }> {
  const d = await db.notificationDelivery.findFirst({
    where: { providerMessageId: input.providerMessageId },
  });
  if (!d) return { applied: false, reason: "unknown message id" };
  const at = input.occurredAt ?? new Date();

  if (input.status === "failed") {
    if (d.status === "DELIVERED" || d.status === "READ") {
      return { applied: false, reason: "already delivered" };
    }
    await db.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "FAILED", lastError: "provider reported failed" },
    });
    return { applied: true };
  }

  const nextStatus = input.status.toUpperCase() as "SENT" | "DELIVERED" | "READ";
  if (RANK[nextStatus] <= (RANK[d.status] ?? -1)) {
    return { applied: false, reason: "stale or out-of-order callback" };
  }
  await db.notificationDelivery.update({
    where: { id: d.id },
    data: {
      status: nextStatus,
      sentAt: nextStatus === "SENT" ? (d.sentAt ?? at) : d.sentAt,
      deliveredAt: nextStatus === "DELIVERED" ? at : d.deliveredAt,
      readAt: nextStatus === "READ" ? at : d.readAt,
    },
  });
  return { applied: true };
}
