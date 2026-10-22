"use client";

import { useState } from "react";

export type WaitingPerson = {
  email: string;
  createdAt: string;
  utmSource: string | null;
};

/** People who tapped "Notify me" on this piece (D-178), newest first. */
export function WaitingList({ people }: { people: WaitingPerson[] }) {
  const [copied, setCopied] = useState(false);
  const all = people.map((p) => p.email).join(", ");
  return (
    <section className="space-y-2 rounded border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">Waiting list ({people.length})</h2>
        <button
          type="button"
          className="text-xs underline underline-offset-2"
          onClick={() => {
            navigator.clipboard
              .writeText(all)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? "Copied" : "Copy all emails"}
        </button>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {people.map((p) => (
          <li key={p.email} className="flex justify-between gap-2">
            <span className="min-w-0 truncate select-all">{p.email}</span>
            <span className="shrink-0 text-ink-soft">
              {new Date(p.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Kolkata",
              })}
              {p.utmSource ? ` · ${p.utmSource}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
