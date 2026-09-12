import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { ts } from "@/features/admin/format";
import { PushSettings } from "@/features/admin/push-settings";
import { credentialHealth, listSettings } from "@/server/admin";
import { requireAdmin } from "@/server/auth/require-admin";
import { getNotificationPreference, type PushPreferenceField } from "@/server/notifications/push";

import { updateNotificationPreferenceAction, updateSettingAction } from "./actions";

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
  const [settings, health, preference] = await Promise.all([
    listSettings(prisma),
    Promise.resolve(credentialHealth()),
    getNotificationPreference(prisma, admin.id),
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
        <ActionForm
          action={updateNotificationPreferenceAction}
          submitLabel="Save preferences"
          compact
        >
          <div className="space-y-1">
            {(Object.keys(PREFERENCE_LABELS) as PushPreferenceField[]).map((field) => (
              <label key={field} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name={field} defaultChecked={preference[field]} />
                {PREFERENCE_LABELS[field]}
              </label>
            ))}
          </div>
        </ActionForm>
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
        {settings.map((s) => (
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
