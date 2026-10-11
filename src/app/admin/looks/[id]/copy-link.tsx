"use client";

import { useState } from "react";

/** Copies the Look's Instagram link (with UTM tags) for a bio / story / DM. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="block text-xs font-medium">Link for Instagram</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Link for Instagram"
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded border border-line bg-transparent px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
          className="min-h-11 shrink-0 rounded border border-line px-3 text-sm font-medium text-ink-strong"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-ink-soft">
        Orders that come through this link are credited to this Look in the order
        source.
      </p>
    </div>
  );
}
