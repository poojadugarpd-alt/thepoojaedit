"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { updateSetting } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function updateSettingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const key = str(form.get("key"));
  const raw = str(form.get("value"));
  const reason = str(form.get("reason"));
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Value must be valid JSON." };
  }
  try {
    await updateSetting(prisma, { key, value, adminUserId: admin.id, reason });
    revalidatePath("/admin/settings");
    return { ok: true, message: `"${key}" updated (new version).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Update failed." };
  }
}
