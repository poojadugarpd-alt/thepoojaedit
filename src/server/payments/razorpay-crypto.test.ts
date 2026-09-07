import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  checkoutSignature,
  normalizeRazorpayPayment,
  normalizeRazorpayRefund,
  parseRazorpayWebhookBody,
  safeEqualHex,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  webhookSignature,
} from "./razorpay-crypto";

const SECRET = "test_secret_abc123";

describe("checkout handoff signature", () => {
  it("matches HMAC_SHA256(order_id|payment_id, key_secret)", () => {
    const sig = checkoutSignature("order_ABC", "pay_XYZ", SECRET);
    const expected = createHmac("sha256", SECRET)
      .update("order_ABC|pay_XYZ")
      .digest("hex");
    expect(sig).toBe(expected);
    expect(
      verifyCheckoutSignature({
        providerOrderId: "order_ABC",
        providerPaymentId: "pay_XYZ",
        signature: sig,
        keySecret: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects a tampered payment id, order id, or signature", () => {
    const sig = checkoutSignature("order_ABC", "pay_XYZ", SECRET);
    expect(
      verifyCheckoutSignature({
        providerOrderId: "order_ABC",
        providerPaymentId: "pay_TAMPERED",
        signature: sig,
        keySecret: SECRET,
      }),
    ).toBe(false);
    expect(
      verifyCheckoutSignature({
        providerOrderId: "order_OTHER",
        providerPaymentId: "pay_XYZ",
        signature: sig,
        keySecret: SECRET,
      }),
    ).toBe(false);
    expect(
      verifyCheckoutSignature({
        providerOrderId: "order_ABC",
        providerPaymentId: "pay_XYZ",
        signature: sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0"),
        keySecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const sig = checkoutSignature("order_ABC", "pay_XYZ", "wrong_secret");
    expect(
      verifyCheckoutSignature({
        providerOrderId: "order_ABC",
        providerPaymentId: "pay_XYZ",
        signature: sig,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });
});

describe("webhook signature", () => {
  it("verifies the raw body bytes", () => {
    const raw = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const sig = webhookSignature(raw, SECRET);
    expect(verifyWebhookSignature({ rawBody: raw, signature: sig, webhookSecret: SECRET })).toBe(
      true,
    );
  });

  it("fails when a single byte of the body changes", () => {
    const raw = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const sig = webhookSignature(raw, SECRET);
    const tampered = Buffer.from(
      JSON.stringify({ event: "payment.captured", x: 1 }),
    );
    expect(
      verifyWebhookSignature({ rawBody: tampered, signature: sig, webhookSecret: SECRET }),
    ).toBe(false);
  });
});

describe("safeEqualHex", () => {
  it("is false for unequal lengths and non-hex input, true for an exact match", () => {
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("nothex", "nothex")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
    expect(safeEqualHex("deadbeef", "deadbeef")).toBe(true);
  });
});

describe("payload normalisation", () => {
  it("maps a captured payment entity, amounts stay in paise", () => {
    const n = normalizeRazorpayPayment({
      id: "pay_1",
      order_id: "order_1",
      status: "captured",
      amount: 129900,
      amount_refunded: 0,
      currency: "INR",
      method: "upi",
      captured: true,
    });
    expect(n).toMatchObject({
      providerPaymentId: "pay_1",
      providerOrderId: "order_1",
      status: "captured",
      amountPaise: 129900,
      capturedAmountPaise: 129900,
      currency: "INR",
      method: "upi",
    });
  });

  it("captured amount is 0 unless the status is captured", () => {
    expect(
      normalizeRazorpayPayment({ id: "p", status: "authorized", amount: 500 })
        .capturedAmountPaise,
    ).toBe(0);
  });

  it("normalises a refund entity", () => {
    expect(
      normalizeRazorpayRefund({ id: "rfnd_1", payment_id: "pay_1", status: "processed", amount: 500 }),
    ).toMatchObject({ providerRefundId: "rfnd_1", providerPaymentId: "pay_1", status: "processed", amountPaise: 500 });
  });

  it("parses a webhook body into event type + normalised payment", () => {
    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_9", order_id: "order_9", status: "captured", amount: 1000, currency: "INR" },
        },
      },
    };
    const v = parseRazorpayWebhookBody(body, "evt_123");
    expect(v.externalEventId).toBe("evt_123");
    expect(v.eventType).toBe("payment.captured");
    expect(v.payment?.providerPaymentId).toBe("pay_9");
    expect(v.payment?.capturedAmountPaise).toBe(1000);
  });
});
