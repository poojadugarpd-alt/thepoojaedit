"use client";

import { useEffect, useState } from "react";
import { formatPaiseINR } from "@/lib/money";
import { CATALOG_LABEL } from "@/lib/catalog-routes";

export interface ReceiptItem {
  id: string;
  title: string;
  size?: string | null;
  quantity: number;
  catalog: "THE_POOJA_EDIT" | "THRIFT";
  unitPricePaise: number;
  totalPaise: number;
}

export interface ReceiptData {
  orderNumber: string;
  placedAt: string | Date | null;
  items: ReceiptItem[];
  subtotalPaise: number;
  discountPaise?: number;
  discountCode?: string | null;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  paymentStatus:
    | "PAID"
    | "UNPAID"
    | "PENDING"
    | "AUTHORIZED"
    | "COD_PENDING"
    | "FAILED"
    | "REFUNDED"
    | string;
  customerName?: string | null;
  city?: string | null;
}

export type ReceiptAnimationState = "auto" | "start" | "mid" | "final";

interface ReceiptProps {
  data: ReceiptData;
  /** Force an exact animation stage for screenshots/testing, or "auto" to play the print animation */
  animationState?: ReceiptAnimationState;
  onPrintComplete?: () => void;
  className?: string;
}

export function Receipt({
  data,
  animationState = "auto",
  onPrintComplete,
  className = "",
}: ReceiptProps) {
  const [internalState, setInternalState] = useState<"start" | "mid" | "final">(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return "final";
    }
    return "start";
  });

  useEffect(() => {
    if (animationState !== "auto") return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onPrintComplete?.();
      return;
    }

    const midTimer = setTimeout(() => {
      setInternalState("mid");
    }, 450);

    const finalTimer = setTimeout(() => {
      setInternalState("final");
      onPrintComplete?.();
    }, 1100);

    return () => {
      clearTimeout(midTimer);
      clearTimeout(finalTimer);
    };
  }, [animationState, onPrintComplete]);

  const currentState = animationState !== "auto" ? animationState : internalState;

  // Physical extrusion: paper feeds downward out of the top dispenser slot
  // start: top header emerges from the slot (~155px)
  // mid: top half of receipt is extruded with items (~360px)
  // final: 100% of receipt is extruded with totals and jagged tear edge
  const extrusionClass =
    currentState === "start"
      ? "max-h-[155px] opacity-95 scale-[0.99]"
      : currentState === "mid"
        ? "max-h-[360px] opacity-100 scale-[0.995]"
        : "max-h-[850px] opacity-100 scale-100";

  const dateObj = data.placedAt
    ? typeof data.placedAt === "string"
      ? new Date(data.placedAt)
      : data.placedAt
    : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const formattedTime = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div
      className={`relative mx-auto w-full max-w-[360px] pt-4 ${className}`}
      data-testid="receipt-container"
      data-receipt-state={currentState}
    >
      {/* Printer Dispenser Slot (Physical housing) */}
      <div
        className="relative z-20 mx-auto w-11/12 h-3.5 rounded-full bg-[#E5E3DE] border border-[#C8C5BE] shadow-sm flex items-center justify-center px-4"
        aria-hidden="true"
      >
        <div className="w-full h-1 rounded-full bg-[#3D3A35] shadow-inner" />
      </div>

      {/* Overflow clipping container for the expanding printed paper */}
      <div
        className={`relative z-10 -mt-2 overflow-hidden pt-2 pb-6 px-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${extrusionClass}`}
        style={{ willChange: "max-height, opacity" }}
      >
        <article
          role="region"
          aria-label={`Official receipt for order ${data.orderNumber}`}
          className="relative mx-auto w-full bg-ground border border-line shadow-[0_10px_28px_rgba(64,62,57,0.08)]"
        >
          {/* Subtle feed line / notch at the top */}
          <div
            className="h-1.5 w-full border-b border-dashed border-line bg-fill/50"
            aria-hidden="true"
          />

          <div className="p-6 sm:p-7">
            {/* Receipt Header */}
            <header className="text-center">
              <p className="text-[13px] font-bold tracking-[0.16em] uppercase text-ink-strong">
                The Pooja Edit
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                New Delhi · thepoojaedit.in
              </p>
              <div
                className="my-3.5 border-b border-dashed border-line"
                aria-hidden="true"
              />
            </header>

            {/* Order Identity & Timestamp */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-ink-soft">
                  Order No.
                </span>
                <span className="font-semibold text-ink-strong tracking-wide">
                  {data.orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-ink-soft">
                  Date
                </span>
                <span className="text-ink">
                  {formattedDate}, {formattedTime}
                </span>
              </div>
              {data.customerName && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-ink-soft">
                    Customer
                  </span>
                  <span className="text-ink truncate max-w-[180px]">
                    {data.customerName}
                    {data.city ? ` (${data.city})` : ""}
                  </span>
                </div>
              )}
            </div>

            <div
              className="my-3.5 border-b border-dashed border-line"
              aria-hidden="true"
            />

            {/* Line Items */}
            <section aria-label="Purchased items">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-ink-soft border-b border-line pb-1">
                    <th className="text-left font-medium pb-1.5">Item</th>
                    <th className="text-center font-medium pb-1.5 w-8">Qty</th>
                    <th className="text-right font-medium pb-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {data.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-ink-strong leading-tight">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-soft">
                          {CATALOG_LABEL[item.catalog]}
                          {item.size ? ` · ${item.size}` : ""}
                        </p>
                      </td>
                      <td className="py-2 text-center text-ink text-[11px]">
                        {item.quantity}
                      </td>
                      <td className="py-2 text-right text-ink font-medium whitespace-nowrap">
                        {formatPaiseINR(item.totalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div
              className="my-3.5 border-b border-dashed border-line"
              aria-hidden="true"
            />

            {/* Totals Breakdown */}
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="text-ink">{formatPaiseINR(data.subtotalPaise)}</dd>
              </div>

              {data.discountPaise && data.discountPaise > 0 ? (
                <div className="flex justify-between text-ok">
                  <dt>
                    Discount {data.discountCode ? `(${data.discountCode})` : ""}
                  </dt>
                  <dd>-{formatPaiseINR(data.discountPaise)}</dd>
                </div>
              ) : null}

              <div className="flex justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd className="text-ink">
                  {data.shippingPaise === 0
                    ? "Free"
                    : formatPaiseINR(data.shippingPaise)}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-ink-soft">GST (Included)</dt>
                <dd className="text-ink">{formatPaiseINR(data.taxPaise)}</dd>
              </div>

              <div className="flex justify-between border-t border-ink-strong/30 pt-2 text-sm font-bold text-ink-strong">
                <dt className="uppercase tracking-[0.06em]">Total Paid</dt>
                <dd>{formatPaiseINR(data.totalPaise)}</dd>
              </div>
            </dl>

            <div
              className="my-3.5 border-b border-dashed border-line"
              aria-hidden="true"
            />

            {/* Payment Confirmation Badge */}
            <div className="flex items-center justify-between rounded-md bg-ok-bg/50 px-2.5 py-1.5 text-xs text-ok">
              <span className="font-medium tracking-wide uppercase text-[10px]">
                {data.paymentMethod === "PREPAID_RAZORPAY"
                  ? "Prepaid Online"
                  : "Cash on Delivery"}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[11px]">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
                </svg>
                {data.paymentStatus === "PAID" ? "Payment Received" : data.paymentStatus}
              </span>
            </div>

            {/* Screenshot & Share Prompt */}
            <p className="mt-4 text-center text-[10px] text-ink-soft">
              Keep or screenshot this receipt for your records.
            </p>
          </div>

          {/* Jagged Sawtooth Tear-off Edge (Physical receipt perforation) */}
          <div className="relative h-2 w-full overflow-hidden leading-none" aria-hidden="true">
            <svg
              className="w-full h-2 block fill-ground"
              viewBox="0 0 320 8"
              preserveAspectRatio="none"
            >
              <path d="M0,0 L8,8 L16,0 L24,8 L32,0 L40,8 L48,0 L56,8 L64,0 L72,8 L80,0 L88,8 L96,0 L104,8 L112,0 L120,8 L128,0 L136,8 L144,0 L152,8 L160,0 L168,8 L176,0 L184,8 L192,0 L200,8 L208,0 L216,8 L224,0 L232,8 L240,0 L248,8 L256,0 L264,8 L272,0 L280,8 L288,0 L296,8 L304,0 L312,8 L320,0 L320,8 L0,8 Z" />
            </svg>
          </div>
        </article>
      </div>
    </div>
  );
}
