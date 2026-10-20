"use server";

import type { ActionState } from "@/app/admin/products/actions";
import type { StylingEnquiryStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { createStoragePort, photosOnR2 } from "@/lib/storage";
import { photoLocation, storagePublicUrl } from "@/lib/storage-url";
import { publicEnv } from "@/lib/public-env";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  HOME_MEDIA_BUCKET,
  buildHomeMediaPath,
  confirmHomeMediaUpload,
  homeMediaPublicUrl,
  requestHomeMediaUpload,
} from "@/server/settings/home-media";
import {
  ENQUIRY_STATUSES,
  MAX_OFFERS,
  MAX_STEPS,
  getStylingContent,
  publishProblems,
  updateStylingEnquiry,
  type StylingContent,
} from "@/server/styling";

import { saveStyling } from "./save-styling";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** The portrait lives next to the home page media, in its own folder. */
const PORTRAIT_SLOT = "styling-portrait";

export async function saveStylingPageAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const offers = Array.from({ length: MAX_OFFERS }, (_, i) => ({
    title: str(form.get(`offer${i}.title`)),
    includes: str(form.get(`offer${i}.includes`)),
    fee: str(form.get(`offer${i}.fee`)),
  })).filter((o) => o.title !== "");
  const steps = str(form.get("steps"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (steps.length > MAX_STEPS) {
    return { ok: false, message: `Keep "How it works" to ${MAX_STEPS} steps.` };
  }
  const enquiryEmail = str(form.get("enquiryEmail"));
  if (enquiryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiryEmail)) {
    return { ok: false, message: "That enquiry email address doesn't look right." };
  }

  const current = await getStylingContent(prisma);
  const patch: Partial<StylingContent> = {
    eyebrow: str(form.get("eyebrow")),
    heading: str(form.get("heading")),
    intro: str(form.get("intro")),
    offers,
    steps,
    abroadNote: str(form.get("abroadNote")),
    formHeading: str(form.get("formHeading")),
    formIntro: str(form.get("formIntro")),
    enquiryEmail,
    homeBlock: {
      heading: str(form.get("homeBlock.heading")),
      body: str(form.get("homeBlock.body")),
      cta: str(form.get("homeBlock.cta")),
    },
    seoDescription: str(form.get("seoDescription")),
    portrait: current.portrait
      ? { ...current.portrait, alt: str(form.get("portraitAlt")) }
      : null,
  };
  // A live page must stay publishable: no saving it down to zero offers or
  // no enquiry email while shoppers can see it.
  if (current.published) {
    const problems = publishProblems({ ...current, ...patch });
    if (problems.length > 0) {
      return {
        ok: false,
        message: "The page is live, so this can't be saved yet.",
        errors: problems,
      };
    }
  }
  try {
    await saveStyling(admin.id, "edited the Personal styling page", patch);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Saved." };
}

export async function setStylingPublishedAction(
  publish: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = await getStylingContent(prisma);
  if (publish) {
    const problems = publishProblems(current);
    if (problems.length > 0) {
      return { ok: false, message: "Not ready to publish yet.", errors: problems };
    }
  }
  try {
    await saveStyling(
      admin.id,
      publish
        ? "published the Personal styling page"
        : "unpublished the Personal styling page",
      { published: publish },
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: publish ? "Published." : "Unpublished." };
}

// ── Portrait: same signed upload → confirm flow as the home page media ──

export type PortraitTicketResult =
  { ok: true; mediaId: string; signedUrl: string } | { ok: false; message: string };

export async function requestPortraitUploadAction(
  contentType: string,
): Promise<PortraitTicketResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createStoragePort();
    const ticket = await requestHomeMediaUpload(storage, admin, {
      slot: PORTRAIT_SLOT,
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

export type PortraitResult = { ok: true } | { ok: false; message: string };

export async function confirmPortraitUploadAction(input: {
  mediaId: string;
  contentType: string;
}): Promise<PortraitResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createStoragePort();
    const current = await getStylingContent(prisma);
    const { bucket, path } = photoLocation(
      HOME_MEDIA_BUCKET,
      buildHomeMediaPath(PORTRAIT_SLOT, input.mediaId, "image", input.contentType),
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
    await saveStyling(admin.id, "uploaded the Personal styling portrait", {
      portrait: { bucket, path, url, alt: current.portrait?.alt ?? "" },
    });
    // Only after the new one is saved — never point at a deleted file.
    const previous = current.portrait;
    if (previous?.path) {
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

export async function removePortraitAction(): Promise<PortraitResult> {
  const admin = await requireAdmin();
  try {
    const current = await getStylingContent(prisma);
    await saveStyling(admin.id, "removed the Personal styling portrait", {
      portrait: null,
    });
    const previous = current.portrait;
    if (previous?.path) {
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

// ── Enquiries ───────────────────────────────────────────────────────────

export async function updateEnquiryAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = str(form.get("status")) as StylingEnquiryStatus;
  if (!ENQUIRY_STATUSES.includes(status)) {
    return { ok: false, message: "Pick a status." };
  }
  try {
    await updateStylingEnquiry(prisma, admin, id, {
      status,
      note: str(form.get("note")),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  // Same-page update: ActionForm reloadOnSuccess shows the fresh state (D-155).
  return { ok: true, message: "Saved." };
}
