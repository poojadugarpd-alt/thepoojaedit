"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { adjustStock } from "@/server/inventory/adjust";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function adjustStockAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const variantId = str(form.get("variantId"));
  const delta = Number(str(form.get("delta")));
  const reason = str(form.get("reason"));
  try {
    const r = await adjustStock(prisma, { variantId, delta, reason, adminUserId: admin.id });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    return {
      ok: true,
      message: `On-hand now ${r.onHandQty} (available ${r.availableQty}).`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Adjustment failed." };
  }
}
