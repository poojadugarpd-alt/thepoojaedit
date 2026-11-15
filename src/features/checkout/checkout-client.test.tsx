// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const prepareCheckoutAction = vi.fn();
const placeCheckoutAction = vi.fn();
const finalizePrepaidAction = vi.fn();
vi.mock("@/app/checkout/actions", () => ({
  prepareCheckoutAction: (...a: unknown[]) => prepareCheckoutAction(...a),
  placeCheckoutAction: (...a: unknown[]) => placeCheckoutAction(...a),
  finalizePrepaidAction: (...a: unknown[]) => finalizePrepaidAction(...a),
}));

// Razorpay Checkout is a third-party iframe; the test drives its callbacks.
const openRazorpayCheckout = vi.fn();
vi.mock("./razorpay", () => ({
  openRazorpayCheckout: (...a: unknown[]) => openRazorpayCheckout(...a),
}));

import { useCart } from "@/features/cart/store";

import { CheckoutClient } from "./checkout-client";

const QUOTE = {
  lines: [
    {
      variantId: "v1",
      title: "Test piece",
      size: null,
      quantity: 1,
      unitPricePaise: 10000,
      lineTotalPaise: 10000,
    },
  ],
  subtotalPaise: 10000,
  discountPaise: 0,
  discountCode: null,
  shippingPaise: 0,
  codFeePaise: 0,
  taxPaise: 0,
  totalPaise: 10000,
  reservationTtlSeconds: 600,
  hash: "hash",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

const PLACED = {
  ok: true,
  method: "PREPAID_RAZORPAY",
  orderNumber: "PE-TEST-0001",
  token: "tok",
  prepaid: {
    keyId: "rzp_test_x",
    providerOrderId: "order_x",
    amountPaise: 10000,
    paymentWindowSeconds: 600,
  },
};

function seedCart() {
  useCart.setState({
    hydrated: true,
    lines: [
      {
        variantId: "v1",
        catalog: "THE_POOJA_EDIT",
        productSlug: "test-piece",
        productTitle: "Test piece",
        variantLabel: null,
        unitPricePaise: 10000,
        quantity: 1,
        imageUrl: null,
        returnPolicyNote: "",
        addedAt: 0,
      },
    ],
  });
}

async function reachPayButton() {
  render(<CheckoutClient prepaidEnabled codEnabled={false} />);
  const type = (label: string | RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type("Full name", "Test Buyer");
  type("Phone", "+919812345678");
  type("Email", "buyer@example.com");
  type("Address", "12 Test Lane");
  type("City", "Jaipur");
  type("State", "08");
  type("PIN code", "302001");
  fireEvent.click(screen.getByRole("button", { name: /review order/i }));
  return screen.findByRole("button", { name: /^Pay ₹/ });
}

describe("CheckoutClient — closing Razorpay without paying", () => {
  beforeEach(() => {
    push.mockClear();
    openRazorpayCheckout.mockReset();
    prepareCheckoutAction.mockResolvedValue({ ok: true, quote: QUOTE });
    placeCheckoutAction.mockResolvedValue(PLACED);
    seedCart();
  });
  afterEach(() => cleanup());

  it("empties the cart and sends the buyer to the saved order", async () => {
    // Razorpay opens, then the buyer closes it.
    openRazorpayCheckout.mockImplementation(async (args: { onDismiss: () => void }) =>
      args.onDismiss(),
    );

    fireEvent.click(await reachPayButton());

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    // The order exists and holds the stock, so the cart must not still list it
    // (a leftover line made the next checkout fail with "only 0 available").
    expect(useCart.getState().lines).toEqual([]);
    expect(push).toHaveBeenCalledWith("/order/PE-TEST-0001?token=tok&placed=1");
  });

  it("keeps the cart when the order could not be placed", async () => {
    placeCheckoutAction.mockResolvedValue({ ok: false, error: "Sold out" });

    fireEvent.click(await reachPayButton());

    await screen.findByText("Sold out");
    expect(openRazorpayCheckout).not.toHaveBeenCalled();
    expect(useCart.getState().lines).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });
});
