import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Receipt, type ReceiptData } from "./receipt";

describe("Receipt component", () => {
  const sampleData: ReceiptData = {
    orderNumber: "PE-261111-8K92F1",
    placedAt: "2026-11-11T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        title: "Raw Silk Kurta Set",
        size: "M",
        quantity: 1,
        catalog: "THE_POOJA_EDIT",
        unitPricePaise: 1450000,
        totalPaise: 1450000,
      },
      {
        id: "item-2",
        title: "Vintage Handwoven Dupatta",
        size: null,
        quantity: 1,
        catalog: "THRIFT",
        unitPricePaise: 380000,
        totalPaise: 380000,
      },
    ],
    subtotalPaise: 1830000,
    discountPaise: 100000,
    discountCode: "FESTIVE1000",
    shippingPaise: 0,
    taxPaise: 219600,
    totalPaise: 1949600,
    paymentMethod: "PREPAID_RAZORPAY",
    paymentStatus: "PAID",
    customerName: "Aarti Sharma",
    city: "Bengaluru",
  };

  it("renders order header, order number, and customer city", () => {
    const html = renderToStaticMarkup(<Receipt data={sampleData} animationState="final" />);

    expect(html).toContain("The Pooja Edit");
    expect(html).toContain("thepoojaedit.in");
    expect(html).toContain("PE-261111-8K92F1");
    expect(html).toContain("Aarti Sharma (Bengaluru)");
  });

  it("renders line items with quantities, sizes, and catalog tags", () => {
    const html = renderToStaticMarkup(<Receipt data={sampleData} animationState="final" />);

    expect(html).toContain("Raw Silk Kurta Set");
    expect(html).toContain("The Label · M");
    expect(html).toContain("Vintage Handwoven Dupatta");
    expect(html).toContain("The Closet");
  });

  it("renders accurate pricing calculations with Indian rupee formatting", () => {
    const html = renderToStaticMarkup(<Receipt data={sampleData} animationState="final" />);

    // Subtotal: ₹18,300
    expect(html).toContain("₹18,300");
    // Discount: -₹1,000 (FESTIVE1000)
    expect(html).toContain("-₹1,000");
    expect(html).toContain("Discount (FESTIVE1000)");
    // Shipping: Free
    expect(html).toContain("Free");
    // Total: ₹19,496
    expect(html).toContain("₹19,496");
  });

  it("includes accessible markup, role, and screenshot cues", () => {
    const html = renderToStaticMarkup(<Receipt data={sampleData} animationState="final" />);

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Official receipt for order PE-261111-8K92F1"');
    expect(html).toContain("Keep or screenshot this receipt for your records.");
    expect(html).toContain("Payment Received");
  });

  it("renders serrated physical tear-off bottom edge", () => {
    const html = renderToStaticMarkup(<Receipt data={sampleData} animationState="final" />);

    expect(html).toContain("<svg");
    expect(html).toContain("M0,0");
  });
});
