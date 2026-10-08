"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import type { ActionState } from "@/app/admin/products/actions";
import { auditLog } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";
import { renderAndStoreInvoicePdf, issueInvoiceForOrder } from "@/server/invoices";
import { cancelOrder, confirmCodOrder } from "@/server/orders/lifecycle";
import { requestRefundNow } from "@/server/refunds";
import {
  cancelShipmentsNow,
  checkPincodeServiceabilityNow,
  createShipmentForOrderNow,
  isShippingConfigured,
  linkExistingShipmentNow,
  reconcileShipmentNow,
  setManualShipmentStatusNow,
  syncCodRemittanceNow,
} from "@/server/shipping";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function fail(e: unknown): ActionState {
  return {
    ok: false,
    message: e instanceof Error ? e.message : "Something went wrong.",
  };
}

function revalidate(orderNumber: string) {
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin/other-courier");
}

export async function confirmCodAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    await confirmCodOrder(prisma, { orderId: order.id, actor: admin.email });
    revalidate(orderNumber);
    return { ok: true, message: "COD order confirmed." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const reason = str(form.get("reason"));
  if (!reason) return { ok: false, message: "A cancellation reason is required." };
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    // A booked-but-not-picked-up pickup is cancelled with Shadowfax first (D-133).
    let shipmentNote = "";
    if (order.fulfillmentStatus === "PROCESSING" && isShippingConfigured()) {
      const r = await cancelShipmentsNow(order.id, admin.email);
      if (r.cancelled > 0) shipmentNote = " Shadowfax pickup cancelled.";
    }
    await cancelOrder(prisma, { orderId: order.id, reason, actor: admin.email });
    revalidate(orderNumber);
    return {
      ok: true,
      message: `Order cancelled.${shipmentNote} Any refund is a separate step.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function createShipmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  if (!isShippingConfigured()) {
    return { ok: false, message: "Shadowfax is not configured in this environment." };
  }
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    const r = await createShipmentForOrderNow(order.id, admin.email);
    revalidate(orderNumber);
    return {
      ok: true,
      message: r.created ? "Shipment created." : "Shipment already exists.",
    };
  } catch (e) {
    return fail(e);
  }
}

/** Attach a shipment booked outside the app (Shadowfax360, or another courier). */
export async function linkShipmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    const s = await linkExistingShipmentNow({
      orderId: order.id,
      courier: str(form.get("courier")),
      awb: str(form.get("awb")),
      trackingUrl: str(form.get("trackingUrl")) || null,
      actor: admin.email,
    });
    revalidate(orderNumber);
    return { ok: true, message: `Linked ${s.courier} AWB ${s.awb}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Mark a manually linked shipment shipped or delivered. */
export async function setManualShipmentStatusAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const status = str(form.get("status"));
  if (status !== "SHIPPED" && status !== "DELIVERED") {
    return { ok: false, message: "Unknown status." };
  }
  try {
    const r = await setManualShipmentStatusNow({
      shipmentId: str(form.get("shipmentId")),
      status,
      actor: admin.email,
    });
    revalidate(orderNumber);
    return r.statusChanged
      ? { ok: true, message: `Marked ${status.toLowerCase()}.` }
      : { ok: false, message: `Already ${status.toLowerCase()} or past it.` };
  } catch (e) {
    return fail(e);
  }
}

export async function reconcileShipmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const shipmentId = str(form.get("shipmentId"));
  try {
    const r = await reconcileShipmentNow(shipmentId);
    revalidate(orderNumber);
    return { ok: true, message: `Reconciled — ${r.applied} status change(s).` };
  } catch (e) {
    return fail(e);
  }
}

export async function syncCodRemittanceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const shipmentId = str(form.get("shipmentId"));
  try {
    const r = await syncCodRemittanceNow(shipmentId);
    revalidate(orderNumber);
    return { ok: true, message: r ? `COD status: ${r.status}.` : "No COD record." };
  } catch (e) {
    return fail(e);
  }
}

export async function generateInvoiceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    const invoice = await issueInvoiceForOrder(order.id);
    await renderAndStoreInvoicePdf(invoice.id);
    revalidate(orderNumber);
    return {
      ok: true,
      message: `Invoice ${invoice.financialYear}/${invoice.number} ready.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function refundOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const rupees = Number(str(form.get("amountRupees")));
  const reason = str(form.get("reason"));
  if (!reason) return { ok: false, message: "A refund reason is required." };
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return { ok: false, message: "Enter a refund amount in rupees." };
  }
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    const refund = await requestRefundNow({
      orderId: order.id,
      amountPaise: Math.round(rupees * 100),
      reason,
      adminUserId: admin.id,
    });
    revalidate(orderNumber);
    return { ok: true, message: `Refund ${refund.status.toLowerCase()} — ₹${rupees}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function addOrderNoteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const note = str(form.get("note"));
  if (!note) return { ok: false, message: "Note cannot be empty." };
  try {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "admin.note",
        source: "admin",
        actor: admin.email,
        payload: { note },
      },
    });
    await auditLog(prisma, {
      adminUserId: admin.id,
      action: "order.note",
      entityType: "Order",
      entityId: order.id,
      after: { length: note.length },
    });
    revalidate(orderNumber);
    return { ok: true, message: "Note added to the timeline." };
  } catch (e) {
    return fail(e);
  }
}

/** Read-only pincode check (admin-PWA decision #2). No order is touched. */
export async function checkServiceabilityAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const postcode = str(form.get("postcode"));
  if (!/^\d{6}$/.test(postcode)) {
    return { ok: false, message: "Enter a 6-digit PIN code." };
  }
  if (!isShippingConfigured()) {
    return { ok: false, message: "Shadowfax is not configured in this environment." };
  }
  try {
    const r = await checkPincodeServiceabilityNow(postcode);
    return {
      ok: true,
      message: r.serviceable
        ? `${postcode} is serviceable.`
        : `${postcode} is not serviceable${r.reason ? ` — ${r.reason}` : ""}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

/** Mark / unmark an internal test order (D-146). A test order is hidden from
 *  the Overview, Analytics, customer order counts and the default orders list;
 *  nothing else about it changes. */
export async function setTestOrderAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderNumber = str(form.get("orderNumber"));
  const isTest = str(form.get("isTest")) === "1";
  try {
    const before = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    if (before.isTest !== isTest) {
      await prisma.order.update({ where: { id: before.id }, data: { isTest } });
      await auditLog(prisma, {
        adminUserId: admin.id,
        action: isTest ? "order.marked_test" : "order.unmarked_test",
        entityType: "Order",
        entityId: before.id,
        before: { isTest: before.isTest },
        after: { isTest },
      });
    }
    revalidate(orderNumber);
    revalidatePath("/admin/analytics");
    revalidatePath("/admin/customers");
    return {
      ok: true,
      message: isTest
        ? "Marked as a test order — hidden from the dashboard and analytics."
        : "No longer a test order.",
    };
  } catch (e) {
    return fail(e);
  }
}
