"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { runBulk, resolveTaskChecked, TaskStillActiveError } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function resolveTaskAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const taskId = str(form.get("taskId"));
  const reason = str(form.get("reason"));
  const force = str(form.get("force")) === "1";
  try {
    await resolveTaskChecked(prisma, {
      taskId,
      adminUserId: admin.id,
      reason: reason || undefined,
      force,
    });
    revalidatePath("/admin/needs-attention");
    revalidatePath("/admin");
    return { ok: true, message: "Task resolved." };
  } catch (e) {
    if (e instanceof TaskStillActiveError) return { ok: false, message: e.message };
    return { ok: false, message: e instanceof Error ? e.message : "Failed." };
  }
}

export async function bulkResolveTasksAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const ids = form.getAll("taskIds").map(String).filter(Boolean);
  const reason = str(form.get("reason"));
  // "override": the admin has checked these are handled (e.g. emails to fake
  // test addresses that can never be delivered), so clear them regardless of
  // the automatic check. A reason is still required and goes in the audit log.
  const force = str(form.get("force")) === "1";
  if (ids.length === 0) return { ok: false, message: "Select at least one task." };
  if (!reason)
    return { ok: false, message: "A reason is required for a bulk resolve." };

  const result = await runBulk(ids, async (id) => {
    // Without override, bulk resolve only clears tasks whose condition is
    // verifiably gone.
    await resolveTaskChecked(prisma, { taskId: id, adminUserId: admin.id, reason, force });
  });
  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin");

  const failed = result.results.filter((r) => !r.ok);
  return {
    ok: result.failed === 0,
    message:
      result.failed === 0
        ? `${result.succeeded} resolved.`
        : `${result.succeeded} resolved, ${result.failed} left (condition still active or needs a manual decision — tick "override" if you have checked they are handled).`,
    errors: failed.slice(0, 8).map((r) => `${r.id.slice(0, 8)}: ${r.error}`),
  };
}
