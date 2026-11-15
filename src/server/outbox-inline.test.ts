import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyForDomainEvent = vi.fn();
const createInvoiceForOrder = vi.fn();
const generateInvoicePdf = vi.fn();
const ensureShipmentForConfirmedOrder = vi.fn();
const refundLateCaptureShortfall = vi.fn();
let shippingConfigured = false;
let prepaidConfigured = true;

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/documents", () => ({ getDocumentStore: async () => ({}) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
// runOnce just runs the body: dedupe is covered by its own tests.
vi.mock("@/server/events", () => ({
  dispatchPending: vi.fn(),
  runOnce: async (_db: unknown, i: { run: () => Promise<{ result: unknown }> }) => i.run(),
}));
vi.mock("@/server/notifications", () => ({
  notifyForDomainEvent: (...a: unknown[]) => notifyForDomainEvent(...a),
}));
vi.mock("@/server/payments", () => ({
  isPrepaidConfigured: () => prepaidConfigured,
  getPaymentProvider: () => ({}),
}));
vi.mock("@/server/invoices/service", () => ({
  createInvoiceForOrder: (...a: unknown[]) => createInvoiceForOrder(...a),
  generateInvoicePdf: (...a: unknown[]) => generateInvoicePdf(...a),
}));
vi.mock("@/server/refunds/service", () => ({
  refundLateCaptureShortfall: (...a: unknown[]) => refundLateCaptureShortfall(...a),
}));
vi.mock("@/server/shipping", () => ({
  isShippingConfigured: () => shippingConfigured,
  getFulfilmentProvider: () => ({}),
  ensureShipmentForConfirmedOrder: (...a: unknown[]) => ensureShipmentForConfirmedOrder(...a),
}));

import { runInlineConsumers } from "./outbox-inline";

const msg = (type: string, aggregateType = "Order") => ({
  outboxEventId: "o1",
  domainEventId: "d1",
  type,
  aggregateType,
  aggregateId: "order-1",
  payloadVersion: 1,
  payload: {},
  attempts: 1,
});

describe("runInlineConsumers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shippingConfigured = false;
    prepaidConfigured = true;
    notifyForDomainEvent.mockResolvedValue({ results: [] });
    createInvoiceForOrder.mockResolvedValue({ id: "inv-1" });
    generateInvoicePdf.mockResolvedValue(undefined);
  });

  it("sends notifications for every event but leaves invoice/shipment alone for non-confirmations", async () => {
    await runInlineConsumers(msg("order.placed"));
    expect(notifyForDomainEvent).toHaveBeenCalledTimes(1);
    expect(createInvoiceForOrder).not.toHaveBeenCalled();
    expect(ensureShipmentForConfirmedOrder).not.toHaveBeenCalled();
  });

  it("on payment settled: notifies, issues the invoice and PDF, ships only when configured", async () => {
    await runInlineConsumers(msg("order.payment_settled"));
    expect(notifyForDomainEvent).toHaveBeenCalledTimes(1);
    expect(createInvoiceForOrder).toHaveBeenCalledWith({}, { orderId: "order-1" });
    expect(generateInvoicePdf).toHaveBeenCalledTimes(1);
    expect(ensureShipmentForConfirmedOrder).not.toHaveBeenCalled();

    shippingConfigured = true;
    ensureShipmentForConfirmedOrder.mockResolvedValue({});
    await runInlineConsumers(msg("order.payment_settled"));
    expect(ensureShipmentForConfirmedOrder).toHaveBeenCalledTimes(1);
  });

  it("a failing consumer does not stop the others, and the event is reported failed so it retries", async () => {
    createInvoiceForOrder.mockRejectedValue(new Error("pdf store down"));
    await expect(runInlineConsumers(msg("order.payment_settled"))).rejects.toThrow(
      /invoice: pdf store down/,
    );
    // Notifications had already gone out.
    expect(notifyForDomainEvent).toHaveBeenCalledTimes(1);
  });

  it("refunds a late double-capture only when payments are configured", async () => {
    refundLateCaptureShortfall.mockResolvedValue({});
    await runInlineConsumers(msg("order.late_capture_review"));
    expect(refundLateCaptureShortfall).toHaveBeenCalledTimes(1);

    prepaidConfigured = false;
    await runInlineConsumers(msg("order.late_capture_review"));
    expect(refundLateCaptureShortfall).toHaveBeenCalledTimes(1);
  });

  it("ignores non-order events beyond notifications", async () => {
    await runInlineConsumers(msg("order.payment_settled", "Product"));
    expect(createInvoiceForOrder).not.toHaveBeenCalled();
  });
});
