import type { DiscountCode } from "@/generated/prisma";
import { Field } from "@/features/admin/action-form";

const SELECT =
  "mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm";

/** A stored instant → the IST calendar day for a date input. `end` instants
 *  are 00:00 IST the day after the last day (see `istDay` in actions.ts). */
function toIstDay(d: Date | null, edge: "start" | "end"): string {
  if (!d) return "";
  const shifted = new Date(d.getTime() + 5.5 * 3600_000 - (edge === "end" ? 1 : 0));
  return shifted.toISOString().slice(0, 10);
}

/** The fields shared by "New code" and "Edit code" (D-140). */
export function DiscountFields({ code }: { code?: DiscountCode }) {
  const value =
    code?.kind === "FIXED"
      ? code.amountPaise != null
        ? (code.amountPaise / 100).toString()
        : ""
      : code?.percentBps != null
        ? (code.percentBps / 100).toString()
        : "";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Code"
        name="code"
        required
        maxLength={30}
        defaultValue={code?.code}
        placeholder="e.g. DIWALI10"
        hint="What shoppers type. Letters and numbers, no spaces."
      />
      <div>
        <label htmlFor="f-kind" className="block text-xs font-medium">
          Type
        </label>
        <select
          id="f-kind"
          name="kind"
          defaultValue={code?.kind ?? "PERCENT"}
          className={SELECT}
        >
          <option value="PERCENT">% off</option>
          <option value="FIXED">₹ off</option>
        </select>
      </div>
      <Field
        label="Amount (% or ₹)"
        name="value"
        type="number"
        step="0.01"
        required
        defaultValue={value}
        hint="10 means 10% off, or ₹10 off, depending on the type."
      />
      <div>
        <label htmlFor="f-appliesTo" className="block text-xs font-medium">
          Works on
        </label>
        <select
          id="f-appliesTo"
          name="appliesTo"
          defaultValue={code?.appliesTo ?? "ALL"}
          className={SELECT}
        >
          <option value="ALL">Everything</option>
          <option value="LABEL">The Label only</option>
          <option value="CLOSET">Pooja&rsquo;s Closet only</option>
        </select>
      </div>
      <Field
        label="Minimum order, ₹ (optional)"
        name="minSubtotal"
        type="number"
        step="0.01"
        defaultValue={code?.minSubtotalPaise != null ? code.minSubtotalPaise / 100 : ""}
        hint="Counted on the items the code works on."
      />
      <Field
        label="Usage limit (optional)"
        name="maxRedemptions"
        type="number"
        defaultValue={code?.maxRedemptions ?? ""}
        hint="Total orders that can use it. Empty = no limit."
      />
      <Field
        label="First day (optional)"
        name="startsOn"
        type="date"
        defaultValue={toIstDay(code?.startsAt ?? null, "start")}
      />
      <Field
        label="Last day (optional)"
        name="endsOn"
        type="date"
        defaultValue={toIstDay(code?.endsAt ?? null, "end")}
        hint="The code works until midnight at the end of this day."
      />
      <Field
        label="Note (optional, only you see it)"
        name="note"
        maxLength={200}
        defaultValue={code?.note}
      />
      <label className="flex min-h-11 items-end gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={code?.isActive ?? true}
        />
        Active
      </label>
    </div>
  );
}
