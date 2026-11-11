import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HoldToDelete } from "./hold-to-delete";

describe("HoldToDelete component", () => {
  it("renders idle state with label and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete product" itemDescription="Closet piece" />,
    );

    expect(html).toContain("Delete product");
    expect(html).toContain('aria-label="Hold for 1 second to delete Closet piece"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(
      "Press and hold Space or Enter for 1 second to delete Closet piece.",
    );
  });

  it("renders two-layer clip-path text for high-contrast progress fill", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete photo" forcedState="mid" />,
    );

    expect(html).toContain('data-hold-state="holding"');
    expect(html).toContain('data-hold-progress="52"');
    expect(html).toContain("clip-path:inset(0 48% 0 0)");
    expect(html).toContain("Keep holding…");
  });

  it("renders completed state with confirmed feedback for delete actions", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete
        label="Delete product"
        completedLabel="Deleted"
        forcedState="completed"
        itemDescription="Closet piece"
        actionVerb="delete"
      />,
    );

    expect(html).toContain('data-hold-state="completed"');
    expect(html).toContain('data-hold-progress="100"');
    expect(html).toContain("Deleted");
    expect(html).toContain("Closet piece deleted.");
  });

  it("renders accessibility labels and live region using cancel verb for order cancellation", () => {
    const htmlIdle = renderToStaticMarkup(
      <HoldToDelete
        label="Hold to cancel order"
        itemDescription="order PE-100"
        actionVerb="cancel"
      />,
    );
    expect(htmlIdle).toContain('aria-label="Hold for 1 second to cancel order PE-100"');
    expect(htmlIdle).toContain(
      "Press and hold Space or Enter for 1 second to cancel order PE-100.",
    );

    const htmlHolding = renderToStaticMarkup(
      <HoldToDelete
        label="Hold to cancel order"
        itemDescription="order PE-100"
        actionVerb="cancel"
        forcedState="mid"
      />,
    );
    expect(htmlHolding).toContain("Holding to cancel… keep holding for 1 second.");

    const htmlCompleted = renderToStaticMarkup(
      <HoldToDelete
        label="Hold to cancel order"
        completedLabel="Order cancelled"
        forcedState="completed"
        itemDescription="order PE-100"
        actionVerb="cancel"
      />,
    );
    expect(htmlCompleted).toContain("Order cancelled");
    expect(htmlCompleted).toContain("order PE-100 cancelled.");

    const htmlCancelled = renderToStaticMarkup(
      <HoldToDelete
        label="Hold to cancel order"
        forcedState="cancelled"
        itemDescription="order PE-100"
        actionVerb="cancel"
      />,
    );
    expect(htmlCancelled).toContain("Cancel action cancelled.");
  });

  it("renders compact mode with smaller height class", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete" compact itemDescription="photo" />,
    );

    expect(html).toContain("min-h-9");
    expect(html).toContain("text-xs");
  });
});
