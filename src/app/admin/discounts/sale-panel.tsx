import { ActionForm, Field } from "@/features/admin/action-form";
import { liveSale, type SaleSettings } from "@/server/sale";

import { endSaleAction, saveSaleAction } from "./sale-actions";

const SELECT =
  "mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm";

const SCOPE = {
  ALL: "Everything",
  LABEL: "The Label",
  CLOSET: "The Closet",
} as const;

const IST_MS = 5.5 * 3600_000;

/** An instant → "YYYY-MM-DDTHH:mm" in India time, for a datetime-local input. */
function toIstInput(d: Date): string {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 16);
}

/** The next midnight in India, the usual "until tonight" end. */
function nextIstMidnight(now: Date): Date {
  const ist = new Date(now.getTime() + IST_MS);
  ist.setUTCHours(24, 0, 0, 0);
  return new Date(ist.getTime() - IST_MS);
}

function istLabel(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Timed sale (Admin → Discount codes): a % off one catalog until a set time.
 * Prices drop on the site with the old price struck through, and a countdown
 * shows in the bar at the top. No code needed.
 */
export function SalePanel({ settings, now }: { settings: SaleSettings; now: Date }) {
  const live = liveSale(settings, now);
  const endsDefault =
    live?.endsAt ??
    (settings.endsAt && new Date(settings.endsAt) > now
      ? new Date(settings.endsAt)
      : nextIstMidnight(now));

  return (
    <section className="space-y-3 rounded-[10px] border border-line p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
        Sale
      </h2>
      {live ? (
        <p className="text-sm text-ok">
          Running: {SCOPE[live.scope]} {live.percentBps / 100}% off until{" "}
          {istLabel(live.endsAt)}. Prices on the site already show it.
        </p>
      ) : (
        <p className="text-sm text-ink">
          No sale running. A sale lowers prices on the site by itself (old price struck
          through, countdown at the top of every page) and ends on its own. Shoppers
          don&rsquo;t need a code.
        </p>
      )}
      <ActionForm
        action={saveSaleAction}
        submitLabel={live ? "Update sale" : "Start sale"}
        reloadOnSuccess
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="sale-scope" className="block text-xs font-medium">
              On
            </label>
            <select
              id="sale-scope"
              name="scope"
              defaultValue={live?.scope ?? settings.scope}
              className={SELECT}
            >
              <option value="CLOSET">The Closet</option>
              <option value="LABEL">The Label</option>
              <option value="ALL">Everything</option>
            </select>
          </div>
          <Field
            label="% off"
            name="percent"
            id="sale-percent"
            type="number"
            step="1"
            required
            defaultValue={
              live ? live.percentBps / 100 : settings.percentBps / 100 || ""
            }
            placeholder="e.g. 30"
          />
          <Field
            label="Ends (India time)"
            name="endsAt"
            id="sale-ends"
            type="datetime-local"
            required
            defaultValue={toIstInput(endsDefault)}
            hint="Midnight tonight is 12:00 AM on tomorrow's date."
          />
        </div>
      </ActionForm>
      {live && (
        <ActionForm action={endSaleAction} submitLabel="End sale now" reloadOnSuccess>
          <span />
        </ActionForm>
      )}
    </section>
  );
}
