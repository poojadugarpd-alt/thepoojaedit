"use client";

import { useEffect, useState } from "react";

/**
 * Size + SKU fields for a new Label (THE_POOJA_EDIT) variant. SKU stays a
 * real, required, editable field for the Label catalogue (unlike Closet,
 * which auto-generates one entirely) — but typing a size suggests a SKU
 * from the product title + size, so filling it in by hand is the exception,
 * not the rule. The suggestion stops once the admin types into the SKU
 * field themselves, so a deliberate edit is never overwritten.
 */
function suggestionPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function LabelSkuFields({ productTitle }: { productTitle: string }) {
  const [size, setSize] = useState("");
  const [sku, setSku] = useState("");
  const [skuTouched, setSkuTouched] = useState(false);

  useEffect(() => {
    if (skuTouched) return;
    const titlePart = suggestionPart(productTitle);
    const sizePart = suggestionPart(size);
    setSku(sizePart ? `${titlePart}-${sizePart}` : titlePart);
    // Only the fields the suggestion is built from — re-running when
    // `skuTouched` flips to false would re-suggest after a deliberate clear,
    // which is fine, but including it here would also re-run on every
    // keystroke into the SKU field itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, productTitle]);

  return (
    <>
      <div>
        <label htmlFor="f-new-size" className="block text-xs font-medium">
          Size
        </label>
        <input
          id="f-new-size"
          name="size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="f-new-sku" className="block text-xs font-medium">
          SKU <span className="text-stop">*</span>
        </label>
        <input
          id="f-new-sku"
          name="sku"
          required
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setSkuTouched(true);
          }}
          className="mt-1 min-h-11 w-full rounded border border-line bg-transparent px-2 py-1.5 text-base sm:text-sm"
        />
        <p className="mt-0.5 text-[11px] text-ink-soft">suggested from title + size — edit freely</p>
      </div>
    </>
  );
}
