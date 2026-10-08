import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { ts } from "@/features/admin/format";
import { OrderSoundSettings } from "@/features/admin/order-sound-settings";
import { PushSettings } from "@/features/admin/push-settings";
import { credentialHealth, listSettings } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  getNotificationPreference,
  type PushPreferenceField,
} from "@/server/notifications/push";

import { photoCompressionStatus } from "@/server/catalog/compress-photos";
import { r2MoveStatus } from "@/server/catalog/move-photos-to-r2";
import { supabasePhotoCleanupStatus } from "@/server/catalog/supabase-photo-cleanup";

import {
  compressPhotosAction,
  deleteSupabasePhotosAction,
  listSupabasePhotosAction,
  movePhotosToR2Action,
  updateNotificationPreferenceAction,
  updateSettingAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PREFERENCE_LABELS: Record<PushPreferenceField, string> = {
  newPaidOrder: "A paid order comes in",
  codConfirmation: "A COD order needs confirming",
  paymentIssue: "A payment needs review",
  shipmentFailure: "A shipment fails to create or ship",
  ndrRto: "A delivery fails or a return is inbound",
  jobExhausted: "A background job is failing",
  lowStock: "Something drops to low stock",
};

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const [settings, health, preference, photos, r2, cleanup] = await Promise.all([
    listSettings(prisma),
    Promise.resolve(credentialHealth()),
    getNotificationPreference(prisma, admin.id),
    photoCompressionStatus(prisma),
    r2MoveStatus(prisma),
    supabasePhotoCleanupStatus(prisma),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-strong">Notifications</h2>
        <p className="text-xs text-ink-soft">
          Push alerts go to every iPhone you&rsquo;ve installed Pooja Admin on — turned
          on/off per device below, and per category for your account.
        </p>
        <PushSettings />
        <OrderSoundSettings />
        <ActionForm
          action={updateNotificationPreferenceAction}
          submitLabel="Save preferences"
          compact
        >
          <div className="space-y-1">
            {(Object.keys(PREFERENCE_LABELS) as PushPreferenceField[]).map((field) => (
              <label key={field} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={field}
                  defaultChecked={preference[field]}
                />
                {PREFERENCE_LABELS[field]}
              </label>
            ))}
          </div>
        </ActionForm>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-strong">Product photos</h2>
        <p className="text-xs text-ink-soft">
          Shrinks photos over 400 KB to 1600 px (good quality JPEG) so the shop loads
          fast on phones. Each photo gets a new file; the originals stay in storage
          until you decide to remove them. Safe to run again — finished photos are
          skipped.
        </p>
        <p className="text-sm">
          {photos.compressed} of {photos.total} photos compressed
          {photos.savedBytes > 0 &&
            ` · ${(photos.savedBytes / 1048576).toFixed(1)} MB smaller in total`}
        </p>
        <ActionForm
          action={compressPhotosAction}
          submitLabel="Compress large photos"
          compact
        >
          {null}
        </ActionForm>
        <p className="pt-2 text-xs text-ink-soft">
          Photo storage moves from Supabase to Cloudflare R2 (img.thepoojaedit.in).
          Copies every product photo and home-page image across and switches the shop
          over; the Supabase copies stay until you decide to remove them. Safe to run
          again — moved photos are skipped.
        </p>
        <p className="text-sm">
          {r2.onR2} of {r2.total} photos on Cloudflare R2
        </p>
        <ActionForm
          action={movePhotosToR2Action}
          submitLabel="Move photos to R2"
          compact
        >
          {null}
        </ActionForm>
        <p className="pt-2 text-xs text-ink-soft">
          Once every photo is on R2, the old Supabase copies can go. First make the file
          list (saved on R2) and back the files up to the Mac; then delete exactly the
          files in that list. Invoices and labels are not touched.
        </p>
        {cleanup.manifest && (
          <p className="text-sm">
            Latest list: {cleanup.manifest.count} files ·{" "}
            {(cleanup.manifest.totalBytes / 1048576).toFixed(1)} MB
            {cleanup.deletedKey === cleanup.manifest.key && " · deleted from Supabase"}
          </p>
        )}
        <ActionForm
          action={listSupabasePhotosAction}
          submitLabel="Make Supabase file list"
          compact
        >
          {null}
        </ActionForm>
        {cleanup.manifest && cleanup.deletedKey !== cleanup.manifest.key && (
          <ActionForm
            action={deleteSupabasePhotosAction}
            submitLabel="Delete Supabase copies"
            compact
          >
            <input type="hidden" name="manifestKey" value={cleanup.manifest.key} />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              Type DELETE to confirm
              <input
                name="confirm"
                autoComplete="off"
                className="w-28 rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
              />
            </label>
          </ActionForm>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-strong">Credential health</h2>
        <p className="text-xs text-ink-soft">
          Whether an integration&rsquo;s keys are present — never the values.
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          {health.map((h) => (
            <li key={h.group} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={h.configured ? "text-ok" : "text-ink-soft"}
              >
                {h.configured ? "✓" : "○"}
              </span>
              <span className={h.configured ? "text-ok" : "text-ink-soft"}>
                {h.configured ? "configured" : "not set"}
              </span>
              <span>— {h.group}</span>
              <span className="text-[11px] text-ink-soft">({h.detail})</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Decision #4: keep the JSON editor, resize/keyboard for mobile only —
          no per-key structured forms, no shape change. */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-strong">Nonsecret settings</h2>
        <p className="text-xs text-ink-soft">
          Business / checkout / shipping / policy config. Each save bumps the version
          and is audited. Real GSTIN, rates and invoice policy are confirmed with the
          owner before live checkout.
        </p>
        {/* "home.content" has its own screen (/admin/home) — a plain form,
            not a JSON box — so it's deliberately left out of this list. */}
        {settings
          .filter((s) => s.key !== "home.content")
          .map((s) => (
            <div key={s.key} className="rounded border border-line p-3">
              <p className="text-xs font-medium text-ink-strong">
                {s.key}{" "}
                <span className="text-ink-soft">
                  v{s.version} · {s.updatedAt ? ts(s.updatedAt) : "not set"}
                </span>
              </p>
              <ActionForm action={updateSettingAction} submitLabel="Save" compact>
                <input type="hidden" name="key" value={s.key} />
                <textarea
                  name="value"
                  rows={8}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  defaultValue={JSON.stringify(s.value ?? {}, null, 2)}
                  className="w-full rounded border border-line bg-transparent px-2 py-2 font-mono text-base leading-relaxed sm:text-sm"
                />
                <input
                  name="reason"
                  placeholder="reason for change"
                  className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
                />
              </ActionForm>
            </div>
          ))}
      </section>
    </div>
  );
}
