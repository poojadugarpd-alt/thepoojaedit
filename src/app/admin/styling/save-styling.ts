import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import { prisma } from "@/lib/db";
import { updateSetting } from "@/server/admin";
import { getStylingContent, type StylingContent } from "@/server/styling";
import { STYLING_TAG } from "@/server/styling/published";

/**
 * `styling.content` is one JSON blob; each action rewrites only its slice.
 * `patch` may be a function of the current content, for list edits (add a
 * photo, reorder) that must start from what is saved now.
 */
export async function saveStyling(
  adminId: string,
  reason: string,
  patch:
    Partial<StylingContent> | ((current: StylingContent) => Partial<StylingContent>),
): Promise<StylingContent> {
  const current = await getStylingContent(prisma);
  const next = {
    ...current,
    ...(typeof patch === "function" ? patch(current) : patch),
  };
  await updateSetting(prisma, {
    key: "styling.content",
    value: next,
    adminUserId: adminId,
    reason,
  });
  // After the response, not inside it: revalidating during the action makes
  // Next 15.5 re-send this admin page with the result, and its client router
  // then sometimes never commits it (button stuck on "Working…", D-155). The
  // form reloads itself on success instead.
  after(() => {
    // Next 16: expire now (the old one-argument behaviour), not stale-while-revalidate.
    revalidateTag(STYLING_TAG, { expire: 0 });
    revalidatePath("/styling");
    revalidatePath("/", "page");
    revalidatePath("/about");
  });
  return next;
}
