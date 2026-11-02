import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, Field, TextArea } from "@/features/admin/action-form";
import { Pill, ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { REVIEW_STATUSES } from "@/server/reviews";

import { deleteReviewAction, updateReviewAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

const STATUS_HELP: Record<string, string> = {
  PENDING: "Pending: not shown yet",
  APPROVED: "Approved: shown on the site",
  HIDDEN: "Hidden: kept here, not shown",
};

/** wa.me wants digits only, with the country code; assume India for 10 digits. */
function whatsappLink(phone: string, name: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const full = digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, "");
  const text = encodeURIComponent(
    `Hi ${name.split(" ")[0]}, this is Pooja. Thank you for your review!`,
  );
  return `https://wa.me/${full}?text=${text}`;
}

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await prisma.review.findUnique({ where: { id } });
  if (!r) notFound();

  const wa = r.phone ? whatsappLink(r.phone, r.displayName) : null;
  const rows: [string, string | null][] = [
    ["Site", r.site === "STYLING" ? "Styling" : "Editing studio"],
    ["Service", r.service],
    ["Rating", r.rating ? `${r.rating} / 5` : null],
    ["Email (private)", r.email],
    ["WhatsApp (private)", r.phone],
    [
      "Instagram",
      r.instagram
        ? `@${r.instagram}${r.showInstagram ? "" : " (not to be shown)"}`
        : null,
    ],
    ["Can contact", r.consentContact ? "Yes" : "No"],
    ["Source", r.source === "INVITE" ? "Invited client (verified)" : "Open form"],
    ["Received", ts(r.createdAt)],
    [
      "Came from",
      r.utmSource
        ? [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / ")
        : null,
    ],
  ];

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-xs text-ink-soft">
        <Link href="/admin/reviews" className="underline">
          ← Reviews
        </Link>
      </p>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">{r.displayName}</h1>
        <Pill value={r.status} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows
          .filter((row): row is [string, string] => Boolean(row[1]))
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="break-words text-ink-strong">{v}</dd>
            </div>
          ))}
      </dl>

      <div className="flex flex-wrap gap-3">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center rounded bg-foreground px-4 text-sm font-semibold text-background"
          >
            Thank them on WhatsApp ↗
          </a>
        )}
        <a
          href={`mailto:${r.email}?subject=${encodeURIComponent("Thank you for your review")}`}
          className="flex min-h-11 items-center rounded border border-line px-4 text-sm font-medium text-ink-strong"
        >
          Email them
        </a>
      </div>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Review
        </h2>
        <ActionForm
          action={updateReviewAction.bind(null, r.id)}
          submitLabel="Save"
          reloadOnSuccess
        >
          <Field
            label="Name shown"
            name="displayName"
            defaultValue={r.displayName}
            required
            maxLength={60}
          />
          <TextArea
            label="Review text (fix spelling only, ask them before changing words)"
            name="text"
            defaultValue={r.text}
            rows={5}
            maxLength={1500}
            mono={false}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink-strong">Status</legend>
            {REVIEW_STATUSES.map((s) => (
              <label key={s} className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  defaultChecked={r.status === s}
                />
                {STATUS_HELP[s]}
              </label>
            ))}
          </fieldset>
          <TextArea
            label="Private note (only you see this)"
            name="note"
            defaultValue={r.note}
            rows={3}
            maxLength={2000}
            mono={false}
          />
        </ActionForm>
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Delete
        </h2>
        <p className="text-sm text-ink">
          Removes the review and their contact details for good. Use this if they ask
          you to.
        </p>
        <ActionForm
          action={deleteReviewAction.bind(null, r.id)}
          submitLabel="Delete review"
        >
          <Field label='Type "delete" to confirm' name="confirm" maxLength={10} />
        </ActionForm>
      </section>
    </div>
  );
}
