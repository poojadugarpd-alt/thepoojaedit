/**
 * Order / payment / fulfilment / refund / return state machines (master §8).
 * Explicit legal transitions; a transition not listed is rejected. Aggregate
 * payment state is derived so a failed later attempt cannot downgrade a success.
 */

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "NEEDS_REVIEW"
  | "CANCELLED"
  | "COMPLETED";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "COD_PENDING"
  | "COD_COLLECTED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type FulfillmentStatus =
  | "UNFULFILLED"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "NDR"
  | "RTO_IN_TRANSIT"
  | "RTO_RECEIVED"
  | "CANCELLED";

export type RefundStatus =
  "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "NEEDS_REVIEW";

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTED"
  | "RESOLVED";

export class IllegalTransitionError extends Error {
  constructor(machine: string, from: string, to: string) {
    super(`Illegal ${machine} transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

type Table<S extends string> = Record<S, readonly S[]>;

export const ORDER_TRANSITIONS: Table<OrderStatus> = {
  PENDING_PAYMENT: ["CONFIRMED", "NEEDS_REVIEW", "CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "NEEDS_REVIEW", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NEEDS_REVIEW", "CANCELLED"],
  NEEDS_REVIEW: ["CONFIRMED", "CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: ["NEEDS_REVIEW"],
};

export const FULFILLMENT_TRANSITIONS: Table<FulfillmentStatus> = {
  UNFULFILLED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "NDR", "RTO_IN_TRANSIT"],
  OUT_FOR_DELIVERY: ["DELIVERED", "NDR", "RTO_IN_TRANSIT"],
  NDR: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO_IN_TRANSIT"],
  RTO_IN_TRANSIT: ["RTO_RECEIVED"],
  RTO_RECEIVED: [],
  DELIVERED: ["RTO_IN_TRANSIT"],
  CANCELLED: [],
};

export const REFUND_TRANSITIONS: Table<RefundStatus> = {
  REQUESTED: ["PROCESSING", "FAILED", "NEEDS_REVIEW"],
  PROCESSING: ["COMPLETED", "FAILED", "NEEDS_REVIEW"],
  FAILED: ["PROCESSING", "NEEDS_REVIEW"],
  NEEDS_REVIEW: ["PROCESSING", "COMPLETED", "FAILED"],
  COMPLETED: [],
};

export const RETURN_TRANSITIONS: Table<ReturnStatus> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["IN_TRANSIT", "RECEIVED", "REJECTED"],
  REJECTED: [],
  IN_TRANSIT: ["RECEIVED"],
  RECEIVED: ["INSPECTED"],
  INSPECTED: ["RESOLVED"],
  RESOLVED: [],
};

export function canTransition<S extends string>(
  table: Table<S>,
  from: S,
  to: S,
): boolean {
  if (from === to) return true;
  return (table[from] ?? []).includes(to);
}

export function assertTransition<S extends string>(
  machine: string,
  table: Table<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(table, from, to)) {
    throw new IllegalTransitionError(machine, from, to);
  }
}

/**
 * Derive the order-level payment status from payment attempts and refunds
 * (master §8): a later FAILED attempt never downgrades a PAID/AUTHORIZED result.
 */
export function deriveAggregatePaymentStatus(input: {
  method: "PREPAID_RAZORPAY" | "COD";
  attempts: {
    status: "CREATED" | "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  }[];
  refunds: { status: RefundStatus; amountPaise: number }[];
  capturedAmountPaise: number;
  refundedAmountPaise: number; // sum of COMPLETED refunds
}): PaymentStatus {
  const anyCaptured = input.attempts.some((a) => a.status === "CAPTURED");
  const anyAuthorized = input.attempts.some((a) => a.status === "AUTHORIZED");

  if (input.method === "COD") {
    if (
      input.refundedAmountPaise > 0 &&
      input.refundedAmountPaise >= input.capturedAmountPaise
    ) {
      return "REFUNDED";
    }
    if (input.refundedAmountPaise > 0) return "PARTIALLY_REFUNDED";
    return anyCaptured ? "COD_COLLECTED" : "COD_PENDING";
  }

  if (anyCaptured) {
    if (
      input.refundedAmountPaise >= input.capturedAmountPaise &&
      input.capturedAmountPaise > 0
    ) {
      return "REFUNDED";
    }
    if (input.refundedAmountPaise > 0) return "PARTIALLY_REFUNDED";
    return "PAID";
  }
  if (anyAuthorized) return "AUTHORIZED";
  if (input.attempts.some((a) => a.status === "PENDING" || a.status === "CREATED")) {
    return "PENDING";
  }
  if (input.attempts.length > 0 && input.attempts.every((a) => a.status === "FAILED")) {
    return "FAILED";
  }
  return "UNPAID";
}
