"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PriceKey } from "@/lib/site";
import { waLink } from "@/lib/site";
import { inr, productById } from "@/lib/products";
import { CloseIcon, WhatsAppIcon } from "./icons";

type Lines = Partial<Record<PriceKey, number>>;

type BagCtx = {
  lines: Lines;
  count: number;
  total: number;
  add: (id: PriceKey, qty?: number) => void;
  setQty: (id: PriceKey, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  /** Plain-text order summary used for WhatsApp and the enquiry form. */
  summary: () => string;
};

const Ctx = createContext<BagCtx | null>(null);
export const useBag = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBag outside BagProvider");
  return c;
};

const KEY = "pd-bag-v1";

export function BagProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<Lines>({});
  const [isOpen, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Restore the bag (per-visitor convenience only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (saved && typeof saved === "object") setLines(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  useEffect(() => {
    document.documentElement.classList.toggle("no-scroll", isOpen);
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const setQty = useCallback((id: PriceKey, qty: number) => {
    setLines((l) => {
      const next = { ...l };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 99);
      return next;
    });
  }, []);

  const add = useCallback((id: PriceKey, qty = 1) => {
    setLines((l) => ({ ...l, [id]: Math.min((l[id] ?? 0) + qty, 99) }));
    setToast(`${productById[id].name} added to bag`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const entries = Object.entries(lines) as [PriceKey, number][];
  const count = entries.reduce((n, [, q]) => n + q, 0);
  const total = entries.reduce((n, [id, q]) => n + productById[id].price * q, 0);

  const summary = useCallback(() => {
    const rows = (Object.entries(lines) as [PriceKey, number][]).map(
      ([id, q]) => `• ${q} × ${productById[id].name} — ${inr(productById[id].price * q)}`,
    );
    return rows.length ? `${rows.join("\n")}\nEstimated total: ${inr(total)}` : "";
  }, [lines, total]);

  const value = useMemo<BagCtx>(
    () => ({
      lines,
      count,
      total,
      add,
      setQty,
      clear: () => setLines({}),
      open: () => setOpen(true),
      close: () => setOpen(false),
      summary,
    }),
    [lines, count, total, add, setQty, summary],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <BagDrawer open={isOpen} />
      <div className={`toast ${toast ? "is-on" : ""}`} role="status" aria-live="polite">
        {toast && (
          <>
            <span>{toast}</span>
            <button type="button" onClick={() => setOpen(true)}>
              view bag
            </button>
          </>
        )}
      </div>
    </Ctx.Provider>
  );
}

function BagDrawer({ open }: { open: boolean }) {
  const bag = useBag();
  const panel = useRef<HTMLDivElement>(null);
  const entries = Object.entries(bag.lines) as [PriceKey, number][];

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  const waText = `Hi Pooja! I'd like to order:\n${bag.summary()}`;

  const toEnquiry = () => {
    bag.close();
    // Wait for the drawer's scroll lock to lift, otherwise the scroll is swallowed.
    setTimeout(() => {
      if (location.hash === "#chat") window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = "chat";
    }, 80);
  };

  return (
    <div className={`drawer-root ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="drawer-scrim" onClick={bag.close} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Your bag" tabIndex={-1} ref={panel}>
        <div className="drawer-head">
          <p className="drawer-title">
            your bag <span>({bag.count})</span>
          </p>
          <button type="button" className="icon-btn" onClick={bag.close} aria-label="Close bag">
            <CloseIcon />
          </button>
        </div>

        {entries.length ? (
          <>
            <ul className="lines">
              {entries.map(([id, q]) => {
                const p = productById[id];
                return (
                  <li key={id} className="line">
                    <div className={`line-thumb thumb-${id}`} aria-hidden="true" />
                    <div className="line-info">
                      <p className="line-name">{p.name}</p>
                      <p className="line-unit">
                        {inr(p.price)} {p.unit} · {p.turnaround}
                      </p>
                      <div className="qty" role="group" aria-label={`Quantity of ${p.name}`}>
                        <button type="button" onClick={() => bag.setQty(id, q - 1)} aria-label="Decrease">
                          −
                        </button>
                        <span aria-live="polite">{q}</span>
                        <button type="button" onClick={() => bag.setQty(id, q + 1)} aria-label="Increase">
                          +
                        </button>
                      </div>
                    </div>
                    <div className="line-right">
                      <p className="line-price">{inr(p.price * q)}</p>
                      <button type="button" className="link-btn" onClick={() => bag.setQty(id, 0)}>
                        remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="drawer-foot">
              <div className="subtotal">
                <span>estimated total</span>
                <strong>{inr(bag.total)}</strong>
              </div>
              <p className="drawer-note">
                no payment now — we confirm your brief, timeline & any bulk discount first.
              </p>
              <a className="btn btn-wa btn-block" href={waLink(waText)} target="_blank" rel="noopener">
                <WhatsAppIcon size={18} /> checkout on whatsapp
              </a>
              <button type="button" className="btn btn-outline btn-block" onClick={toEnquiry}>
                send as an email enquiry
              </button>
            </div>
          </>
        ) : (
          <div className="drawer-empty">
            <p>your bag is empty.</p>
            <a className="btn btn-dark" href="#shop" onClick={bag.close}>
              shop services
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function BagButton() {
  const bag = useBag();
  return (
    <button type="button" className="icon-btn bag-btn" onClick={bag.open} aria-label={`Open bag, ${bag.count} items`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M5 8h14l-1 12H6L5 8Z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {bag.count > 0 && <span className="bag-count">{bag.count}</span>}
    </button>
  );
}

export function AddToBag({ id, className = "" }: { id: PriceKey; className?: string }) {
  const bag = useBag();
  return (
    <button type="button" className={`btn btn-dark ${className}`} onClick={() => bag.add(id)}>
      add to bag
    </button>
  );
}
