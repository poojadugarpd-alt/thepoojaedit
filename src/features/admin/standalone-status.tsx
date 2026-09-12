"use client";

import { useEffect, useState } from "react";

type Mode = "checking" | "standalone" | "browser";

/**
 * iOS has no single standard way to ask "am I installed?" — `navigator.standalone`
 * is the old iOS-only Safari property (still the most reliable signal there);
 * `display-mode: standalone` is the newer cross-engine media query other
 * browsers implement instead. Checking both covers Safari and the
 * WebKit-based third-party browsers that can install since iOS 16.4
 * (webkit.org/blog/13966).
 */
function detectMode(): Mode {
  if (typeof window === "undefined") return "checking";
  const iosLegacy = (navigator as { standalone?: boolean }).standalone === true;
  const mediaQuery =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return iosLegacy || mediaQuery ? "standalone" : "browser";
}

export function StandaloneStatus() {
  const [mode, setMode] = useState<Mode>("checking");

  useEffect(() => {
    setMode(detectMode());
  }, []);

  if (mode === "checking") return null;

  if (mode === "standalone") {
    return (
      <p className="rounded border border-ok/30 bg-ok-bg px-3 py-2 text-sm text-ok">
        ✓ You&rsquo;re using the installed app right now — nothing to do.
      </p>
    );
  }

  return (
    <p className="rounded border border-wait/30 bg-wait-bg px-3 py-2 text-sm text-wait">
      You&rsquo;re viewing this in a regular browser tab, not the installed app.
      Follow the steps below.
    </p>
  );
}
