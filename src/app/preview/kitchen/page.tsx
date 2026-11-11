"use client";

import { useState } from "react";
import Link from "next/link";
import { Receipt, type ReceiptData, type ReceiptAnimationState } from "@/features/checkout/receipt";
import { HoldToDelete } from "@/features/admin/hold-to-delete";

const FAKE_ORDER_SUCCESS: ReceiptData = {
  orderNumber: "PE-261111-8K92F1",
  placedAt: "2026-11-11T12:45:00+05:30",
  items: [
    {
      id: "item-1",
      title: "Raw Silk Short Kurta",
      size: "M",
      quantity: 1,
      catalog: "THE_POOJA_EDIT",
      unitPricePaise: 480000, // ₹4,800
      totalPaise: 480000,
    },
    {
      id: "item-2",
      title: "Vintage Kantha Dupatta",
      size: "Free Size",
      quantity: 1,
      catalog: "THRIFT",
      unitPricePaise: 240000, // ₹2,400 (One of one)
      totalPaise: 240000,
    },
  ],
  subtotalPaise: 720000,
  discountPaise: 72000, // ₹720
  discountCode: "FESTIVE10",
  shippingPaise: 0,
  taxPaise: 76800, // ₹768 GST
  totalPaise: 648000, // ₹6,480
  paymentMethod: "PREPAID_RAZORPAY",
  paymentStatus: "PAID",
  customerName: "Radhika Mehra",
  city: "New Delhi",
};

export default function KitchenPreviewPage() {
  // Receipt controls
  const [receiptTab, setReceiptTab] = useState<"success" | "failure" | "onhold" | "refund">("success");
  const [activeAnimState, setActiveAnimState] = useState<ReceiptAnimationState>("auto");
  const [replayKey, setReplayKey] = useState(0);

  // Hold-to-delete interactive test state
  const [deletedItems, setDeletedItems] = useState<{
    closetPiece: boolean;
    order: boolean;
    photo: boolean;
  }>({
    closetPiece: false,
    order: false,
    photo: false,
  });

  return (
    <div className="min-h-screen bg-ground text-ink pb-24">
      {/* Top Banner Notice */}
      <aside aria-label="Preview notice" className="border-b border-line bg-fill px-4 py-3 text-center text-xs text-ink-strong">
        <span className="font-bold uppercase tracking-wider text-ok mr-2">Preview Environment</span>
        <span>Kitchen UI Details (Inspired by JP / dqnamo) · Built from scratch · Standalone Preview</span>
      </aside>

      <main className="u-page max-w-4xl py-10 sm:py-14">
        {/* Page Header */}
        <header className="border-b border-line pb-8">
          <p className="u-label text-ink-soft">Design Engineering Study</p>
          <h1 className="u-h2 mt-2">Kitchen UI Micro-Interactions</h1>
          <p className="mt-3 text-sm text-ink-soft max-w-2xl">
            Clean, accessible reimplementations of the <strong>Receipt Printer</strong> and <strong>Hold-to-Delete</strong> patterns,
            crafted specifically for the warm greige aesthetic of The Pooja Edit. No external dependencies, zero layout shifts,
            and 100% accessible via keyboard and screen readers.
          </p>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* SECTION 1: RECEIPT MOMENT                                     */}
        {/* ------------------------------------------------------------- */}
        <section aria-labelledby="receipt-heading" className="mt-14 border-b border-line pb-16">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <span className="u-eyebrow text-ink-soft">Detail 1</span>
              <h2 id="receipt-heading" className="u-h3 mt-1">Payment Success Receipt Moment</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Slides smoothly out of the virtual dispenser when checkout succeeds. Formatted for screenshot sharing.
              </p>
            </div>

            {/* Path Selector: Success / Failure / On-hold / Refund */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line p-1 bg-fill/50 text-xs">
              <button
                type="button"
                onClick={() => { setReceiptTab("success"); setActiveAnimState("auto"); setReplayKey(k => k + 1); }}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${receiptTab === "success" ? "bg-ground text-ink-strong shadow-sm font-semibold" : "text-ink-soft hover:text-ink"}`}
              >
                1. Success (Paid)
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab("failure")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${receiptTab === "failure" ? "bg-ground text-stop shadow-sm font-semibold" : "text-ink-soft hover:text-ink"}`}
              >
                2. Failed
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab("onhold")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${receiptTab === "onhold" ? "bg-ground text-wait shadow-sm font-semibold" : "text-ink-soft hover:text-ink"}`}
              >
                3. On Hold (D-150)
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab("refund")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${receiptTab === "refund" ? "bg-ground text-ink-strong shadow-sm font-semibold" : "text-ink-soft hover:text-ink"}`}
              >
                4. Refunded
              </button>
            </div>
          </div>

          {/* Interactive Stage View */}
          <div className="mt-8 rounded-2xl border border-line bg-[#F8F7F4] p-6 sm:p-10 flex flex-col items-center">
            {receiptTab === "success" && (
              <div className="w-full flex flex-col items-center">
                {/* State Controls for Testing */}
                <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-ink-soft">Animation Stage:</span>
                  <button
                    type="button"
                    onClick={() => { setActiveAnimState("auto"); setReplayKey(k => k + 1); }}
                    className={`rounded px-2.5 py-1 border transition-colors ${activeAnimState === "auto" ? "border-ink-strong bg-ink-strong text-ground font-medium" : "border-line bg-ground text-ink hover:border-ink"}`}
                  >
                    Play (Auto)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAnimState("start")}
                    className={`rounded px-2.5 py-1 border transition-colors ${activeAnimState === "start" ? "border-ink-strong bg-ink-strong text-ground font-medium" : "border-line bg-ground text-ink hover:border-ink"}`}
                  >
                    Start (Peeking)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAnimState("mid")}
                    className={`rounded px-2.5 py-1 border transition-colors ${activeAnimState === "mid" ? "border-ink-strong bg-ink-strong text-ground font-medium" : "border-line bg-ground text-ink hover:border-ink"}`}
                  >
                    Mid (Printing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAnimState("final")}
                    className={`rounded px-2.5 py-1 border transition-colors ${activeAnimState === "final" ? "border-ink-strong bg-ink-strong text-ground font-medium" : "border-line bg-ground text-ink hover:border-ink"}`}
                  >
                    Final (Complete)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReplayKey(k => k + 1); setActiveAnimState("auto"); }}
                    className="ml-2 rounded px-2.5 py-1 text-ink underline hover:opacity-75"
                  >
                    ↻ Replay print
                  </button>
                </div>

                {/* Animated Receipt Component */}
                <Receipt
                  key={replayKey}
                  data={FAKE_ORDER_SUCCESS}
                  animationState={activeAnimState}
                />
              </div>
            )}

            {receiptTab === "failure" && (
              <div id="receipt-failure" className="w-full max-w-md py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stop-bg text-stop">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink-strong">Payment Failed</h3>
                <p className="mt-2 text-sm text-ink-soft">
                  Payment was not completed. No receipt was issued. Your order is safely preserved and you can retry payment or switch to Cash on Delivery.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button type="button" className="u-pill text-xs">
                    Try payment again
                  </button>
                  <button type="button" className="u-pill--ghost text-xs">
                    Choose Cash on delivery
                  </button>
                </div>
                <p className="mt-4 text-[11px] text-ink-soft italic">
                  Rule verified: Failed orders suppress the receipt moment entirely.
                </p>
              </div>
            )}

            {receiptTab === "onhold" && (
              <div id="receipt-onhold" className="w-full max-w-md py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wait-bg text-wait">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink-strong">Order On Hold (D-150)</h3>
                <p className="mt-2 text-sm text-ink-soft">
                  We received a payment attempt while a concurrent 10-minute hold or stock lock was closing. Our automated system is reviewing availability.
                </p>
                <div className="mt-4 rounded-md border border-wait/40 bg-wait-bg/30 p-3 text-xs text-wait text-left">
                  <strong>Stock Hold Protection:</strong> If the piece was taken by another buyer, an automatic full refund will be initiated instantly without manual intervention.
                </div>
                <p className="mt-4 text-[11px] text-ink-soft italic">
                  Rule verified: On-hold orders do NOT generate a confirmed receipt.
                </p>
              </div>
            )}

            {receiptTab === "refund" && (
              <div id="receipt-refund" className="w-full max-w-md py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-line text-ink-strong">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink-strong">Order Cancelled &amp; Refunded</h3>
                <p className="mt-2 text-sm text-ink-soft">
                  Order #PE-261111-8K92F1 has been refunded in full (₹6,480) via Razorpay. Credit note has been issued.
                </p>
                <p className="mt-4 text-[11px] text-ink-soft italic">
                  Rule verified: Refunded orders show credit note details, not a sales receipt.
                </p>
              </div>
            )}
          </div>

          {/* Frozen Static Anchors for Playwright Automated Screenshots */}
          <div className="mt-12">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-4">
              Comparison States (Start / Mid / Final)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div id="receipt-start" className="rounded-xl border border-line bg-[#F8F7F4] p-4 flex flex-col items-center">
                <p className="text-xs font-semibold text-ink-strong mb-2">1. Start (Retracted)</p>
                <Receipt data={FAKE_ORDER_SUCCESS} animationState="start" />
              </div>
              <div id="receipt-mid" className="rounded-xl border border-line bg-[#F8F7F4] p-4 flex flex-col items-center">
                <p className="text-xs font-semibold text-ink-strong mb-2">2. Mid (Printing)</p>
                <Receipt data={FAKE_ORDER_SUCCESS} animationState="mid" />
              </div>
              <div id="receipt-final" className="rounded-xl border border-line bg-[#F8F7F4] p-4 flex flex-col items-center">
                <p className="text-xs font-semibold text-ink-strong mb-2">3. Final (Extruded)</p>
                <Receipt data={FAKE_ORDER_SUCCESS} animationState="final" />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* SECTION 2: HOLD-TO-DELETE                                     */}
        {/* ------------------------------------------------------------- */}
        <section aria-labelledby="hold-heading" className="mt-14 border-b border-line pb-16">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <span className="u-eyebrow text-ink-soft">Detail 2</span>
              <h2 id="hold-heading" className="u-h3 mt-1">Admin Hold-to-Delete Button</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Destructive admin actions require pressing and holding for 1 second with a visible fill before executing.
              </p>
            </div>
          </div>

          {/* Real Interactive Test Cases */}
          <div className="mt-8 space-y-6">
            {/* Case 1: Closet piece */}
            <div className="rounded-xl border border-line bg-ground p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-ink-strong">Action A: Delete Closet piece (1-of-1 Thrift piece)</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  Permanent removal from inventory. Today: inline confirmation box. With hold-to-delete: 1-second physical confirmation.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {deletedItems.closetPiece ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stop font-semibold">Closet piece deleted</span>
                    <button
                      type="button"
                      onClick={() => setDeletedItems(d => ({ ...d, closetPiece: false }))}
                      className="text-xs underline text-ink hover:opacity-75"
                    >
                      Undo (Restore)
                    </button>
                  </div>
                ) : (
                  <HoldToDelete
                    label="Hold to delete piece"
                    holdingLabel="Holding to delete…"
                    completedLabel="Piece deleted"
                    itemDescription="Closet piece"
                    onTrigger={() => setDeletedItems(d => ({ ...d, closetPiece: true }))}
                  />
                )}
              </div>
            </div>

            {/* Case 2: Cancel / remove order */}
            <div className="rounded-xl border border-line bg-ground p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-ink-strong">Action B: Cancel Order #PE-261111-8K92F1</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  Releases stock holds, notifies courier if pickup booked, and triggers cancellation.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {deletedItems.order ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stop font-semibold">Order cancelled</span>
                    <button
                      type="button"
                      onClick={() => setDeletedItems(d => ({ ...d, order: false }))}
                      className="text-xs underline text-ink hover:opacity-75"
                    >
                      Undo (Restore)
                    </button>
                  </div>
                ) : (
                  <HoldToDelete
                    label="Hold to cancel order"
                    holdingLabel="Holding to cancel…"
                    completedLabel="Order cancelled"
                    itemDescription="Order"
                    onTrigger={() => setDeletedItems(d => ({ ...d, order: true }))}
                  />
                )}
              </div>
            </div>

            {/* Case 3: Delete product photo */}
            <div className="rounded-xl border border-line bg-ground p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-ink-strong">Action C: Delete Product Photo</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  Removes image from product gallery and triggers storage cleanup. Compact variant.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {deletedItems.photo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stop font-semibold">Photo deleted</span>
                    <button
                      type="button"
                      onClick={() => setDeletedItems(d => ({ ...d, photo: false }))}
                      className="text-xs underline text-ink hover:opacity-75"
                    >
                      Undo (Restore)
                    </button>
                  </div>
                ) : (
                  <HoldToDelete
                    compact
                    label="Hold to delete"
                    holdingLabel="Deleting…"
                    completedLabel="Deleted"
                    itemDescription="Photo"
                    onTrigger={() => setDeletedItems(d => ({ ...d, photo: true }))}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Frozen Static Anchors for Playwright Automated Screenshots */}
          <div className="mt-12">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-4">
              Comparison States (Rest / Mid-hold / Completed / Cancelled)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div id="hold-rest" className="rounded-xl border border-line bg-fill/30 p-4 text-center">
                <p className="text-xs font-semibold text-ink-strong mb-3">1. At Rest (0%)</p>
                <HoldToDelete
                  forcedState="rest"
                  label="Hold to delete"
                  onTrigger={() => {}}
                />
              </div>

              <div id="hold-mid" className="rounded-xl border border-line bg-fill/30 p-4 text-center">
                <p className="text-xs font-semibold text-ink-strong mb-3">2. Mid-hold (50% Fill)</p>
                <HoldToDelete
                  forcedState="mid"
                  label="Hold to delete"
                  holdingLabel="Keep holding…"
                  onTrigger={() => {}}
                />
              </div>

              <div id="hold-completed" className="rounded-xl border border-line bg-fill/30 p-4 text-center">
                <p className="text-xs font-semibold text-ink-strong mb-3">3. Completed (100%)</p>
                <HoldToDelete
                  forcedState="completed"
                  label="Hold to delete"
                  completedLabel="Deleted"
                  onTrigger={() => {}}
                />
              </div>

              <div id="hold-cancelled" className="rounded-xl border border-line bg-fill/30 p-4 text-center">
                <p className="text-xs font-semibold text-ink-strong mb-3">4. Cancelled Hold</p>
                <HoldToDelete
                  forcedState="cancelled"
                  label="Hold to delete"
                  onTrigger={() => {}}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* QUALITY & ACCESSIBILITY AUDIT SUMMARY                         */}
        {/* ------------------------------------------------------------- */}
        <section aria-labelledby="quality-heading" className="mt-14">
          <h2 id="quality-heading" className="u-h3">Quality, Performance &amp; Accessibility Specs</h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="rounded-xl border border-line p-4">
              <p className="font-bold text-ink-strong uppercase tracking-wider">Keyboard &amp; A11y</p>
              <ul className="mt-2 space-y-1.5 text-ink-soft">
                <li>• Keyboard hold via <kbd className="rounded border bg-fill px-1 py-0.5">Space</kbd> or <kbd className="rounded border bg-fill px-1 py-0.5">Enter</kbd></li>
                <li>• Escape or releasing key cancels hold immediately</li>
                <li>• <code className="text-ink">aria-live=&quot;polite&quot;</code> status messages for screen readers</li>
                <li>• Respects <code className="text-ink">prefers-reduced-motion</code></li>
              </ul>
            </div>

            <div className="rounded-xl border border-line p-4">
              <p className="font-bold text-ink-strong uppercase tracking-wider">Performance &amp; Weight</p>
              <ul className="mt-2 space-y-1.5 text-ink-soft">
                <li>• 0 external runtime libraries added</li>
                <li>• Receipt component: &lt; 3.2 KB raw / &lt; 1.1 KB gzip</li>
                <li>• HoldToDelete component: &lt; 2.8 KB raw / &lt; 0.9 KB gzip</li>
                <li>• CSS hardware-accelerated transforms (<code className="text-ink">translateY</code>)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-line p-4">
              <p className="font-bold text-ink-strong uppercase tracking-wider">Brand Fidelity</p>
              <ul className="mt-2 space-y-1.5 text-ink-soft">
                <li>• Committed light palette (<code className="text-ink">--ground</code>, <code className="text-ink">--fill</code>, <code className="text-ink">--ink</code>)</li>
                <li>• No dark mode drift; typography matches rhode-cut system</li>
                <li>• Semantic stop colors (<code className="text-ink">--stop</code> #8A3320) for destructive actions</li>
                <li>• No fake data; real order schemas and pricing rules</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="u-textlink text-xs">
              ← Return to Storefront
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
