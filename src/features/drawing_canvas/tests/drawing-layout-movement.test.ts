import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, type DrawingPlacement } from "../data/schema";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import { resolveLayoutHelperDisplayPlacement } from "../logic/services/drawing-backplane-scale";
import { getRotatedPlacementBounds } from "../logic/services/drawing-geometry";
import { moveCanvasSelection } from "../logic/services/drawing-movement";
import { createGeneratedWireTrayLibrarySymbol } from "../logic/services/drawing-wire-tray-layouts";

const symbol = createGeneratedWireTrayLibrarySymbol();

function fixture(overrides: Partial<DrawingPlacement> = {}) {
  const drawing = createDefaultDrawingModel();
  const panel = createPanelEnclosurePlacement({
    model: drawing, activeSheet: drawing.sheets[0], assetId: "panel-asset",
    tag: "PDP-101", x: 95, y: 15, width: 914.4, height: 914.4
  });
  const backplane = createBackplanePlacement({ panelPlacement: panel });
  backplane.layoutDimensions = { lengthMm: 868.68, widthMm: 868.68 };
  const tray: DrawingPlacement = {
    id: "tray", symbolId: symbol.symbolId, versionId: symbol.versionId,
    tag: "Duct", role: "other", x: 0, y: 100, rotation: 90, scale: 1,
    layoutKind: "layout_helper", layoutParentId: backplane.id,
    layoutDimensions: { lengthMm: 800, widthMm: 40 },
    layoutPosition: { xMm: -300, yMm: 420 }, ...overrides
  };
  const model = {
    sheet: { ...drawing.sheets[0].page, titleBlock: drawing.titleBlock },
    placements: [panel, backplane, tray], connections: [], annotations: []
  };
  const bounds = (placement: DrawingPlacement) => getRotatedPlacementBounds(
    resolveLayoutHelperDisplayPlacement({ sheet: model.sheet, placement, backplane, parentPanel: panel }),
    symbol.metadata
  );
  const move = (x: number, y: number) => moveCanvasSelection({
    model, symbols: [symbol], selection: { placementIds: [tray.id], annotationIds: [] }, delta: { x, y }
  });
  return { model, tray, bounds, move };
}

describe("physical layout movement uses rendered sheet coordinates", () => {
  it("moves a rotated duct left even when its legacy origin is zero", () => {
    const { tray, bounds, move } = fixture();
    const before = bounds(tray);
    const after = bounds(move(-10, 0).placements[2]);
    expect(after.x).toBeCloseTo(before.x - 10, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
  });

  it("moves equipment with a legacy origin beyond the paper without jumping", () => {
    const { tray, bounds, move } = fixture({ x: 600, rotation: 0,
      layoutDimensions: { lengthMm: 28.6, widthMm: 58.1 },
      layoutPosition: { xMm: 500, yMm: 100 } });
    const before = bounds(tray);
    const after = bounds(move(15, 5).placements[2]);
    expect(after.x).toBeCloseTo(before.x + 15, 2);
    expect(after.y).toBeCloseTo(before.y + 5, 2);
  });

  it("still keeps a rotated physical body inside the paper boundary", () => {
    const { bounds, move } = fixture();
    expect(bounds(move(-1000, 0).placements[2]).x).toBeCloseTo(0, 2);
  });

  it("preserves origin constraints for ordinary drawing symbols", () => {
    const { move } = fixture({ layoutKind: undefined, layoutParentId: undefined,
      layoutPosition: undefined, x: 5, y: 20 });
    expect(move(-10, 0).placements[2].x).toBe(0);
  });
});
