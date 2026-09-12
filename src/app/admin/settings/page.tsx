import { prisma } from "@/lib/db";
import { ActionForm } from "@/features/admin/action-form";
import { ts } from "@/features/admin/format";
import { credentialHealth, listSettings } from "@/server/admin";

import { updateSettingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, health] = await Promise.all([
    listSettings(prisma),
    Promise.resolve(credentialHealth()),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-strong">Settings</h1>

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
