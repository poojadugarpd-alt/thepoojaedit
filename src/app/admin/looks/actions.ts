"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import type { ActionState } from "@/app/admin/products/actions";
import type {
  UploadResult,
  UploadTicket,
} from "@/features/admin/single-image-uploader";
import { prisma } from "@/lib/db";
import { createStoragePort, photosOnR2 } from "@/lib/storage";
import { photoLocation, storagePublicUrl } from "@/lib/storage-url";
import { publicEnv } from "@/lib/public-env";
import { requireAdmin } from "@/server/auth/require-admin";
import { ValidationError } from "@/server/catalog/admin";
import {
  addLookItem,
  createLook,
  deleteLook,
  moveLookItem,
  removeLookItem,
  searchProductsForLook,
  setLookCover,
  setLookStatus,
  updateLookDetails,
} from "@/server/looks";
import {
  HOME_MEDIA_BUCKET,
  buildHomeMediaPath,
  confirmHomeMediaUpload,
  homeMediaPublicUrl,
  requestHomeMediaUpload,
} from "@/server/settings/home-media";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function handle(e: unknown): ActionState {
  if (e instanceof ValidationError)
    return { ok: false, message: e.message, errors: e.errors };
  if (e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Something went wrong." };
}

/** Public pages refresh after the response — revalidating inside an admin
 * action can leave its button stuck on "Working…" (D-155). */
function refreshPublic(slug?: string) {
  after(() => {
    revalidatePath("/looks");
    if (slug) revalidatePath(`/looks/${slug}`);
  });
}

export async function createLookAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  let id: string;
  try {
    id = (await createLook(prisma, admin, { title: str(form.get("title")) })).id;
  } catch (e) {
    return handle(e);
  }
  // A different page, so a redirect is safe here (D-155 is same-page only).
  redirect(`/admin/looks/${id}`);
}

export async function updateLookAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const look = await updateLookDetails(prisma, admin, id, {
      title: str(form.get("title")),
      slug: str(form.get("slug")),
      caption: str(form.get("caption")),
      reelUrl: str(form.get("reelUrl")),
      coverAlt: str(form.get("coverAlt")),
    });
    refreshPublic(look.slug);
  } catch (e) {
    return handle(e);
  }
  return { ok: true, message: "Saved." };
}

export async function setLookStatusAction(
  id: string,
  publish: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const look = await setLookStatus(prisma, admin, id, publish);
    refreshPublic(look.slug);
  } catch (e) {
    return handle(e);
  }
  return { ok: true, message: publish ? "Published." : "Back to draft." };
}

export async function deleteLookAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (str(form.get("confirm")).toUpperCase() !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }
  try {
    const look = await deleteLook(prisma, admin, id);
    refreshPublic(look.slug);
    if (look.coverPath) {
      const storage = await createStoragePort();
      await storage
        .deleteObjects(look.coverBucket ?? HOME_MEDIA_BUCKET, [look.coverPath])
        .catch(() => {});
    }
  } catch (e) {
    return handle(e);
  }
  redirect("/admin/looks");
}

export async function addLookItemAction(
  lookId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await addLookItem(prisma, admin, lookId, str(form.get("productId")));
    refreshPublic();
  } catch (e) {
    return handle(e);
  }
  return { ok: true, message: "Added." };
}

export async function removeLookItemAction(
  lookId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await removeLookItem(prisma, admin, lookId, str(form.get("productId")));
    refreshPublic();
  } catch (e) {
    return handle(e);
  }
  return { ok: true, message: "Removed." };
}

export async function moveLookItemAction(
  lookId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await moveLookItem(
      prisma,
      admin,
      lookId,
      str(form.get("productId")),
      str(form.get("direction")) === "up" ? "up" : "down",
    );
    refreshPublic();
  } catch (e) {
    return handle(e);
  }
  return { ok: true };
}

export type LookSearchResult = Awaited<ReturnType<typeof searchProductsForLook>>;

/** Called from the search box as Pooja types — not a form. */
export async function searchProductsForLookAction(
  lookId: string,
  q: string,
): Promise<LookSearchResult> {
  await requireAdmin();
  return searchProductsForLook(prisma, lookId, q);
}

// ── Cover photo ─────────────────────────────────────────────────────────

const coverSlot = (lookId: string) => `look-${lookId}`;

export async function requestLookCoverUploadAction(
  lookId: string,
  contentType: string,
): Promise<UploadTicket> {
  const admin = await requireAdmin();
  try {
    const storage = await createStoragePort();
    const ticket = await requestHomeMediaUpload(storage, admin, {
      slot: coverSlot(lookId),
      kind: "image",
      contentType,
      onR2: photosOnR2(),
    });
    return { ok: true, mediaId: ticket.mediaId, signedUrl: ticket.signedUrl };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not start the upload.",
    };
  }
}

export async function confirmLookCoverUploadAction(
  lookId: string,
  input: { mediaId: string; contentType: string },
): Promise<UploadResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createStoragePort();
    const { bucket, path } = photoLocation(
      HOME_MEDIA_BUCKET,
      buildHomeMediaPath(coverSlot(lookId), input.mediaId, "image", input.contentType),
      photosOnR2(),
    );
    await confirmHomeMediaUpload(storage, admin, { bucket, path, kind: "image" });
    let url: string;
    if (bucket !== HOME_MEDIA_BUCKET) {
      url = storagePublicUrl(bucket, path);
    } else if (publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
      url = homeMediaPublicUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, path);
    } else {
      return { ok: false, message: "Storage is not configured." };
    }
    const { previous } = await setLookCover(prisma, admin, lookId, {
      bucket,
      path,
      url,
    });
    refreshPublic();
    // Only after the new one is saved — never point at a deleted file.
    if (previous.path) {
      await storage
        .deleteObjects(previous.bucket ?? HOME_MEDIA_BUCKET, [previous.path])
        .catch(() => {});
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save the upload.",
    };
  }
  return { ok: true };
}

export async function removeLookCoverAction(lookId: string): Promise<UploadResult> {
  const admin = await requireAdmin();
  try {
    const { previous } = await setLookCover(prisma, admin, lookId, null);
    refreshPublic();
    if (previous.path) {
      const storage = await createStoragePort();
      await storage
        .deleteObjects(previous.bucket ?? HOME_MEDIA_BUCKET, [previous.path])
        .catch(() => {});
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}
