"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { updateSetting } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  subscribeAdminPush,
  unsubscribeAdminPush,
  updateNotificationPreference,
  type PushPreferenceField,
  type PushSubscriptionInput,
} from "@/server/notifications/push";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const PREFERENCE_FIELDS: PushPreferenceField[] = [
  "newPaidOrder",
  "codConfirmation",
  "paymentIssue",
  "shipmentFailure",
  "ndrRto",
  "jobExhausted",
  "lowStock",
];

// ── Push (called directly from client JS — see the request/confirm image-
// upload actions in products/actions.ts for the same not-a-form pattern). ──

export type SubscribeResult = { ok: true } | { ok: false; message: string };

/** Called right after the browser's pushManager.subscribe() resolves. */
export async function subscribePushAction(
  subscription: PushSubscriptionInput,
  userAgent: string | null,
): Promise<SubscribeResult> {
  const admin = await requireAdmin();
  try {
    await subscribeAdminPush(prisma, {
      adminUserId: admin.id,
      subscription,
      userAgent,
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save subscription.",
    };
  }
  return { ok: true };
}

/** Called when the admin explicitly turns push off on this device. */
export async function unsubscribePushAction(
  endpoint: string,
): Promise<SubscribeResult> {
  await requireAdmin();
  await unsubscribeAdminPush(prisma, endpoint);
  return { ok: true };
}

export async function updateNotificationPreferenceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const patch: Partial<Record<PushPreferenceField, boolean>> = {};
  for (const field of PREFERENCE_FIELDS) {
    patch[field] = form.get(field) === "on";
  }
  await updateNotificationPreference(prisma, admin.id, patch);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Notification preferences saved." };
}

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

/** Start the background job that shrinks heavy product photos (D-158). */
export async function compressPhotosAction(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  _prev: ActionState,
  _form: FormData,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { inngest } = await import("@/inngest/client");
  const { logger } = await import("@/lib/logger");
  logger.info({ adminUserId: admin.id }, "photo compression: requested");
  await inngest.send({
    name: "poojaedit/photos.compress.requested",
    data: { adminUserId: admin.id },
  });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message:
      "Started — runs in the background; reload this page in a few minutes to see progress.",
  };
}

/** Start the background job that copies public photos to Cloudflare R2 (D-159). */
export async function movePhotosToR2Action(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  _prev: ActionState,
  _form: FormData,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { photosOnR2 } = await import("@/lib/storage");
  if (!photosOnR2()) {
    return {
      ok: false,
      message: "R2 is not set up yet (missing R2_* settings on Vercel).",
    };
  }
  const { inngest } = await import("@/inngest/client");
  const { logger } = await import("@/lib/logger");
  logger.info({ adminUserId: admin.id }, "R2 move: requested");
  await inngest.send({
    name: "poojaedit/photos.move-to-r2.requested",
    data: { adminUserId: admin.id },
  });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message:
      "Started — runs in the background; reload this page in a few minutes to see progress.",
  };
}

/** Save the list of Supabase photo files to R2 so they can be backed up (D-161). */
export async function listSupabasePhotosAction(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  _prev: ActionState,
  _form: FormData,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): Promise<ActionState> {
  const admin = await requireAdmin();
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "poojaedit/photos.supabase-list.requested",
    data: { adminUserId: admin.id },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Making the list — reload this page in a minute." };
}

/** Delete the Supabase photo copies named in one backup list (D-161). */
export async function deleteSupabasePhotosAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (str(form.get("confirm")) !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }
  const manifestKey = str(form.get("manifestKey"));
  if (!manifestKey.startsWith("backups/supabase-photos-")) {
    return { ok: false, message: "Make the file list first." };
  }
  const { supabasePhotoBlockers } =
    await import("@/server/catalog/supabase-photo-cleanup");
  const blockers = await supabasePhotoBlockers(prisma);
  if (blockers.length > 0) {
    return { ok: false, message: `Not safe yet: ${blockers.join("; ")}.` };
  }
  const { inngest } = await import("@/inngest/client");
  const { logger } = await import("@/lib/logger");
  logger.info(
    { adminUserId: admin.id, manifestKey },
    "Supabase photo delete: requested",
  );
  await inngest.send({
    name: "poojaedit/photos.supabase-delete.requested",
    data: { adminUserId: admin.id, manifestKey },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Deleting — reload this page in a minute." };
}
