"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { addCustomerNote } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function addCustomerNoteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const customerId = str(form.get("customerId"));
  const body = str(form.get("body"));
  try {
    await addCustomerNote(prisma, { customerId, body, adminUserId: admin.id });
    revalidatePath(`/admin/customers/${customerId}`);
    return { ok: true, message: "Note saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed." };
  }
}
