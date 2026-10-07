"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  latestNewOrderAction,
  type LatestNewOrder,
} from "@/app/admin/new-order-alert-actions";
import { formatPaiseINR } from "@/lib/money";

/**
 * Shopify-style new-order alert while the admin is open (D-147): a short
 * cash-register chime plus a banner at the top of every admin page. Polls the
 * newest paid-order alert every 15 s (30 s while the tab is in the background,
 * so the chime still plays there). The phone push for the same order is
 * separate (service worker) and plays the phone's own notification sound.
 *
 * Browsers only allow sound after the page has been clicked or tapped once,
 * so the audio is unlocked on the first interaction. Sound can be switched
 * off per device in Settings (localStorage `admin-order-sound`).
 */
export const SOUND_PREF_KEY = "admin-order-sound";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

/** A two-bell "ka-ching": synthesised, so there's no audio file to load. */
export function playChaChing(): void {
  const ac = audio();
  if (!ac) return;
  void ac.resume();
  const t0 = ac.currentTime + 0.02;
  const bell = (freq: number, start: number, len: number, vol: number) => {
    for (const [mult, gainMult] of [
      [1, 1],
      [2.76, 0.35],
      [5.4, 0.12],
    ] as const) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol * gainMult, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + len + 0.05);
    }
  };
  // "ka" — a short metallic click
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.04), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const ng = ac.createGain();
  ng.gain.value = 0.25;
  src.buffer = noise;
  src.connect(ng).connect(ac.destination);
  src.start(t0);
  // "ching" — two bright bells
  bell(1567.98, t0 + 0.05, 0.9, 0.35);
  bell(2093.0, t0 + 0.16, 1.2, 0.3);
}

export function NewOrderAlert() {
  const [banner, setBanner] = useState<LatestNewOrder | null>(null);
  const lastSeen = useRef<string | null | undefined>(undefined);
  const baseTitle = useRef<string>("");

  // Unlock audio on the first tap/click/key — browsers block sound before that.
  useEffect(() => {
    const unlock = () => {
      const ac = audio();
      void ac?.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const check = async () => {
      try {
        const latest = await latestNewOrderAction();
        if (lastSeen.current === undefined) {
          lastSeen.current = latest?.id ?? null; // first look: remember, don't alert
        } else if (latest && latest.id !== lastSeen.current) {
          lastSeen.current = latest.id;
          setBanner(latest);
          if (soundEnabled()) playChaChing();
          if (!baseTitle.current) baseTitle.current = document.title;
          document.title = `🛍 New order · ${baseTitle.current}`;
        }
      } catch {
        // Offline or signed out — try again next tick.
      }
      if (!stopped) {
        timer = setTimeout(check, document.visibilityState === "visible" ? 15_000 : 30_000);
      }
    };
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setBanner(null);
    if (baseTitle.current) document.title = baseTitle.current;
  }

  if (!banner) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="u-safe-top fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-ok bg-ground px-4 py-3 shadow-lg">
        <span aria-hidden="true" className="text-xl">
          🛍
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-strong">New order {banner.orderNumber}</p>
          <p className="text-xs text-ink-soft">
            {formatPaiseINR(banner.totalPaise)} ·{" "}
            {banner.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
          </p>
        </div>
        <Link
          href={`/admin/orders/${banner.orderNumber}`}
          onClick={dismiss}
          className="flex min-h-11 items-center rounded bg-foreground px-3 text-sm font-semibold text-background"
        >
          View
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="min-h-11 px-2 text-ink-soft"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
