import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HoldToDelete } from "./hold-to-delete";

describe("HoldToDelete component", () => {
  it("renders idle state with label and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete product" itemDescription="Closet piece" />
    );

    expect(html).toContain("Delete product");
    expect(html).toContain('aria-label="Hold for 1 second to delete Closet piece"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Press and hold Space or Enter for 1 second to delete Closet piece.");
  });

  it("renders two-layer clip-path text for high-contrast progress fill", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete photo" forcedState="mid" />
    );

    expect(html).toContain("data-hold-state=\"holding\"");
    expect(html).toContain("data-hold-progress=\"52\"");
    expect(html).toContain("clip-path:inset(0 48% 0 0)");
    expect(html).toContain("Keep holding…");
  });

  it("renders completed state with confirmed feedback", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete
        label="Cancel order"
        completedLabel="Order cancelled"
        forcedState="completed"
        itemDescription="order PE-100"
      />
    );

    expect(html).toContain("data-hold-state=\"completed\"");
    expect(html).toContain("data-hold-progress=\"100\"");
    expect(html).toContain("Order cancelled");
    expect(html).toContain("order PE-100 deleted.");
  });

  it("renders compact mode with smaller height class", () => {
    const html = renderToStaticMarkup(
      <HoldToDelete label="Delete" compact itemDescription="photo" />
    );

    expect(html).toContain("min-h-9");
    expect(html).toContain("text-xs");
  });
});
