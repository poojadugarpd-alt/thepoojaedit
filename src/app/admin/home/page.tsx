import Link from "next/link";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { prisma } from "@/lib/db";
import { getHomeContent, type HomeSectionKey } from "@/server/settings";
import { requireAdmin } from "@/server/auth/require-admin";

import { reorderHomeSectionAction, toggleHomeSectionAction, updateHomeContentAction } from "./actions";
import { HomeMediaUploader } from "./home-media-uploader";
import { HomeMediaPreview } from "./home-media-preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home page" };

const SECTION_LABEL: Record<HomeSectionKey, string> = {
  editorial: "Big image",
  newIn: "New in (the Label rail)",
  editBlocks: "The Label / Closet blocks",
  fromCloset: "From the Closet (the Closet rail)",
  instagram: "Instagram",
  newsletter: "Newsletter",
};

export default async function AdminHomePage() {
  await requireAdmin();
  const c = await getHomeContent(prisma);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">Home page</h1>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center rounded border border-line px-3 text-sm font-medium text-ink-strong"
        >
          View home page ↗
        </Link>
      </div>
      <p className="text-xs text-ink-soft">
        Every word here is what shoppers see on the home page, right now. Save
        updates it immediately — no need to wait, and no code or deploy involved.
        Which products show in the rails below is set from{" "}
        <Link href="/admin/collections" className="underline">
          Collections
        </Link>
        .
      </p>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Layout
        </h2>
        <p className="text-xs text-ink-soft">
          The order below is the order shoppers see, top to bottom, under the
          opening headline. Hide a section instead of deleting anything in it —
          nothing is lost, and turning it back on restores it exactly as it was.
        </p>
        <ul className="divide-y divide-line rounded border border-line">
          {c.sections.map((s, i) => (
            <li key={s.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className={`text-sm ${s.enabled ? "text-ink-strong" : "text-ink-soft"}`}>
                {SECTION_LABEL[s.key]}
                {!s.enabled && " (hidden)"}
              </span>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="text-ink-soft">#{i + 1}</span>
                <ActionForm
                  action={reorderHomeSectionAction.bind(null, s.key, "up")}
                  submitLabel="↑"
                  compact
                >
                  <span />
                </ActionForm>
                <ActionForm
                  action={reorderHomeSectionAction.bind(null, s.key, "down")}
                  submitLabel="↓"
                  compact
                >
                  <span />
                </ActionForm>
                <ActionForm
                  action={toggleHomeSectionAction.bind(null, s.key)}
                  submitLabel={s.enabled ? "Hide" : "Show"}
                  compact
                >
                  <input type="hidden" name="enabled" value={s.enabled ? "" : "on"} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ActionForm action={updateHomeContentAction} submitLabel="Save home page">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            Opening
          </h2>
          <Field
            label="Small label above the headline"
            name="hero.eyebrow"
            defaultValue={c.hero.eyebrow}
            maxLength={80}
            hint="Appears above the big headline at the very top of the page."
          />
          <Field
            label="Headline"
            name="hero.heading"
            defaultValue={c.hero.heading}
            maxLength={80}
            hint="The big line at the top of the page."
          />
          <TextArea
            label="Intro paragraph"
            name="hero.lead"
            defaultValue={c.hero.lead}
            maxLength={400}
            rows={4}
            mono={false}
            hint="The paragraph under the headline."
          />
          <Field
            label="Main button label"
            name="hero.primaryCta"
            defaultValue={c.hero.primaryCta}
            maxLength={40}
            hint="The solid button, e.g. “Shop the Label”."
          />
          <Field
            label="Second link label"
            name="hero.secondaryCta"
            defaultValue={c.hero.secondaryCta}
            maxLength={40}
            hint="The text link next to the main button."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            Big image
          </h2>
          <p className="text-xs text-ink-soft">
            This band changes shape by screen size — wide on a laptop, tall on a
            phone — so one photo or video rarely frames perfectly on both. Upload
            the desktop version below; add a phone-specific version underneath it
            only if the crop cuts off something important.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-ink-strong">
              Desktop / default — shoot or crop to <strong>16:9</strong> (e.g. 1920×1080px).
              This is what every visitor sees unless a phone-specific version is set below.
            </p>
            <HomeMediaPreview slot={c.media.editorial} aspectClassName="aspect-[16/9]" />
            <HomeMediaUploader slot="editorial" currentKind={c.media.editorial.kind} />
          </div>

          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-medium text-ink-strong">
              Phone version (optional) — shoot or crop to <strong>4:5</strong> (e.g.
              1080×1350px, the same ratio Instagram uses for a portrait post).
            </p>
            <HomeMediaPreview
              slot={c.media.editorialMobile}
              aspectClassName="aspect-[4/5]"
              autoText="No phone-specific version — phones show the desktop photo/video
                above, cropped to fit. Upload one below only if that crop loses
                something you need visible."
            />
            <HomeMediaUploader
              slot="editorialMobile"
              currentKind={c.media.editorialMobile.kind}
              emptyLabel="Upload a phone version"
              revertLabel="Remove — use the desktop version on phones too"
            />
          </div>

          <Field
            label="Link label under the photo"
            name="editorial.linkLabel"
            defaultValue={c.editorial.linkLabel}
            maxLength={40}
            hint="Sits under the large editorial photo, next to the product name."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            New in (the Label rail)
          </h2>
          <Field
            label="Small label"
            name="newIn.eyebrow"
            defaultValue={c.newIn.eyebrow}
            maxLength={40}
            hint="Sits above this rail's heading."
          />
          <Field
            label="Heading"
            name="newIn.heading"
            defaultValue={c.newIn.heading}
            maxLength={80}
            hint="This rail's own heading, above the products."
          />
          <Field
            label="“See all” link text"
            name="newIn.linkLabel"
            defaultValue={c.newIn.linkLabel}
            maxLength={40}
            hint="The link on the right of this rail's heading."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            From the Closet (the Closet rail)
          </h2>
          <Field
            label="Small label"
            name="fromCloset.eyebrow"
            defaultValue={c.fromCloset.eyebrow}
            maxLength={40}
            hint="Sits above this rail's heading."
          />
          <Field
            label="Heading"
            name="fromCloset.heading"
            defaultValue={c.fromCloset.heading}
            maxLength={80}
            hint="This rail's own heading, above the products."
          />
          <Field
            label="“See all” link text"
            name="fromCloset.linkLabel"
            defaultValue={c.fromCloset.linkLabel}
            maxLength={40}
            hint="The link on the right of this rail's heading."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            The Label block
          </h2>
          <HomeMediaPreview slot={c.media.labelBlock} />
          <HomeMediaUploader slot="labelBlock" currentKind={c.media.labelBlock.kind} />
          <Field
            label="Heading"
            name="labelBlock.heading"
            defaultValue={c.labelBlock.heading}
            maxLength={80}
            hint="Heading over the Label's own paragraph, further down the page."
          />
          <TextArea
            label="Description"
            name="labelBlock.body"
            defaultValue={c.labelBlock.body}
            maxLength={400}
            rows={3}
            mono={false}
            hint="The paragraph under that heading."
          />
          <Field
            label="Link text"
            name="labelBlock.cta"
            defaultValue={c.labelBlock.cta}
            maxLength={40}
            hint="The link under that paragraph."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            The Closet block
          </h2>
          <HomeMediaPreview slot={c.media.closetBlock} />
          <HomeMediaUploader slot="closetBlock" currentKind={c.media.closetBlock.kind} />
          <Field
            label="Heading"
            name="closetBlock.heading"
            defaultValue={c.closetBlock.heading}
            maxLength={80}
            hint="Heading over the Closet's own paragraph, next to the Label's."
          />
          <TextArea
            label="Description"
            name="closetBlock.body"
            defaultValue={c.closetBlock.body}
            maxLength={400}
            rows={3}
            mono={false}
            hint="The paragraph under that heading."
          />
          <Field
            label="Link text"
            name="closetBlock.cta"
            defaultValue={c.closetBlock.cta}
            maxLength={40}
            hint="The link under that paragraph."
          />
        </section>

        <section className="space-y-3 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
            Newsletter
          </h2>
          <Field
            label="Small label"
            name="newsletter.eyebrow"
            defaultValue={c.newsletter.eyebrow}
            maxLength={40}
            hint="Sits above the newsletter heading, near the bottom of the page."
          />
          <Field
            label="Heading"
            name="newsletter.heading"
            defaultValue={c.newsletter.heading}
            maxLength={80}
          />
          <TextArea
            label="Line of text"
            name="newsletter.body"
            defaultValue={c.newsletter.body}
            maxLength={400}
            rows={2}
            mono={false}
            hint="The sentence above the email box."
          />
          <Field
            label="Button label"
            name="newsletter.buttonLabel"
            defaultValue={c.newsletter.buttonLabel}
            maxLength={40}
            hint="The button next to the email box."
          />
        </section>

        <input type="hidden" name="reason" value="edited from /admin/home" />
      </ActionForm>
    </div>
  );
}
