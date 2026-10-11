import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm, TextArea } from "@/features/admin/action-form";
import { Pill, ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { ENQUIRY_STATUSES } from "@/server/styling";

import { updateEnquiryAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Styling enquiry" };

const STATUS_HELP: Record<string, string> = {
  NEW: "New — not answered yet",
  REPLIED: "Replied — waiting to hear back",
  BOOKED: "Booked — agreed and scheduled",
  CLOSED: "Closed — done, or not going ahead",
};

/** wa.me wants digits only, with the country code; assume India for 10 digits. */
function whatsappLink(phone: string, name: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const full = digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, "");
  const text = encodeURIComponent(
    `Hi ${name.split(" ")[0]}, this is Pooja — thank you for your styling enquiry!`,
  );
  return `https://wa.me/${full}?text=${text}`;
}

export default async function AdminStylingEnquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await prisma.stylingEnquiry.findUnique({ where: { id } });
  if (!e) notFound();

  const wa = e.phone ? whatsappLink(e.phone, e.name) : null;
  const mail = `mailto:${e.email}?subject=${encodeURIComponent("Your styling enquiry")}`;
  const rows: [string, string | null][] = [
    ["Email", e.email],
    ["WhatsApp", e.phone],
    ["Based in", e.location],
    ["Service", e.service],
    ["Budget", e.budget],
    ["Received", ts(e.createdAt)],
    [
      "Came from",
      e.utmSource
        ? [e.utmSource, e.utmMedium, e.utmCampaign].filter(Boolean).join(" / ")
        : null,
    ],
  ];

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-xs text-ink-soft">
        <Link href="/admin/styling" className="underline">
          ← Styling enquiries
        </Link>
      </p>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">{e.name}</h1>
        <Pill value={e.status} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="break-words text-ink-strong">{v}</dd>
            </div>
          ))}
      </dl>

      <p className="whitespace-pre-wrap rounded-[10px] border border-line p-4 text-sm text-ink">
        {e.message}
      </p>

      <div className="flex flex-wrap gap-3">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center rounded bg-foreground px-4 text-sm font-semibold text-background"
          >
            Reply on WhatsApp ↗
          </a>
        )}
        <a
          href={mail}
          className="flex min-h-11 items-center rounded border border-line px-4 text-sm font-medium text-ink-strong"
        >
          Reply by email
        </a>
      </div>

      <section className="space-y-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          Status
        </h2>
        <ActionForm
          action={updateEnquiryAction.bind(null, e.id)}
          submitLabel="Save"
          reloadOnSuccess
        >
          <fieldset className="space-y-2">
            <legend className="sr-only">Status</legend>
            {ENQUIRY_STATUSES.map((s) => (
              <label key={s} className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  defaultChecked={e.status === s}
                />
                {STATUS_HELP[s]}
              </label>
            ))}
          </fieldset>
          <TextArea
            label="Private note (only you see this)"
            name="note"
            defaultValue={e.note}
            rows={3}
            maxLength={2000}
            mono={false}
          />
        </ActionForm>
      </section>
    </div>
  );
}
