"use client";

/**
 * A real add-a-row form for thrift measurements — replaces a raw JSON
 * textarea (`{"bust":{"value":"34","unit":"in"}}`) that an admin had to
 * hand-type exact syntax into. Still produces the identical JSON shape
 * `product-detail.tsx`'s storefront `Measurements` component and
 * `thriftDetailsAction`/`createFullProductAction` already expect — this is
 * a UI-only change, no backend/shape change.
 */
export interface MeasurementRow {
  /** Stable React key — not the same as the eventual JSON key, which is
   *  derived from `label` at save time. */
  key: string;
  label: string;
  value: string;
  unit: string;
}

const COMMON_LABELS = ["Bust", "Waist", "Hips", "Shoulder", "Length", "Sleeve", "Inseam"];

function slugKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Existing saved `{bust: {value, unit}}` JSON → editable rows. */
export function measurementsToRows(measurements: unknown): MeasurementRow[] {
  if (!measurements || typeof measurements !== "object") return [];
  return Object.entries(measurements as Record<string, unknown>)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => {
      const m = v as { value?: unknown; unit?: unknown };
      const value = m && typeof m === "object" ? String(m.value ?? "") : String(v ?? "");
      const unit = m && typeof m === "object" && m.unit ? String(m.unit) : "in";
      return {
        key: `${k}-${Math.random().toString(36).slice(2)}`,
        label: k.replace(/_/g, " "),
        value,
        unit,
      };
    });
}

/** Rows → the JSON text `thriftDetailsAction`/`createFullProductAction`
 *  already parse — a row with an empty label or value is dropped rather
 *  than saved half-filled. */
export function rowsToMeasurementsJson(rows: MeasurementRow[]): string {
  const obj: Record<string, { value: string; unit: string }> = {};
  for (const row of rows) {
    const label = row.label.trim();
    if (!label || !row.value.trim()) continue;
    obj[slugKey(label)] = { value: row.value.trim(), unit: row.unit };
  }
  return JSON.stringify(obj);
}

export function MeasurementsEditor({
  rows,
  onChange,
}: {
  rows: MeasurementRow[];
  onChange: (rows: MeasurementRow[]) => void;
}) {
  function addRow() {
    onChange([
      ...rows,
      { key: `new-${Math.random().toString(36).slice(2)}`, label: "", value: "", unit: "in" },
    ]);
  }
  function updateRow(key: string, patch: Partial<MeasurementRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <div>
      <label className="block text-xs font-medium">
        Measurements <span className="text-stop">*</span>
      </label>
      <p className="mt-0.5 text-[11px] text-ink-soft">
        The actual garment&rsquo;s measurements — how a buyer checks fit on a one-of-one piece
        with no size chart. At least one is required to publish.
      </p>
      <datalist id="measurement-labels">
        {COMMON_LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <input
              list="measurement-labels"
              value={row.label}
              onChange={(e) => updateRow(row.key, { label: e.target.value })}
              placeholder="e.g. Bust"
              aria-label="Measurement name"
              className="min-h-11 flex-1 rounded border border-line bg-transparent px-2 py-1.5 text-sm"
            />
            <input
              value={row.value}
              onChange={(e) => updateRow(row.key, { value: e.target.value })}
              placeholder="34"
              aria-label={`${row.label || "Measurement"} value`}
              className="min-h-11 w-20 rounded border border-line bg-transparent px-2 py-1.5 text-sm"
            />
            <select
              value={row.unit}
              onChange={(e) => updateRow(row.key, { unit: e.target.value })}
              aria-label={`${row.label || "Measurement"} unit`}
              className="min-h-11 rounded border border-line bg-transparent px-2 py-1.5 text-sm"
            >
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove ${row.label || "measurement"}`}
              className="min-h-11 px-1 text-ink-soft hover:text-stop"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 min-h-11 rounded border border-line px-3 text-xs"
      >
        + Add measurement
      </button>
    </div>
  );
}
