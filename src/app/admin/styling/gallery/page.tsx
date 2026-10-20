import Link from "next/link";

import { MultiImageUploader } from "@/features/admin/multi-image-uploader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { MAX_GALLERY, getStylingContent } from "@/server/styling";

import {
  confirmStylingPhotoUploadAction,
  requestStylingPhotoUploadAction,
} from "../photo-actions";
import { PhotoGrid } from "../photo-grid";
import { StylingTabs } from "../styling-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Styling gallery" };

const H2 = "text-sm font-semibold uppercase tracking-wide text-ink-strong";
const TARGET = { list: "gallery" } as const;

export default async function AdminStylingGalleryPage() {
  await requireAdmin();
  const c = await getStylingContent(prisma);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Styling</h1>
      <StylingTabs current="gallery" />
      <p className="text-sm text-ink">
        Any photos you like: shoots, shopping days, behind the scenes. They show as a
        plain carousel, with no heading, just above the enquiry form on the{" "}
        <Link href="/styling" target="_blank" className="underline">
          Styling page
        </Link>
        .
      </p>

      <section className="space-y-3">
        <h2 className={H2}>
          Photos ({c.gallery.length} of {MAX_GALLERY})
        </h2>
        <MultiImageUploader
          requestUpload={requestStylingPhotoUploadAction.bind(null, TARGET)}
          confirmUpload={confirmStylingPhotoUploadAction.bind(null, TARGET)}
          remaining={MAX_GALLERY - c.gallery.length}
        />
        {c.gallery.length === 0 ? (
          <p className="text-sm text-ink-soft">No photos yet.</p>
        ) : (
          <PhotoGrid target={TARGET} photos={c.gallery} />
        )}
      </section>
    </div>
  );
}
