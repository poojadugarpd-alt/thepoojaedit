import Link from "next/link";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { MultiImageUploader } from "@/features/admin/multi-image-uploader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { MAX_DESIGNS, getStylingContent } from "@/server/styling";

import {
  confirmStylingPhotoUploadAction,
  requestStylingPhotoUploadAction,
  saveDesignCaptionAction,
  saveStylingSectionTextAction,
} from "../photo-actions";
import { PhotoGrid } from "../photo-grid";
import { StylingTabs } from "../styling-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "My designs" };

const H2 = "text-sm font-semibold uppercase tracking-wide text-ink-strong";
const TARGET = { list: "designs" } as const;

export default async function AdminStylingDesignsPage() {
  await requireAdmin();
  const c = await getStylingContent(prisma);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Styling</h1>
      <StylingTabs current="designs" />
      <p className="text-sm text-ink">
        Pieces you have designed or customised. They show as a carousel on the{" "}
        <Link href="/styling" target="_blank" className="underline">
          Styling page
        </Link>
        , under the opening, as soon as there is at least one photo.
      </p>

      <section className="space-y-3">
        <h2 className={H2}>
          Photos ({c.designs.length} of {MAX_DESIGNS})
        </h2>
        <MultiImageUploader
          requestUpload={requestStylingPhotoUploadAction.bind(null, TARGET)}
          confirmUpload={confirmStylingPhotoUploadAction.bind(null, TARGET)}
          remaining={MAX_DESIGNS - c.designs.length}
          hint="JPEG, PNG or WebP up to 8MB each. Pick several at once. Tall (portrait) photos look best."
        />
        {c.designs.length === 0 ? (
          <p className="text-sm text-ink-soft">No designs yet.</p>
        ) : (
          <PhotoGrid
            target={TARGET}
            photos={c.designs}
            extra={(p) => (
              <ActionForm
                action={saveDesignCaptionAction.bind(null, p.id)}
                submitLabel="Save caption"
              >
                <Field
                  label="Caption (optional)"
                  name="caption"
                  id={`caption-${p.id}`}
                  defaultValue={p.caption}
                  maxLength={120}
                  placeholder="e.g. Hand-embroidered lehenga"
                />
              </ActionForm>
            )}
          />
        )}
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className={H2}>Section heading</h2>
        <ActionForm
          action={saveStylingSectionTextAction.bind(null, "designs")}
          submitLabel="Save heading"
          reloadOnSuccess
        >
          <Field
            label="Heading"
            name="heading"
            defaultValue={c.designsHeading}
            maxLength={60}
          />
          <TextArea
            label="Short text under the heading (optional)"
            name="intro"
            defaultValue={c.designsIntro}
            rows={2}
            maxLength={300}
            mono={false}
          />
        </ActionForm>
      </section>
    </div>
  );
}
