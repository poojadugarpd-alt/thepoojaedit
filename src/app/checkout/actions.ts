"use server";

import { InMemoryRateLimiter } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/public-env";
import {
  placeCheckoutSchema,
  prepareCheckoutSchema,
  withStateName,
  type PlaceCheckoutInput,
} from "@/schemas/checkout";
import { getCurrentCustomer } from "@/server/auth/current-customer";
import {
  checkout,
  CHECKOUT_COD_ENABLED,
  getQuote,
  guestScope,
  IdempotencyConflictError,
  PriceChangedError,
  QuoteError,
} from "@/server/checkout";
import {
  confirmPrepaidCheckout,
  isPrepaidConfigured,
  PaymentMismatchError,
  PaymentVerificationError,
  startPrepaidPayment,
} from "@/server/payments";
import { verifyOrderAccessToken } from "@/server/orders/access-tokens";
import { prisma } from "@/lib/db";

/**
 * Checkout server actions. Business rules live in `src/server/*`; these are thin
 * adapters that validate input, resolve the (optional) signed-in customer, and
 * shape a serialisable result for the client.
 */

const placeLimiter = new InMemoryRateLimiter(8, 60_000);

export interface QuoteSummary {
  lines: {
    variantId: string;
    title: string;
    size: string | null;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  reservationTtlSeconds: number;
  hash: string;
  expiresAt: string;
}

export async function prepareCheckoutAction(
  raw: unknown,
): Promise<{ ok: true; quote: QuoteSummary } | { ok: false; error: string }> {
  const parsed = prepareCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const input = parsed.data;
  if (input.paymentMethod === "COD" && !CHECKOUT_COD_ENABLED) {
    return { ok: false, error: "Cash on delivery isn't offered — please pay online." };
  }
  try {
    const quote = await getQuote({
      lines: input.lines,
      paymentMethod: input.paymentMethod,
      destination: {
        stateCode: input.destinationStateCode,
        postcode: input.destinationPostcode,
      },
    });
    return {
      ok: true,
      quote: {
        lines: quote.lines.map((l) => ({
          variantId: l.variantId,
          title: l.title,
          size: l.size,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise,
          lineTotalPaise: l.lineTotalPaise,
        })),
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.discountPaise,
        shippingPaise: quote.shippingPaise,
        codFeePaise: quote.codFeePaise,
        taxPaise: quote.taxPaise,
        totalPaise: quote.totalPaise,
        reservationTtlSeconds: quote.reservationTtlSeconds,
        hash: quote.hash,
        expiresAt: quote.expiresAt.toISOString(),
      },
    };
  } catch (e) {
    if (e instanceof QuoteError) return { ok: false, error: e.message };
    throw e;
  }
}

export interface PlaceResult {
  ok: true;
  orderNumber: string;
  token?: string;
  method: "PREPAID_RAZORPAY" | "COD";
  prepaid?: {
    keyId: string;
    providerOrderId: string;
    amountPaise: number;
  } | null;
}

export async function placeCheckoutAction(
  raw: PlaceCheckoutInput,
): Promise<PlaceResult | { ok: false; error: string }> {
  const parsed = placeCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const input = parsed.data;

  const limit = placeLimiter.check(`place:${input.contactPhone.replace(/\D/g, "")}`);
  if (!limit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a minute and retry." };
  }

  if (input.paymentMethod === "PREPAID_RAZORPAY" && !isPrepaidConfigured()) {
    return {
      ok: false,
      error: "Card / UPI checkout isn't available right now. Please try again shortly.",
    };
  }
  if (input.paymentMethod === "COD" && !CHECKOUT_COD_ENABLED) {
    return { ok: false, error: "Cash on delivery isn't offered — please pay online." };
  }

  const customer = await getCurrentCustomer();
  const email = input.email || null;
  const scope = customer
    ? `customer:${customer.id}`
    : guestScope(input.contactPhone, email);

  try {
    const { order, guestAccessToken } = await checkout({
      idempotencyKey: input.idempotencyKey,
      scope,
      customerId: customer?.id ?? null,
      contact: { email, phone: input.contactPhone },
      lines: input.lines,
      paymentMethod: input.paymentMethod,
      billing: withStateName(input.billing),
      shipping: withStateName(input.shipping),
      source: input.source ?? null,
      clientQuoteHash: input.clientQuoteHash,
    });

    if (input.paymentMethod === "COD") {
      return {
        ok: true,
        orderNumber: order.orderNumber,
        token: guestAccessToken,
        method: "COD",
        prepaid: null,
      };
    }

    const attempt = await startPrepaidPayment(order.id);
    return {
      ok: true,
      orderNumber: order.orderNumber,
      token: guestAccessToken,
      method: "PREPAID_RAZORPAY",
      prepaid: {
        keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        providerOrderId: attempt.providerOrderId!,
        amountPaise: attempt.amountPaise,
      },
    };
  } catch (e) {
    if (e instanceof PriceChangedError) {
      return { ok: false, error: "price_changed" };
    }
    if (e instanceof IdempotencyConflictError) {
      return { ok: false, error: "Your cart changed. Please review and try again." };
    }
    if (e instanceof QuoteError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function finalizePrepaidAction(raw: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<
  | { ok: true; orderNumber: string; outcome: string }
  | { ok: false; error: "verification" | "mismatch" | "unknown" }
> {
  try {
    const result = await confirmPrepaidCheckout(raw);
    return {
      ok: true,
      orderNumber: result.order.orderNumber,
      outcome: result.outcome,
    };
  } catch (e) {
    if (e instanceof PaymentVerificationError) {
      return { ok: false, error: "verification" };
    }
    if (e instanceof PaymentMismatchError) {
      // The money may be real — it's flagged for review server-side.
      return { ok: false, error: "mismatch" };
    }
    return { ok: false, error: "unknown" };
  }
}

export async function resumePaymentAction(raw: {
  orderNumber: string;
  token: string;
}): Promise<
  | { ok: true; keyId: string; providerOrderId: string; amountPaise: number }
  | { ok: false; error: string }
> {
  if (!isPrepaidConfigured()) {
    return { ok: false, error: "Online payment isn't available right now." };
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber: raw.orderNumber },
  });
  if (!order) return { ok: false, error: "Order not found." };
  try {
    await verifyOrderAccessToken(prisma, {
      token: raw.token,
      scope: "ORDER_VIEW",
      orderId: order.id,
    });
  } catch {
    return { ok: false, error: "Order not found." };
  }
  if (
    order.paymentMethod !== "PREPAID_RAZORPAY" ||
    order.orderStatus !== "PENDING_PAYMENT"
  ) {
    return { ok: false, error: "This order is not awaiting payment." };
  }
  const attempt = await startPrepaidPayment(order.id);
  return {
    ok: true,
    keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    providerOrderId: attempt.providerOrderId!,
    amountPaise: attempt.amountPaise,
  };
}
