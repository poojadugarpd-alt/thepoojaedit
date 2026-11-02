"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/app/admin/products/actions";
import type { ReviewSite, ReviewStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  REVIEWS_TAG,
  REVIEW_STATUSES,
  createReviewInvite,
  deleteReview,
  updateReview,
} from "@/server/reviews";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Pages that show approved reviews. */
function refreshPublic() {
  revalidateTag(REVIEWS_TAG, { expire: 0 });
  revalidatePath("/styling");
  revalidatePath("/styling/[guide]", "page");
}

export async function updateReviewAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = str(form.get("status")) as ReviewStatus;
  if (!REVIEW_STATUSES.includes(status))
    return { ok: false, message: "Pick a status." };
  try {
    await updateReview(prisma, admin, id, {
      status,
      text: str(form.get("text")),
      displayName: str(form.get("displayName")),
      note: str(form.get("note")),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  refreshPublic();
  return { ok: true, message: "Saved." };
}

export async function deleteReviewAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (str(form.get("confirm")) !== "delete") {
    return { ok: false, message: 'Type "delete" to confirm.' };
  }
  try {
    await deleteReview(prisma, admin, id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
  refreshPublic();
  redirect("/admin/reviews");
}

export async function createInviteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const site = str(form.get("site")) as ReviewSite;
  if (site !== "STYLING" && site !== "STUDIO")
    return { ok: false, message: "Pick a site." };
  try {
    await createReviewInvite(prisma, admin, {
      clientName: str(form.get("clientName")),
      site,
      service: str(form.get("service")),
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not create it.",
    };
  }
  return { ok: true, message: "Link created. It is in the list below." };
}
