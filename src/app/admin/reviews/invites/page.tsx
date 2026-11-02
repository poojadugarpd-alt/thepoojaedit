import { ActionForm, Field } from "@/features/admin/action-form";
import { ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { publicEnv } from "@/lib/public-env";
import { requireAdmin } from "@/server/auth/require-admin";
import { listReviewInvites } from "@/server/reviews";

import { createInviteAction } from "../actions";
import { ReviewTabs } from "../review-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review invite links" };

const STUDIO_URL = "https://studio.thepoojaedit.in";

export default async function AdminReviewInvitesPage() {
  await requireAdmin();
  const invites = await listReviewInvites(prisma);
  const storeUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Reviews</h1>
      <ReviewTabs current="invites" />
      <p className="text-sm text-ink">
        Make a one-time link for a client you have worked with. Their review is marked
        as coming from an invited client. The link works once and expires in 60 days.
      </p>

      <ActionForm action={createInviteAction} submitLabel="Create link" reloadOnSuccess>
        <Field label="Client name" name="clientName" required maxLength={60} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink-strong">For</legend>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="radio" name="site" value="STUDIO" defaultChecked /> Editing
            studio
          </label>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="radio" name="site" value="STYLING" /> Personal styling
          </label>
        </fieldset>
        <Field
          label="Service"
          name="service"
          required
          maxLength={120}
          placeholder="Instagram Reels"
        />
      </ActionForm>

      {invites.length === 0 ? (
        <p className="rounded-[10px] border border-line p-4 text-sm text-ink-soft">
          No links yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[10px] border border-line">
          {invites.map((i) => {
            const base =
              i.site === "STUDIO" ? `${STUDIO_URL}/review` : `${storeUrl}/review`;
            const link = `${base}?invite=${i.token}`;
            const state = i.usedAt
              ? `Used ${ts(i.usedAt)}`
              : i.expiresAt && i.expiresAt <= new Date()
                ? "Expired"
                : "Not used yet";
            return (
              <li key={i.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-ink-strong">{i.clientName}</b>
                  <span className="text-ink-soft">
                    {i.site === "STUDIO" ? "Editing" : "Styling"} · {i.service} ·{" "}
                    {state}
                  </span>
                </div>
                <input
                  readOnly
                  value={link}
                  aria-label={`Link for ${i.clientName}`}
                  className="w-full rounded border border-line bg-fill px-2 py-2 text-xs"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
