"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  decideReturnNow,
  finalizeReturnInspectionNow,
  inspectReturnItemNow,
  markReturnReceivedNow,
  resolveReturnNow,
} from "@/server/returns";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const fail = (e: unknown): ActionState => ({
  ok: false,
  message: e instanceof Error ? e.message : "Something went wrong.",
});
function revalidate(id: string) {
  revalidatePath(`/admin/returns/${id}`);
  revalidatePath("/admin/returns");
  revalidatePath("/admin/needs-attention");
}

export async function decideReturnAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const returnRequestId = str(form.get("returnRequestId"));
  const approve = str(form.get("decision")) === "approve";
  const notes = str(form.get("notes"));
  if (!approve && !notes) return { ok: false, message: "A reason is required to reject." };
  try {
    await decideReturnNow({ returnRequestId, approve, adminUserId: admin.id, notes });
    revalidate(returnRequestId);
    return { ok: true, message: approve ? "Return approved." : "Return rejected." };
  } catch (e) {
    return fail(e);
  }
}

export async function markReceivedAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const returnRequestId = str(form.get("returnRequestId"));
  try {
    await markReturnReceivedNow({ returnRequestId, adminUserId: admin.id });
    revalidate(returnRequestId);
    return { ok: true, message: "Marked received — inspect the items." };
  } catch (e) {
    return fail(e);
  }
}

export async function inspectItemAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const returnRequestId = str(form.get("returnRequestId"));
  const returnItemId = str(form.get("returnItemId"));
  const outcome = str(form.get("outcome")) as "RESTOCK" | "DAMAGED_DISCARD";
  const conditionNotes = str(form.get("conditionNotes"));
  try {
    const r = await inspectReturnItemNow({
      returnItemId,
      outcome,
      conditionNotes,
      adminUserId: admin.id,
    });
    revalidate(returnRequestId);
    return {
      ok: true,
      message: r.restocked ? "Inspected — restocked." : "Inspected — not restocked.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function finalizeInspectionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const returnRequestId = str(form.get("returnRequestId"));
  try {
    await finalizeReturnInspectionNow({ returnRequestId, adminUserId: admin.id });
    revalidate(returnRequestId);
    return { ok: true, message: "Inspection finalised." };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveReturnAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const returnRequestId = str(form.get("returnRequestId"));
  const resolution = str(form.get("resolution")) as "REFUND" | "REPLACEMENT" | "REJECTED";
  try {
    await resolveReturnNow({ returnRequestId, resolution, adminUserId: admin.id });
    revalidate(returnRequestId);
    return { ok: true, message: `Return resolved (${resolution.toLowerCase()}).` };
  } catch (e) {
    return fail(e);
  }
}
