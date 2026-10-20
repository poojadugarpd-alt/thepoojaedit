import Link from "next/link";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { MultiImageUploader } from "@/features/admin/multi-image-uploader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  MAX_TESTIMONIAL_PHOTOS,
  MAX_TESTIMONIALS,
  getStylingContent,
} from "@/server/styling";

import { ListControls } from "../list-controls";
import {
  confirmStylingPhotoUploadAction,
  createTestimonialAction,
  deleteTestimonialAction,
  moveTestimonialAction,
  requestStylingPhotoUploadAction,
  saveStylingSectionTextAction,
  updateTestimonialAction,
} from "../photo-actions";
import { PhotoGrid } from "../photo-grid";
import { StylingTabs } from "../styling-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testimonials" };

const H2 = "text-sm font-semibold uppercase tracking-wide text-ink-strong";

export default async function AdminStylingTestimonialsPage() {
  await requireAdmin();
  const c = await getStylingContent(prisma);
  const list = c.testimonials;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Styling</h1>
      <StylingTabs current="testimonials" />
      <p className="text-sm text-ink">
        What clients said, with their photos if you have them. They show as a carousel
        on the{" "}
        <Link href="/styling" target="_blank" className="underline">
          Styling page
        </Link>
        , after &ldquo;How it works&rdquo;. A testimonial shows once it has words or a
        photo.
      </p>

      {list.length < MAX_TESTIMONIALS && (
        <section className="space-y-3 rounded-[10px] border border-line p-4">
          <h2 className={H2}>Add a testimonial</h2>
          <ActionForm
            action={createTestimonialAction}
            submitLabel="Add"
            reloadOnSuccess
          >
            <Field label="Client's name" name="name" maxLength={80} required />
            <Field
              label="Detail (optional)"
              name="detail"
              maxLength={80}
              placeholder="e.g. Mumbai, or Wardrobe edit"
            />
            <TextArea
              label="What they said"
              name="quote"
              rows={4}
              maxLength={1200}
              mono={false}
            />
          </ActionForm>
          <p className="text-[11px] text-ink-soft">
            Add photos after saving, in the testimonial below.
          </p>
        </section>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-ink-soft">No testimonials yet.</p>
      ) : (
        <ol className="space-y-6">
          {list.map((t, i) => {
            const target = { list: "testimonial", id: t.id } as const;
            return (
              <li
                key={t.id}
                className="space-y-4 rounded-[10px] border border-line p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={H2}>
                    {i + 1}. {t.name || "Testimonial"}
                  </h2>
                  <ListControls
                    moveEarlier={
                      i > 0 ? moveTestimonialAction.bind(null, t.id, -1) : undefined
                    }
                    moveLater={
                      i < list.length - 1
                        ? moveTestimonialAction.bind(null, t.id, 1)
                        : undefined
                    }
                    remove={deleteTestimonialAction.bind(null, t.id)}
                    removeLabel="Delete"
                    confirmRemove="Delete this testimonial and its photos?"
                  />
                </div>
                <ActionForm
                  action={updateTestimonialAction.bind(null, t.id)}
                  submitLabel="Save"
                  reloadOnSuccess
                >
                  <Field
                    label="Client's name"
                    name="name"
                    id={`name-${t.id}`}
                    defaultValue={t.name}
                    maxLength={80}
                    required
                  />
                  <Field
                    label="Detail (optional)"
                    name="detail"
                    id={`detail-${t.id}`}
                    defaultValue={t.detail}
                    maxLength={80}
                  />
                  <TextArea
                    label="What they said"
                    name="quote"
                    id={`quote-${t.id}`}
                    defaultValue={t.quote}
                    rows={4}
                    maxLength={1200}
                    mono={false}
                  />
                </ActionForm>
                <div className="space-y-3 border-t border-line pt-3">
                  <p className="text-xs font-medium text-ink-strong">
                    Photos ({t.photos.length} of {MAX_TESTIMONIAL_PHOTOS})
                  </p>
                  <MultiImageUploader
                    requestUpload={requestStylingPhotoUploadAction.bind(null, target)}
                    confirmUpload={confirmStylingPhotoUploadAction.bind(null, target)}
                    remaining={MAX_TESTIMONIAL_PHOTOS - t.photos.length}
                  />
                  <PhotoGrid target={target} photos={t.photos} />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className={H2}>Section heading</h2>
        <ActionForm
          action={saveStylingSectionTextAction.bind(null, "testimonials")}
          submitLabel="Save heading"
          reloadOnSuccess
        >
          <Field
            label="Heading"
            name="heading"
            id="testimonials-heading"
            defaultValue={c.testimonialsHeading}
            maxLength={60}
          />
        </ActionForm>
      </section>
    </div>
  );
}
