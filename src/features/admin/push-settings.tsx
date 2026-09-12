"use client";

import { useEffect, useState } from "react";

import {
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/admin/settings/actions";
import { publicEnv } from "@/lib/public-env";

// Web Push's applicationServerKey wants raw bytes, not the base64url string
// the VAPID public key is normally handed around as.
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "not-installed" | "off" | "on" | "denied";

/**
 * Turning push on/off for THIS device. Deliberately state that lives only in
 * the browser's own Push API (`pushManager.getSubscription()`), not passed
 * down as a prop — whether this exact browser/device is subscribed isn't
 * something the server can know from an admin id alone.
 */
export function PushSettings() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/admin/");
    if (!reg) {
      setState("not-installed");
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }

  // WebKit requires the permission prompt to be a direct response to a tap
  // (webkit.org/blog/13878) — this handler IS that tap, nothing async runs
  // before requestPermission().
  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("Push isn't configured on the server yet.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const result = await subscribePushAction(sub.toJSON() as never, navigator.userAgent);
      if (!result.ok) {
        setMessage(result.message);
        await sub.unsubscribe();
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setMessage("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/admin/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {state === "checking" && <p className="text-xs text-ink-soft">Checking…</p>}
      {state === "unsupported" && (
        <p className="text-xs text-ink-soft">
          This browser doesn&rsquo;t support push notifications.
        </p>
      )}
      {state === "not-installed" && (
        <p className="text-xs text-wait">
          Install the app first (More → Install on iPhone) — a browser tab can&rsquo;t
          receive push.
        </p>
      )}
      {state === "denied" && (
        <p className="text-xs text-stop">
          Notifications are blocked for this app in iOS Settings → Notifications →
          Pooja Admin. Turn them on there, then reopen this page.
        </p>
      )}
      {(state === "on" || state === "off") && (
        <button
          type="button"
          onClick={state === "on" ? turnOff : turnOn}
          disabled={busy}
          className="min-h-11 rounded border border-line px-3 text-sm disabled:opacity-50"
        >
          {busy ? "Working…" : state === "on" ? "Turn off on this device" : "Turn on for this device"}
        </button>
      )}
      {message && <p className="text-xs text-stop">{message}</p>}
    </div>
  );
}
