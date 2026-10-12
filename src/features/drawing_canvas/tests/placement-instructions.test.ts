import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlacementInstructions } from "../ui/canvas/PlacementInstructions";

describe("placement instruction panel", () => {
  const props = { label: "Distribution block", tag: "PDB-102", canContinue: true, canRotate: true, onRotate: () => {} };
  it("shows keyboard guidance without repeat preferences, a target selector or a Finish button", () => {
    const html = renderToStaticMarkup(createElement(PlacementInstructions, props));
    expect(html).toContain("PDB-102");
    expect(html).toContain("Ctrl + click");
    expect(html).toContain("Place once");
    expect(html).toContain("Esc");
    expect(html).not.toMatch(/<input|<select|Finish|Place multiple/);
    expect(html).toContain('aria-label="Rotate placement"');
  });
  it("does not advertise multiple placement or rotation for references that cannot use them", () => {
    const html = renderToStaticMarkup(createElement(PlacementInstructions, { ...props, canContinue: false, canRotate: false,
      reason: "This position is outside the backplane." }));
    expect(html).not.toContain("Ctrl + click");
    expect(html).not.toContain("<button");
    expect(html).toContain('role="status"');
    expect(html).toContain("outside the backplane");
  });
});
