import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { Pill, Thumb, money } from "@/features/admin/format";
import { SingleImageUploader } from "@/features/admin/single-image-uploader";
import { prisma } from "@/lib/db";
import { publicEnv } from "@/lib/public-env";
import { productImageUrl, storagePublicUrl } from "@/lib/storage-url";
import { requireAdmin } from "@/server/auth/require-admin";
import { MAX_LOOK_ITEMS, getLookAdmin, lookPublishProblems } from "@/server/looks";

import {
  confirmLookCoverUploadAction,
  deleteLookAction,
  moveLookItemAction,
  removeLookCoverAction,
  removeLookItemAction,
  requestLookCoverUploadAction,
  setLookStatusAction,
  updateLookAction,
} from "../actions";
import { AddPiece } from "./add-piece";
import { CopyLink } from "./copy-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Look" };

const H2 = "text-sm font-semibold uppercase tracking-wide text-ink-strong";
const CATALOG = { THE_POOJA_EDIT: "Label", THRIFT: "Closet" } as const;

export default async function AdminLookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const look = await getLookAdmin(prisma, id);
  if (!look) notFound();
  const problems = await lookPublishProblems(prisma, id);
  const published = look.status === "PUBLISHED";

  const coverUrl =
    look.coverBucket && look.coverPath
      ? storagePublicUrl(look.coverBucket, look.coverPath, look.coverUrl ?? undefined)
      : look.coverUrl;
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const instagramUrl = `${base}/looks/${look.slug}?utm_source=instagram&utm_medium=look&utm_campaign=${look.slug}`;

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-xs text-ink-soft">
        <Link href="/admin/looks" className="underline">
          ← Looks
        </Link>
      </p>
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate text-xl font-semibold text-ink-strong">
          {look.title}
        </h1>
        <Link
          href={`/looks/${look.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 shrink-0 items-center rounded border border-line px-3 text-sm font-medium text-ink-strong"
        >
          {published ? "View ↗" : "Preview ↗"}
        </Link>
      </div>

      <section className="space-y-3 rounded-[10px] border border-line p-4">
        <div className="flex items-center gap-2">
          <h2 className={H2}>{published ? "Live" : "Draft"}</h2>
          <Pill value={look.status} />
        </div>
        <p className="text-sm text-ink">
          {published
            ? "Anyone with the link can see this Look."
            : "Only you can see this Look (use Preview). Publish it when it's ready."}
        </p>
        {!published && problems.length > 0 && (
          <ul className="list-inside list-disc text-sm text-stop">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <ActionForm
          action={setLookStatusAction.bind(null, id, !published)}
          submitLabel={published ? "Back to draft" : "Publish"}
          reloadOnSuccess
        >
          <span />
        </ActionForm>
        {published && <CopyLink url={instagramUrl} />}
      </section>

      <section className="space-y-3">
        <h2 className={H2}>Pieces ({look.items.length})</h2>
        {look.items.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No pieces yet. Search below to add them.
          </p>
        ) : (
          <ul className="space-y-2">
            {look.items.map((item, i) => {
              const p = item.product;
              const live = p.status === "PUBLISHED" && p.publishedAt != null;
              const price = p.variants.length
                ? Math.min(...p.variants.map((v) => v.pricePaise))
                : null;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded border border-line p-2 ${live ? "" : "opacity-50"}`}
                >
                  <Thumb
                    url={p.images[0] ? productImageUrl(p.images[0]) : null}
                    alt={p.images[0]?.altText ?? p.title}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-strong">
                      {p.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {CATALOG[p.catalog]}
                      {price != null && ` · ${money(price)}`}
                    </p>
                    {!live && (
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        Hidden on the Look while it&rsquo;s {p.status.toLowerCase()}.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                    <div className="flex gap-1">
                      {(["up", "down"] as const).map((dir) => (
                        <ActionForm
                          key={dir}
                          action={moveLookItemAction.bind(null, id)}
                          submitLabel={dir === "up" ? "↑" : "↓"}
                          compact
                          reloadOnSuccess
                        >
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="direction" value={dir} />
                        </ActionForm>
                      ))}
                    </div>
                    <span className="text-ink-soft">#{i + 1}</span>
                    <ActionForm
                      action={removeLookItemAction.bind(null, id)}
                      submitLabel="Remove"
                      compact
                      reloadOnSuccess
                    >
                      <input type="hidden" name="productId" value={p.id} />
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {look.items.length < MAX_LOOK_ITEMS ? (
          <div className="border-t border-line pt-4">
            <AddPiece lookId={id} />
          </div>
        ) : (
          <p className="text-xs text-ink-soft">
            This Look is full ({MAX_LOOK_ITEMS} pieces).
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className={H2}>Cover photo</h2>
        {coverUrl ? (
          <div className="relative aspect-[4/5] w-40 overflow-hidden rounded border border-line">
            <Image
              src={coverUrl}
              alt={look.coverAlt || look.title}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        ) : (
          <p className="text-xs text-ink-soft">
            No cover uploaded, so the first piece&rsquo;s photo is used.
          </p>
        )}
        <SingleImageUploader
          hasImage={Boolean(coverUrl)}
          requestUpload={requestLookCoverUploadAction.bind(null, id)}
          confirmUpload={confirmLookCoverUploadAction.bind(null, id)}
          remove={removeLookCoverAction.bind(null, id)}
          uploadLabel="Upload a cover"
          removeLabel="Use the first piece's photo instead"
          hint="JPEG, PNG or WebP up to 8MB. A still from the Reel works well; tall (4:5) looks best."
        />
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className={H2}>Details</h2>
        <ActionForm
          action={updateLookAction.bind(null, id)}
          submitLabel="Save"
          reloadOnSuccess
        >
          <Field
            label="Title"
            name="title"
            defaultValue={look.title}
            required
            maxLength={120}
          />
          <TextArea
            label="Caption"
            name="caption"
            defaultValue={look.caption}
            rows={3}
            maxLength={1000}
            mono={false}
            hint="A line or two about the look. Optional."
          />
          <Field
            label="Instagram Reel or post link"
            name="reelUrl"
            type="url"
            defaultValue={look.reelUrl}
            maxLength={300}
            placeholder="https://www.instagram.com/reel/…"
          />
          <Field
            label="Web address"
            name="slug"
            defaultValue={look.slug}
            maxLength={80}
            hint={`thepoojaedit.in/looks/${look.slug}. Avoid changing it after you've shared the link.`}
          />
          {coverUrl && (
            <Field
              label="Cover description (for screen readers)"
              name="coverAlt"
              defaultValue={look.coverAlt}
              maxLength={150}
            />
          )}
        </ActionForm>
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className={H2}>Delete</h2>
        <p className="text-xs text-ink-soft">
          Removes this Look page. The pieces themselves are not touched.
        </p>
        <ActionForm action={deleteLookAction.bind(null, id)} submitLabel="Delete Look">
          <Field label="Type DELETE to confirm" name="confirm" maxLength={10} />
        </ActionForm>
      </section>
    </div>
  );
}
