import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DrawingSheetToolbar } from "../ui/components/drawing-sheet-toolbar";

const noop = () => {};
const baseProps: ComponentProps<typeof DrawingSheetToolbar> = {
  zoom: 1,
  disabled: false,
  readOnly: false,
  showConnectAction: true,
  connectLabel: "Wire",
  connectActive: false,
  showPatternAction: true,
  patternActive: false,
  guidesVisible: false,
  onOpenSheetLoader: noop,
  onEditActiveSheet: noop,
  onOpenConnections: noop,
  onToggleConnect: noop,
  onTogglePattern: noop,
  onToggleGuidesVisible: noop,
  onFit: noop,
  onActualSize: noop,
  onZoomIn: noop,
  onZoomOut: noop
};

describe("DrawingSheetToolbar", () => {
  it.each([
    { name: "Detailed Panel", connectLabel: "Wire" as const, showPatternAction: true, readOnly: false },
    { name: "ordinary drawing", connectLabel: "Connect" as const, showPatternAction: false, readOnly: false },
    { name: "read-only drawing", connectLabel: "Wire" as const, showPatternAction: false, readOnly: true }
  ])("retains authoring and viewport controls without Panel Review on $name", ({ connectLabel, showPatternAction, readOnly }) => {
    const markup = renderToStaticMarkup(
      createElement(DrawingSheetToolbar, { ...baseProps, connectLabel, showPatternAction, readOnly })
    );

    expect(markup).not.toContain("Panel Review");
    expect(markup).not.toContain("shield-check");
    expect(markup).toContain('aria-label="Open sheet loader"');
    expect(markup).toContain('aria-label="Edit active sheet"');
    expect(markup).toContain('aria-label="Browse connections"');
    expect(markup).toContain(`aria-label="${connectLabel}"`);
    expect(markup).toContain('aria-label="Show drawing guides"');
    expect(markup).toContain('aria-label="Fit drawing"');
    expect(markup).toContain('aria-label="Zoom in"');
    expect(markup).toContain('aria-label="Zoom out"');
    if (showPatternAction) {
      expect(markup).toContain("Pattern");
    } else {
      expect(markup).not.toContain("Pattern");
    }
  });
});
