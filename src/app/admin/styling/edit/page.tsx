import Image from "next/image";
import Link from "next/link";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  MAX_OFFERS,
  MAX_STEPS,
  getStylingContent,
  publishProblems,
} from "@/server/styling";

import { saveStylingPageAction, setStylingPublishedAction } from "../actions";
import { PortraitUploader } from "./portrait-uploader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Styling page" };

const H2 = "text-sm font-semibold uppercase tracking-wide text-ink-strong";

export default async function AdminStylingEditPage() {
  await requireAdmin();
  const c = await getStylingContent(prisma);
  const problems = publishProblems(c);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">Styling page</h1>
        <Link
          href="/styling"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center rounded border border-line px-3 text-sm font-medium text-ink-strong"
        >
          {c.published ? "View page ↗" : "Preview draft ↗"}
        </Link>
      </div>
      <p className="text-xs text-ink-soft">
        <Link href="/admin/styling" className="underline">
          ← Enquiries
        </Link>
      </p>

      <section className="space-y-3 rounded-[10px] border border-line p-4">
        <h2 className={H2}>{c.published ? "Live" : "Draft"}</h2>
        {c.published ? (
          <p className="text-sm text-ink">
            Shoppers can see <code>/styling</code>. It&rsquo;s linked from the footer
            and About, and from the home page if &ldquo;Personal styling&rdquo; is
            switched on in{" "}
            <Link href="/admin/home" className="underline">
              Home page → Layout
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-sm text-ink">
              Only you can see this page (use Preview). Publishing makes it public and
              adds the footer and About links.
            </p>
            {problems.length > 0 && (
              <ul className="list-inside list-disc text-sm text-stop">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <ActionForm
          action={setStylingPublishedAction.bind(null, !c.published)}
          submitLabel={c.published ? "Unpublish" : "Publish"}
          reloadOnSuccess
        >
          <span />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className={H2}>Portrait</h2>
        {c.portrait?.url && (
          <div className="relative aspect-[4/5] w-40 overflow-hidden rounded border border-line">
            <Image
              src={c.portrait.url}
              alt={c.portrait.alt || "Portrait"}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        )}
        <PortraitUploader hasPortrait={Boolean(c.portrait)} />
      </section>

      <ActionForm
        action={saveStylingPageAction}
        submitLabel="Save page"
        reloadOnSuccess
      >
        <section className="space-y-3 border-t border-line pt-4">
          <h2 className={H2}>Opening</h2>
          <Field
            label="Small label above the headline"
            name="eyebrow"
            defaultValue={c.eyebrow}
            maxLength={60}
          />
          <Field
            label="Headline"
            name="heading"
            defaultValue={c.heading}
            maxLength={90}
          />
          <TextArea
            label="Introduction"
            name="intro"
            defaultValue={c.intro}
            rows={4}
            maxLength={800}
            mono={false}
          />
          {c.portrait && (
            <Field
              label="Photo description (for screen readers)"
              name="portraitAlt"
              defaultValue={c.portrait.alt}
              maxLength={150}
              placeholder="e.g. Pooja in a linen co-ord, smiling"
            />
          )}
        </section>

        <section className="space-y-4 border-t border-line pt-4">
          <h2 className={H2}>Offers</h2>
          <p className="text-xs text-ink-soft">
            Up to {MAX_OFFERS}. Leave a title blank to drop that offer. Each offer also
            becomes a choice in the enquiry form.
          </p>
          {Array.from({ length: MAX_OFFERS }, (_, i) => {
            const o = c.offers[i];
            return (
              <fieldset key={i} className="space-y-2 rounded border border-line p-3">
                <legend className="px-1 text-xs font-medium">Offer {i + 1}</legend>
                <Field
                  label="Title"
                  name={`offer${i}.title`}
                  defaultValue={o?.title}
                  maxLength={60}
                  placeholder={i === 0 ? "e.g. Wardrobe edit" : undefined}
                />
                <TextArea
                  label="What's included (one point per line)"
                  name={`offer${i}.includes`}
                  defaultValue={o?.includes}
                  rows={4}
                  maxLength={800}
                  mono={false}
                />
                <Field
                  label="Fee"
                  name={`offer${i}.fee`}
                  defaultValue={o?.fee}
                  maxLength={60}
                  placeholder="e.g. ₹5,000 or Quote on request"
                />
              </fieldset>
            );
          })}
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className={H2}>How it works</h2>
          <TextArea
            label={`Steps (one per line, up to ${MAX_STEPS})`}
            name="steps"
            defaultValue={c.steps.join("\n")}
            rows={5}
            maxLength={1200}
            mono={false}
          />
          <TextArea
            label="Note for clients abroad (leave blank to hide)"
            name="abroadNote"
            defaultValue={c.abroadNote}
            rows={3}
            maxLength={400}
            mono={false}
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className={H2}>Enquiry form</h2>
          <Field
            label="Form heading"
            name="formHeading"
            defaultValue={c.formHeading}
            maxLength={60}
          />
          <TextArea
            label="Text above the form"
            name="formIntro"
            defaultValue={c.formIntro}
            rows={2}
            maxLength={300}
            mono={false}
          />
          <Field
            label="Send enquiries to (email)"
            name="enquiryEmail"
            type="email"
            defaultValue={c.enquiryEmail}
            maxLength={200}
            hint="Each enquiry is emailed here. Press Reply to answer the customer directly."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className={H2}>Home page block</h2>
          <p className="text-xs text-ink-soft">
            Shown on the home page only when &ldquo;Personal styling&rdquo; is switched
            on in Home page → Layout.
          </p>
          <Field
            label="Heading"
            name="homeBlock.heading"
            defaultValue={c.homeBlock.heading}
            maxLength={60}
          />
          <TextArea
            label="Text"
            name="homeBlock.body"
            defaultValue={c.homeBlock.body}
            rows={2}
            maxLength={240}
            mono={false}
          />
          <Field
            label="Link text"
            name="homeBlock.cta"
            defaultValue={c.homeBlock.cta}
            maxLength={40}
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className={H2}>Google</h2>
          <TextArea
            label="Search description"
            name="seoDescription"
            defaultValue={c.seoDescription}
            rows={3}
            maxLength={160}
            mono={false}
            hint="The short text Google may show under the page title. Up to 160 characters."
          />
        </section>
      </ActionForm>
    </div>
  );
}
