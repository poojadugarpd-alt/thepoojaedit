"use client";

import { useEffect, useRef } from "react";

import { TagInput } from "./tag-input";
import { CheckboxInput, TextInput } from "./controlled-fields";

export interface VariantRow {
  /** Stable React key — equals `id` once this row has been saved, otherwise
   *  a locally-generated id that never changes for the row's lifetime. */
  key: string;
  id?: string;
  size: string;
  color: string;
  sku: string;
  /** Stops the Label SKU auto-suggestion once the admin edits it by hand. */
  skuTouched: boolean;
  price: string;
  compareAt: string;
  onHandQty: string;
  lowStockThreshold: string;
  isActive: boolean;
  /** This row's size/color chip was removed after the row was already
   *  saved — kept (never silently deleted, matches order/inventory
   *  history), forced inactive, shown separately with an explanation. */
  orphaned: boolean;
}

function pairKey(size: string, color: string) {
  return `${size} ${color}`;
}

function suggestionPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Title+Size+Color → suggested SKU, e.g. "FLORAL-WRAP-DRESS-M-BLACK" —
 *  same construction `LabelSkuFields` used, extended to fold in Color. */
function suggestSku(productTitle: string, size: string, color: string): string {
  return [suggestionPart(productTitle), suggestionPart(size), suggestionPart(color)]
    .filter(Boolean)
    .join("-");
}

function blankRow(size: string, color: string, productTitle: string, isThrift: boolean): VariantRow {
  return {
    key: `new-${Math.random().toString(36).slice(2)}`,
    size,
    color,
    sku: isThrift ? "" : suggestSku(productTitle, size, color),
    skuTouched: false,
    price: "",
    compareAt: "",
    onHandQty: "0",
    lowStockThreshold: "0",
    isActive: true,
    orphaned: false,
  };
}

/** Builds the matrix's initial state from a product already loaded from the
 *  database — groups its real variants by their existing size/color pairs
 *  so editing a product never loses data on first render. */
export function variantsToMatrixState(
  variants: {
    id: string;
    size: string | null;
    color: string | null;
    sku: string;
    pricePaise: number;
    compareAtPaise: number | null;
    onHandQty: number;
    lowStockThreshold: number;
    isActive: boolean;
  }[],
): { rows: VariantRow[]; sizes: string[]; colors: string[] } {
  const rows: VariantRow[] = variants.map((v) => ({
    key: v.id,
    id: v.id,
    size: v.size ?? "",
    color: v.color ?? "",
    sku: v.sku,
    skuTouched: true, // an existing SKU is never auto-overwritten
    price: (v.pricePaise / 100).toFixed(2),
    compareAt: v.compareAtPaise != null ? (v.compareAtPaise / 100).toFixed(2) : "",
    onHandQty: String(v.onHandQty),
    lowStockThreshold: String(v.lowStockThreshold),
    isActive: v.isActive,
    orphaned: false,
  }));
  const sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
  const colors = [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))];
  return { rows, sizes, colors };
}

function desiredPairs(sizes: string[], colors: string[]): [string, string][] {
  if (sizes.length === 0 && colors.length === 0) return [["", ""]];
  if (sizes.length === 0) return colors.map((c): [string, string] => ["", c]);
  if (colors.length === 0) return sizes.map((s): [string, string] => [s, ""]);
  const pairs: [string, string][] = [];
  for (const s of sizes) for (const c of colors) pairs.push([s, c]);
  return pairs;
}

/** Reconciles the row list against the current Size/Color chips: keeps a
 *  row's already-edited fields when its pair still exists, adds a blank row
 *  per newly-added pair, drops a never-saved row whose pair was removed,
 *  and keeps (orphaning, never deletes) a saved row whose pair was removed. */
function reconcile(
  rows: VariantRow[],
  sizes: string[],
  colors: string[],
  productTitle: string,
  isThrift: boolean,
): VariantRow[] {
  const wanted = desiredPairs(sizes, colors);
  const wantedKeys = new Set(wanted.map(([s, c]) => pairKey(s, c)));
  const byPair = new Map(rows.map((r) => [pairKey(r.size, r.color), r]));

  const next: VariantRow[] = wanted.map(
    ([s, c]) => byPair.get(pairKey(s, c)) ?? blankRow(s, c, productTitle, isThrift),
  );
  const orphans = rows
    .filter((r) => r.id && !wantedKeys.has(pairKey(r.size, r.color)))
    .map((r) => ({ ...r, orphaned: true, isActive: false }));
  return [...next, ...orphans];
}

export function VariantMatrix({
  productTitle,
  isThrift,
  isOneOfOne,
  rows,
  sizes,
  colors,
  onRowsChange,
  onSizesChange,
  onColorsChange,
}: {
  productTitle: string;
  isThrift: boolean;
  isOneOfOne: boolean;
  rows: VariantRow[];
  sizes: string[];
  colors: string[];
  onRowsChange: (rows: VariantRow[]) => void;
  onSizesChange: (sizes: string[]) => void;
  onColorsChange: (colors: string[]) => void;
}) {
  // Re-reconcile whenever the chips change (not on every row edit — those
  // are applied directly via updateRow below).
  const prevAxes = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify([sizes, colors]);
    if (key === prevAxes.current) return;
    prevAxes.current = key;
    onRowsChange(reconcile(rows, sizes, colors, productTitle, isThrift));
    // Intentionally reacting only to the axis chips, not `rows`/`productTitle`
    // — this effect's whole job is to run when Sizes/Colors change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes, colors]);

  function updateRow(key: string, patch: Partial<VariantRow>) {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const activeRows = rows.filter((r) => !r.orphaned);
  const orphanRows = rows.filter((r) => r.orphaned);
  const oneOfOneConflict = isThrift && isOneOfOne && activeRows.length > 1;
  const showTable = activeRows.length > 1;

  return (
    <div className="space-y-4">
      {!oneOfOneConflict && (
        <div className="grid grid-cols-2 gap-3">
          <TagInput
            label="Sizes"
            values={sizes}
            onChange={onSizesChange}
            placeholder="e.g. S, M, L"
            hint="Leave empty if this product doesn't vary by size."
          />
          <TagInput
            label="Colors"
            values={colors}
            onChange={onColorsChange}
            placeholder="e.g. Black, White"
            hint="Leave empty if this product doesn't vary by color."
          />
        </div>
      )}

      {oneOfOneConflict && (
        <p className="rounded border border-dashed border-line p-3 text-xs text-ink-soft">
          This listing is marked “one of one”, so it can only have a single variant. If you
          actually have this design in more than one size, uncheck “one of one” in Thrift
          details first, then come back and add the other size.
        </p>
      )}

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-soft">
                {sizes.length > 0 && <th className="py-1.5 pr-2 font-medium">Size</th>}
                {colors.length > 0 && <th className="py-1.5 pr-2 font-medium">Color</th>}
                {!isThrift && <th className="py-1.5 pr-2 font-medium">SKU</th>}
                <th className="py-1.5 pr-2 font-medium">Price (₹)</th>
                <th className="py-1.5 pr-2 font-medium">Compare-at (₹)</th>
                <th className="py-1.5 pr-2 font-medium">On hand</th>
                <th className="py-1.5 pr-2 font-medium">Low-stock at</th>
                <th className="py-1.5 pr-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => {
                const rowLabel = [row.size, row.color].filter(Boolean).join(" ") || "default";
                return (
                <tr key={row.key} className="border-b border-line/60">
                  {sizes.length > 0 && (
                    <td className="py-1.5 pr-2 text-ink-strong">{row.size || "—"}</td>
                  )}
                  {colors.length > 0 && (
                    <td className="py-1.5 pr-2 text-ink-strong">{row.color || "—"}</td>
                  )}
                  {!isThrift && (
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.sku}
                        onChange={(e) =>
                          updateRow(row.key, { sku: e.target.value, skuTouched: true })
                        }
                        required
                        aria-label={`SKU (${rowLabel})`}
                        className="min-h-11 w-32 rounded border border-line bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                  )}
                  {isThrift && row.id && (
                    <td className="py-1.5 pr-2 font-mono text-xs text-ink-soft">{row.sku}</td>
                  )}
                  {isThrift && !row.id && (
                    <td className="py-1.5 pr-2 text-xs text-ink-soft">auto</td>
                  )}
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateRow(row.key, { price: e.target.value })}
                      required
                      aria-label={`Price, ₹ (${rowLabel})`}
                      className="min-h-11 w-24 rounded border border-line bg-transparent px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.compareAt}
                      onChange={(e) => updateRow(row.key, { compareAt: e.target.value })}
                      aria-label={`Compare-at, ₹ (${rowLabel})`}
                      className="min-h-11 w-24 rounded border border-line bg-transparent px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      value={row.onHandQty}
                      onChange={(e) => updateRow(row.key, { onHandQty: e.target.value })}
                      aria-label={`On hand (${rowLabel})`}
                      className="min-h-11 w-16 rounded border border-line bg-transparent px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      value={row.lowStockThreshold}
                      onChange={(e) =>
                        updateRow(row.key, { lowStockThreshold: e.target.value })
                      }
                      aria-label={`Low-stock at (${rowLabel})`}
                      className="min-h-11 w-16 rounded border border-line bg-transparent px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      aria-label={`Active (${rowLabel})`}
                      onChange={(e) => updateRow(row.key, { isActive: e.target.checked })}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        activeRows[0] && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {!isThrift && (
              <TextInput
                label="SKU"
                required
                value={activeRows[0].sku}
                onChange={(v) => updateRow(activeRows[0].key, { sku: v, skuTouched: true })}
              />
            )}
            {isThrift && activeRows[0].id && (
              <p className="text-xs text-ink-soft sm:col-span-4">
                SKU <span className="font-mono text-ink">{activeRows[0].sku}</span>
              </p>
            )}
            {isThrift && !activeRows[0].id && (
              <p className="text-xs text-ink-soft sm:col-span-4">
                SKU is generated automatically once you save (e.g. CLO-000123).
              </p>
            )}
            <TextInput
              label="Price (₹)"
              type="number"
              step="0.01"
              required
              value={activeRows[0].price}
              onChange={(v) => updateRow(activeRows[0].key, { price: v })}
            />
            <TextInput
              label="Compare-at (₹)"
              type="number"
              step="0.01"
              value={activeRows[0].compareAt}
              onChange={(v) => updateRow(activeRows[0].key, { compareAt: v })}
            />
            <TextInput
              label="On hand"
              type="number"
              value={activeRows[0].onHandQty}
              onChange={(v) => updateRow(activeRows[0].key, { onHandQty: v })}
            />
            <CheckboxInput
              label="Active"
              checked={activeRows[0].isActive}
              onChange={(v) => updateRow(activeRows[0].key, { isActive: v })}
            />
          </div>
        )
      )}

      {orphanRows.length > 0 && (
        <div className="rounded border border-dashed border-line p-3 text-xs text-ink-soft">
          <p className="font-medium text-ink-strong">
            No longer in Sizes/Colors, kept as inactive (order history stays intact):
          </p>
          <ul className="mt-1 list-inside list-disc">
            {orphanRows.map((r) => (
              <li key={r.key}>
                {[r.size, r.color].filter(Boolean).join(" / ") || "Default"} — {r.sku}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
