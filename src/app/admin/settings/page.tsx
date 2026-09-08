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
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-sm font-semibold">Credential health</h2>
        <p className="text-xs text-black/50 dark:text-white/50">
          Whether an integration&rsquo;s keys are present — never the values.
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {health.map((h) => (
            <li key={h.group}>
              <span
                className={
                  h.configured
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-black/40 dark:text-white/40"
                }
              >
                {h.configured ? "● configured" : "○ not set"}
              </span>{" "}
              — {h.group} <span className="text-[11px] text-black/45">({h.detail})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Nonsecret settings</h2>
        <p className="text-xs text-black/50 dark:text-white/50">
          Business / checkout / shipping / policy config. Each save bumps the version
          and is audited. Real GSTIN, rates and invoice policy are confirmed with the
          owner before live checkout.
        </p>
        {settings.map((s) => (
          <div key={s.key} className="rounded border border-black/10 p-3 dark:border-white/15">
            <p className="text-xs font-medium">
              {s.key}{" "}
              <span className="text-black/40">
                v{s.version} · {s.updatedAt ? ts(s.updatedAt) : "not set"}
              </span>
            </p>
            <ActionForm action={updateSettingAction} submitLabel="Save" compact>
              <input type="hidden" name="key" value={s.key} />
              <textarea
                name="value"
                rows={5}
                defaultValue={JSON.stringify(s.value ?? {}, null, 2)}
                className="w-full rounded border border-black/20 bg-transparent px-2 py-1 font-mono text-[11px] dark:border-white/25"
              />
              <input
                name="reason"
                placeholder="reason for change"
                className="w-full rounded border border-black/20 bg-transparent px-2 py-1 text-xs dark:border-white/25"
              />
            </ActionForm>
          </div>
        ))}
      </section>
    </div>
  );
}
