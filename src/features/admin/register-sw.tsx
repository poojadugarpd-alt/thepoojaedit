"use client";

import { useEffect } from "react";

/**
 * Registers /admin/sw.js, scoped to /admin/ only — never touches the
 * storefront. Silent: nothing in this app depends on the worker being
 * present (every page still works with no service worker at all, e.g. a
 * browser that doesn't support one, or the very first load before it's
 * installed) — it only makes static-asset loads faster on a repeat visit
 * and adds the one offline fallback page. No UI, no update prompt: see
 * sw.js's own comments for why that's safe to skip here.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" }).catch(() => {
      // Non-fatal — e.g. private browsing on some engines refuses SW
      // registration outright. The admin console works fully without it.
    });
  }, []);
  return null;
}
