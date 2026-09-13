"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/app/admin/products/actions";
import { prisma } from "@/lib/db";
import { createSupabaseStoragePort } from "@/lib/storage";
import { publicEnv } from "@/lib/public-env";
import { updateSetting } from "@/server/admin";
import {
  getHomeContent,
  type HomeContent,
  type HomeMediaSlot,
  type HomeSectionKey,
} from "@/server/settings";
import {
  HOME_MEDIA_BUCKET,
  buildHomeMediaPath,
  confirmHomeMediaUpload,
  homeMediaPublicUrl,
  requestHomeMediaUpload,
} from "@/server/settings/home-media";
import { requireAdmin } from "@/server/auth/require-admin";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** `home.content` is one JSON blob covering words + media + layout — every
 * save here rewrites the whole thing, so each action reads the current
 * resolved value first and only overrides its own slice. */
async function saveHomeContent(
  adminId: string,
  reason: string | undefined,
  patch: Partial<HomeContent>,
): Promise<void> {
  const current = await getHomeContent(prisma);
  await updateSetting(prisma, {
    key: "home.content",
    value: { ...current, ...patch },
    adminUserId: adminId,
    reason,
  });
  revalidatePath("/", "page");
}

export async function updateHomeContentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  // Every field is optional here on purpose: `getHomeContent()` falls back to
  // the shipped default per field, so a blank box just means "use the
  // default wording" rather than a validation error.
  const value: Pick<
    HomeContent,
    | "hero"
    | "editorial"
    | "newIn"
    | "fromCloset"
    | "labelBlock"
    | "closetBlock"
    | "newsletter"
  > = {
    hero: {
      eyebrow: str(form.get("hero.eyebrow")),
      heading: str(form.get("hero.heading")),
      lead: str(form.get("hero.lead")),
      primaryCta: str(form.get("hero.primaryCta")),
      secondaryCta: str(form.get("hero.secondaryCta")),
    },
    editorial: { linkLabel: str(form.get("editorial.linkLabel")) },
    newIn: {
      eyebrow: str(form.get("newIn.eyebrow")),
      heading: str(form.get("newIn.heading")),
      linkLabel: str(form.get("newIn.linkLabel")),
    },
    fromCloset: {
      eyebrow: str(form.get("fromCloset.eyebrow")),
      heading: str(form.get("fromCloset.heading")),
      linkLabel: str(form.get("fromCloset.linkLabel")),
    },
    labelBlock: {
      heading: str(form.get("labelBlock.heading")),
      body: str(form.get("labelBlock.body")),
      cta: str(form.get("labelBlock.cta")),
    },
    closetBlock: {
      heading: str(form.get("closetBlock.heading")),
      body: str(form.get("closetBlock.body")),
      cta: str(form.get("closetBlock.cta")),
    },
    newsletter: {
      eyebrow: str(form.get("newsletter.eyebrow")),
      heading: str(form.get("newsletter.heading")),
      body: str(form.get("newsletter.body")),
      buttonLabel: str(form.get("newsletter.buttonLabel")),
    },
  };
  try {
    await saveHomeContent(admin.id, str(form.get("reason")) || undefined, value);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Saved. The home page is updated." };
}

// ── Layout: reorder / show-hide sections ────────────────────────────────

// Every field this needs (key, direction) is bound at the call site —
// nothing to read from the form, same shape as deleteProductAction.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function reorderHomeSectionAction(
  key: HomeSectionKey,
  direction: "up" | "down",
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const admin = await requireAdmin();
  const current = await getHomeContent(prisma);
  const idx = current.sections.findIndex((s) => s.key === key);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= current.sections.length) {
    return { ok: true }; // already at an end — silently a no-op
  }
  const sections = [...current.sections];
  [sections[idx], sections[swapIdx]] = [sections[swapIdx], sections[idx]];
  try {
    await saveHomeContent(admin.id, "reordered home page sections", { sections });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}

export async function toggleHomeSectionAction(
  key: HomeSectionKey,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = await getHomeContent(prisma);
  const enabled = form.get("enabled") === "on";
  const sections = current.sections.map((s) => (s.key === key ? { ...s, enabled } : s));
  try {
    await saveHomeContent(admin.id, `${enabled ? "showed" : "hid"} home page section "${key}"`, {
      sections,
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: enabled ? "Section shown." : "Section hidden." };
}

// ── Media: upload / revert a hero/editorial/block image or video ───────
//
// Same two-step signed-upload flow as product images
// (src/server/catalog/product-images.ts): the browser asks for a URL, PUTs
// the file directly to Storage, then confirms — only then is anything
// written to `home.content`. Called directly from client JS (image-uploader
// pattern), not a <form action>.

export type HomeMediaSlotName = "editorial" | "editorialMobile" | "labelBlock" | "closetBlock";

export type HomeMediaUploadTicketResult =
  | { ok: true; mediaId: string; bucket: string; path: string; signedUrl: string; token: string }
  | { ok: false; message: string };

export async function requestHomeMediaUploadAction(
  slot: HomeMediaSlotName,
  kind: "image" | "video",
  contentType: string,
): Promise<HomeMediaUploadTicketResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createSupabaseStoragePort();
    const ticket = await requestHomeMediaUpload(storage, admin, { slot, kind, contentType });
    return { ok: true, ...ticket, bucket: HOME_MEDIA_BUCKET };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not start the upload." };
  }
}

export type ConfirmHomeMediaResult = { ok: true } | { ok: false; message: string };

export async function confirmHomeMediaUploadAction(
  slot: HomeMediaSlotName,
  input: { mediaId: string; kind: "image" | "video"; contentType: string; alt: string },
): Promise<ConfirmHomeMediaResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createSupabaseStoragePort();
    const current = await getHomeContent(prisma);
    const previous = current.media[slot];

    const path = buildHomeMediaPath(slot, input.mediaId, input.kind, input.contentType);
    await confirmHomeMediaUpload(storage, admin, { path, kind: input.kind });

    if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
      return { ok: false, message: "Supabase is not configured." };
    }
    const newSlot: HomeMediaSlot = {
      kind: input.kind,
      bucket: HOME_MEDIA_BUCKET,
      path,
      url: homeMediaPublicUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, path),
      alt: input.alt,
    };
    await saveHomeContent(admin.id, `uploaded ${input.kind} for home "${slot}"`, {
      media: { ...current.media, [slot]: newSlot },
    });

    // Only after the new value is safely saved — never leave the slot
    // pointing at a file that no longer exists.
    if (previous.kind !== "auto" && previous.path) {
      await storage.deleteObjects(HOME_MEDIA_BUCKET, [previous.path]).catch(() => {});
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save the upload." };
  }
  return { ok: true };
}

/** Called directly from client JS, like the upload actions above — not a
 * <form>, so it can never end up nested inside the text-content form. */
export async function revertHomeMediaToAutoAction(
  slot: HomeMediaSlotName,
): Promise<ConfirmHomeMediaResult> {
  const admin = await requireAdmin();
  try {
    const current = await getHomeContent(prisma);
    const previous = current.media[slot];
    await saveHomeContent(admin.id, `removed custom media for home "${slot}"`, {
      media: { ...current.media, [slot]: { kind: "auto" } },
    });
    if (previous.kind !== "auto" && previous.path) {
      const storage = await createSupabaseStoragePort();
      await storage.deleteObjects(HOME_MEDIA_BUCKET, [previous.path]).catch(() => {});
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}
