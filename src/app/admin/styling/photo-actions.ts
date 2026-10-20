"use server";

import { randomUUID } from "node:crypto";

import type { ActionState } from "@/app/admin/products/actions";
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
  MAX_DESIGNS,
  MAX_GALLERY,
  MAX_TESTIMONIAL_PHOTOS,
  MAX_TESTIMONIALS,
  getStylingContent,
  type StylingContent,
  type StylingPhoto,
  type StylingTestimonial,
} from "@/server/styling";

import { saveStyling } from "./save-styling";

/**
 * Photos for the three /styling carousels: My designs, testimonials and the
 * plain gallery. Same signed upload → confirm flow as the portrait; each
 * photo is appended to its list in `styling.content` once confirmed.
 */
export type PhotoTarget =
  { list: "designs" } | { list: "gallery" } | { list: "testimonial"; id: string };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const SLOT: Record<PhotoTarget["list"], string> = {
  designs: "styling-designs",
  gallery: "styling-gallery",
  testimonial: "styling-testimonials",
};

const MAX: Record<PhotoTarget["list"], number> = {
  designs: MAX_DESIGNS,
  gallery: MAX_GALLERY,
  testimonial: MAX_TESTIMONIAL_PHOTOS,
};

function photosOf(c: StylingContent, t: PhotoTarget): StylingPhoto[] | null {
  if (t.list === "testimonial") {
    return c.testimonials.find((x) => x.id === t.id)?.photos ?? null;
  }
  return c[t.list];
}

/** The content patch that replaces the target's photo list. */
function withPhotos(
  c: StylingContent,
  t: PhotoTarget,
  photos: StylingPhoto[],
): Partial<StylingContent> {
  if (t.list === "testimonial") {
    return {
      testimonials: c.testimonials.map((x) => (x.id === t.id ? { ...x, photos } : x)),
    };
  }
  return { [t.list]: photos };
}

async function deleteFiles(photos: StylingPhoto[]) {
  const withPath = photos.filter((p) => p.path);
  if (withPath.length === 0) return;
  const storage = await createStoragePort();
  for (const p of withPath) {
    await storage
      .deleteObjects(p.bucket ?? HOME_MEDIA_BUCKET, [p.path as string])
      .catch(() => {});
  }
}

export type PhotoTicketResult =
  { ok: true; mediaId: string; signedUrl: string } | { ok: false; message: string };
export type PhotoResult = { ok: true } | { ok: false; message: string };

export async function requestStylingPhotoUploadAction(
  target: PhotoTarget,
  contentType: string,
): Promise<PhotoTicketResult> {
  const admin = await requireAdmin();
  try {
    const current = photosOf(await getStylingContent(prisma), target);
    if (!current) return { ok: false, message: "That testimonial was deleted." };
    if (current.length >= MAX[target.list]) {
      return { ok: false, message: `That's the limit of ${MAX[target.list]} photos.` };
    }
    const storage = await createStoragePort();
    const ticket = await requestHomeMediaUpload(storage, admin, {
      slot: SLOT[target.list],
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

export async function confirmStylingPhotoUploadAction(
  target: PhotoTarget,
  input: { mediaId: string; contentType: string },
): Promise<PhotoResult> {
  const admin = await requireAdmin();
  try {
    const storage = await createStoragePort();
    const { bucket, path } = photoLocation(
      HOME_MEDIA_BUCKET,
      buildHomeMediaPath(SLOT[target.list], input.mediaId, "image", input.contentType),
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
    const photo: StylingPhoto = {
      id: input.mediaId,
      bucket,
      path,
      url,
      caption: "",
      alt: "",
    };
    let missing = false;
    await saveStyling(admin.id, "added a photo to the Personal styling page", (c) => {
      const photos = photosOf(c, target);
      if (!photos) {
        missing = true;
        return {};
      }
      return withPhotos(c, target, [...photos, photo].slice(0, MAX[target.list]));
    });
    if (missing) {
      await deleteFiles([photo]);
      return { ok: false, message: "That testimonial was deleted." };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save the upload.",
    };
  }
  return { ok: true };
}

export async function removeStylingPhotoAction(
  target: PhotoTarget,
  photoId: string,
): Promise<PhotoResult> {
  const admin = await requireAdmin();
  try {
    const current = await getStylingContent(prisma);
    const photo = photosOf(current, target)?.find((p) => p.id === photoId);
    if (!photo) return { ok: true };
    await saveStyling(admin.id, "removed a photo from the Personal styling page", (c) =>
      withPhotos(
        c,
        target,
        (photosOf(c, target) ?? []).filter((p) => p.id !== photoId),
      ),
    );
    // Only after the list no longer points at it.
    await deleteFiles([photo]);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}

export async function moveStylingPhotoAction(
  target: PhotoTarget,
  photoId: string,
  dir: -1 | 1,
): Promise<PhotoResult> {
  const admin = await requireAdmin();
  try {
    await saveStyling(
      admin.id,
      "reordered photos on the Personal styling page",
      (c) => {
        const photos = [...(photosOf(c, target) ?? [])];
        const i = photos.findIndex((p) => p.id === photoId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= photos.length) return {};
        [photos[i], photos[j]] = [photos[j] as StylingPhoto, photos[i] as StylingPhoto];
        return withPhotos(c, target, photos);
      },
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}

/** Caption under a My designs photo; also its description for screen readers. */
export async function saveDesignCaptionAction(
  photoId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const caption = str(form.get("caption")).slice(0, 120);
  try {
    await saveStyling(
      admin.id,
      "edited a design caption on the Personal styling page",
      (c) => ({
        designs: c.designs.map((p) =>
          p.id === photoId ? { ...p, caption, alt: caption } : p,
        ),
      }),
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Saved." };
}

/** Headings for the My designs and testimonials sections. */
export async function saveStylingSectionTextAction(
  section: "designs" | "testimonials",
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const patch: Partial<StylingContent> =
    section === "designs"
      ? {
          designsHeading: str(form.get("heading")),
          designsIntro: str(form.get("intro")),
        }
      : { testimonialsHeading: str(form.get("heading")) };
  try {
    await saveStyling(
      admin.id,
      `edited the ${section} heading on the Personal styling page`,
      patch,
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Saved." };
}

// ── Testimonials ────────────────────────────────────────────────────────

function testimonialFields(form: FormData) {
  return {
    name: str(form.get("name")).slice(0, 80),
    detail: str(form.get("detail")).slice(0, 80),
    quote: str(form.get("quote")).slice(0, 1200),
  };
}

export async function createTestimonialAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const fields = testimonialFields(form);
  if (!fields.name) return { ok: false, message: "Add the client's name." };
  const current = await getStylingContent(prisma);
  if (current.testimonials.length >= MAX_TESTIMONIALS) {
    return {
      ok: false,
      message: `That's the limit of ${MAX_TESTIMONIALS} testimonials.`,
    };
  }
  const testimonial: StylingTestimonial = { id: randomUUID(), ...fields, photos: [] };
  try {
    await saveStyling(
      admin.id,
      "added a testimonial to the Personal styling page",
      (c) => ({
        testimonials: [...c.testimonials, testimonial],
      }),
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Added. You can add photos to it below." };
}

export async function updateTestimonialAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const fields = testimonialFields(form);
  if (!fields.name) return { ok: false, message: "Add the client's name." };
  try {
    await saveStyling(
      admin.id,
      "edited a testimonial on the Personal styling page",
      (c) => ({
        testimonials: c.testimonials.map((t) =>
          t.id === id ? { ...t, ...fields } : t,
        ),
      }),
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true, message: "Saved." };
}

export async function deleteTestimonialAction(id: string): Promise<PhotoResult> {
  const admin = await requireAdmin();
  try {
    const current = await getStylingContent(prisma);
    const gone = current.testimonials.find((t) => t.id === id);
    if (!gone) return { ok: true };
    await saveStyling(
      admin.id,
      "deleted a testimonial from the Personal styling page",
      (c) => ({
        testimonials: c.testimonials.filter((t) => t.id !== id),
      }),
    );
    await deleteFiles(gone.photos);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}

export async function moveTestimonialAction(
  id: string,
  dir: -1 | 1,
): Promise<PhotoResult> {
  const admin = await requireAdmin();
  try {
    await saveStyling(
      admin.id,
      "reordered testimonials on the Personal styling page",
      (c) => {
        const list = [...c.testimonials];
        const i = list.findIndex((t) => t.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return {};
        [list[i], list[j]] = [
          list[j] as StylingTestimonial,
          list[i] as StylingTestimonial,
        ];
        return { testimonials: list };
      },
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}
