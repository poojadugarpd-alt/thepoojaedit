import { describe, expect, it } from "vitest";

import { renderTemplate, TemplateVariableError, templateVersion } from "./templates";

const orderVars = {
  orderNumber: "PE-260907-ABC123",
  orderUrl: "https://poojaedit.example/order/PE-260907-ABC123",
  totalPaise: 129900,
  itemCount: 2,
};

describe("template rendering", () => {
  it("prepaid confirmation renders subject + html + text", () => {
    const r = renderTemplate("order_confirmation_prepaid", "EMAIL", orderVars) as {
      subject: string;
      html: string;
      text: string;
    };
    expect(r.subject).toContain("PE-260907-ABC123");
    expect(r.html).toContain("1,299");
    expect(r.text.toLowerCase()).toContain("payment received");
  });

  it("COD confirmation never says 'paid' or 'payment successful'", () => {
    for (const channel of ["EMAIL", "WHATSAPP"] as const) {
      const r = renderTemplate("order_confirmation_cod", channel, orderVars) as unknown as Record<
        string,
        string
      >;
      const blob = JSON.stringify(r).toLowerCase();
      expect(blob).not.toContain("payment successful");
      expect(blob).not.toMatch(/\bpaid\b/);
      expect(blob).toContain("cash on delivery");
    }
  });

  it("distinct copy per lifecycle event", () => {
    const shipped = renderTemplate("shipment_dispatched", "EMAIL", {
      orderNumber: "X",
      awb: "AWB1",
      courier: "Shadowfax",
      trackingUrl: null,
    }) as { subject: string };
    const delivered = renderTemplate("order_delivered", "EMAIL", {
      orderNumber: "X",
    }) as { subject: string };
    const cancelled = renderTemplate("order_cancelled", "EMAIL", {
      orderNumber: "X",
      reason: "stock issue",
    }) as { subject: string };
    expect(new Set([shipped.subject, delivered.subject, cancelled.subject]).size).toBe(3);
  });

  it("rejects missing / wrong-typed variables", () => {
    expect(() =>
      renderTemplate("order_confirmation_prepaid", "EMAIL", { orderNumber: "X" }),
    ).toThrow(TemplateVariableError);
    expect(() =>
      renderTemplate("refund_completed", "EMAIL", { orderNumber: "X", amountPaise: -1 }),
    ).toThrow(TemplateVariableError);
  });

  it("rejects an unsupported channel for a template", () => {
    expect(() =>
      renderTemplate("admin_new_order", "EMAIL", {
        orderNumber: "X",
        paymentMethod: "COD",
        totalPaise: 1,
      }),
    ).toThrow(TemplateVariableError);
  });

  it("in-app admin template produces title + message + priority", () => {
    const r = renderTemplate("admin_new_order", "IN_APP", {
      orderNumber: "PE-1",
      paymentMethod: "PREPAID_RAZORPAY",
      totalPaise: 50000,
    }) as { title: string; message: string; priority: number };
    expect(r.title).toContain("PE-1");
    expect(r.priority).toBeGreaterThan(0);
  });

  it("every template is version 1 for now", () => {
    expect(templateVersion("order_confirmation_cod")).toBe(1);
  });
});
