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
  createShipmentForOrderNow,
  isShippingConfigured,
  reconcileShipmentNow,
  syncCodRemittanceNow,
} from "@/server/shipping";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function fail(e: unknown): ActionState {
  return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
}

function revalidate(orderNumber: string) {
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/needs-attention");
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
    await cancelOrder(prisma, { orderId: order.id, reason, actor: admin.email });
    revalidate(orderNumber);
    return { ok: true, message: "Order cancelled. Any refund is a separate step." };
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
    return { ok: true, message: `Invoice ${invoice.financialYear}/${invoice.number} ready.` };
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
