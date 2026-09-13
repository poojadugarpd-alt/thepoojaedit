import Image from "next/image";

import type { HomeMediaSlot } from "@/server/settings";

/** Server-rendered — what's actually saved for this slot right now, before
 * any upload happens. `HomeMediaUploader` (client) sits below this. */
export function HomeMediaPreview({
  slot,
  autoText = "Automatic — the first product photo in this rail. Upload your own below " +
    "to use it here instead, for every visitor, regardless of which product is first.",
  aspectClassName = "aspect-[4/5]",
}: {
  slot: HomeMediaSlot;
  /** What "auto" means for this particular slot — not every slot falls back
   * to a rail photo (`editorialMobile` falls back to the desktop asset). */
  autoText?: string;
  /** Matches how this slot actually renders on the live page, so the
   * preview shows the true crop, not an approximation. */
  aspectClassName?: string;
}) {
  if (slot.kind === "auto") {
    return <p className="text-xs text-ink-soft">{autoText}</p>;
  }
  if (slot.kind === "video") {
    return (
      <div className={`relative ${aspectClassName} w-40 overflow-hidden rounded bg-fill`}>
        {slot.url && (
          <video
            src={slot.url}
            poster={slot.posterUrl}
            muted
            loop
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
        )}
      </div>
    );
  }
  return (
    <div className={`relative ${aspectClassName} w-40 overflow-hidden rounded bg-fill`}>
      {slot.url && (
        <Image src={slot.url} alt={slot.alt ?? ""} fill sizes="160px" className="object-cover" />
      )}
    </div>
  );
}
