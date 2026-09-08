"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { requireAdmin } from "@/server/auth/require-admin";
import { retryNotificationNow } from "@/server/notifications";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function retryNotificationAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const deliveryId = str(form.get("deliveryId"));
  try {
    const r = await retryNotificationNow({ deliveryId, adminUserId: admin.id });
    revalidatePath("/admin/notifications");
    return {
      ok: r.status === "sent",
      message: r.status === "sent" ? "Re-sent." : `Retry ${r.status}.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Retry failed." };
  }
}
