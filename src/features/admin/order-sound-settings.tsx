"use client";

import { useEffect, useState } from "react";

import { SOUND_PREF_KEY, playChaChing, soundEnabled } from "./new-order-alert";

/** Per-device switch for the in-page new-order chime (D-147). */
export function OrderSoundSettings() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundEnabled()), []);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
    } catch {
      // Private mode etc. — the switch still works for this visit.
    }
    if (next) playChaChing();
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-ink-soft">
        While any admin page is open, a new paid order plays a “cha-ching” and shows a
        banner at the top. Setting is for this device only.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={on} onChange={toggle} />
          New-order sound
        </label>
        <button
          type="button"
          onClick={() => playChaChing()}
          className="min-h-11 rounded border border-line px-3 text-sm"
        >
          Play test sound
        </button>
      </div>
    </div>
  );
}
