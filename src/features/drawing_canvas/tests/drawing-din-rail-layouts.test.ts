import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, type DrawingPlacement } from "../data/schema";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import {
  deriveDinRailRenderGeometry,
  DIN_RAIL_SLOT_HEIGHT_MM,
  DIN_RAIL_SLOT_PITCH_MM,
  DIN_RAIL_SLOT_WIDTH_MM,
  renderDinRailSvg
} from "../logic/services/drawing-din-rail-layouts";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import type { ApprovedDrawingSymbol } from "../types";

const railSymbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_rail",
  symbolKey: "standard_th35_din_rail",
  displayName: "Standard TH35 DIN Rail",
  category: "rail",
  technicalKind: "rail",
  versionId: "version_rail_1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 300 35"><rect data-authored-rail="true" width="300" height="35"/></svg>',
  metadata: {
    symbolKey: "standard_th35_din_rail",
    displayName: "Standard TH35 DIN Rail",
    category: "other",
    layoutUsage: "panel_layout",
    panelCategory: "rail",
    mountingType: "backplate",
    resizable: true,
    physicalWidthMm: 300,
    physicalHeightMm: 35,
    viewBox: { x: 0, y: 0, width: 300, height: 35 },
    anchors: [],
    terminals: []
  }
};

function railPlacement(
  overrides: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "placement_rail",
    symbolId: railSymbol.symbolId,
    versionId: railSymbol.versionId,
    role: "other",
    tag: "DIN Rail",
    x: 40,
    y: 50,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutDimensions: { lengthMm: 300, widthMm: 35 },
    ...overrides
  };
}

describe("DIN rail cut-to-length geometry", () => {
  it("centres seven fixed-size slots in a 300 mm rail", () => {
    const geometry = deriveDinRailRenderGeometry({
      lengthMm: 300,
      widthMm: 35
    });

    expect(geometry.slots).toHaveLength(7);
    expect(geometry.slots[0]).toMatchObject({
      xMm: 6,
      yMm: 13,
      widthMm: DIN_RAIL_SLOT_WIDTH_MM,
      heightMm: DIN_RAIL_SLOT_HEIGHT_MM
    });
    expect(geometry.slots.at(-1)?.xMm).toBe(276);
  });

  it("preserves slot size and pitch when the rail is shortened", () => {
    const geometry = deriveDinRailRenderGeometry({
      lengthMm: 170,
      widthMm: 35
    });

    expect(geometry.slots).toHaveLength(4);
    expect(geometry.slots.map((slot) => slot.widthMm)).toEqual([
      18,
      18,
      18,
      18
    ]);
    expect(
      geometry.slots.slice(1).map((slot, index) =>
        Number((slot.xMm - geometry.slots[index].xMm).toFixed(2))
      )
    ).toEqual([
      DIN_RAIL_SLOT_PITCH_MM,
      DIN_RAIL_SLOT_PITCH_MM,
      DIN_RAIL_SLOT_PITCH_MM
    ]);
    expect(geometry.slots[0].xMm).toBe(8.5);
    expect(170 - (geometry.slots.at(-1)?.xMm ?? 0) - 18).toBe(8.5);
  });

  it("renders short positive rails safely without partial slots", () => {
    const geometry = deriveDinRailRenderGeometry({
      lengthMm: 29.99,
      widthMm: 35
    });
    const svg = renderDinRailSvg({
      placement: railPlacement({
        layoutDimensions: { lengthMm: 29.99, widthMm: 35 }
      }),
      symbol: railSymbol
    });

    expect(geometry.slots).toEqual([]);
    expect(svg).toContain('data-generated-din-rail="true"');
    expect(svg).not.toContain('data-din-rail-slot="true"');
    expect(svg).not.toContain('width="-');
  });

  it("uses a physical viewport so ordinary layout scaling cannot squeeze slots", () => {
    const svg = renderDinRailSvg({
      placement: railPlacement({
        layoutDimensions: { lengthMm: 170, widthMm: 35 }
      }),
      symbol: railSymbol
    });

    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="35"');
    expect(svg).toContain('viewBox="0 0 170 35"');
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg.match(/data-din-rail-slot="true"/g)).toHaveLength(4);
  });
});

describe("DIN rail drawing renderer integration", () => {
  it("uses generated rail geometry while preserving rotation", () => {
    const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
    model.placements = [railPlacement({ rotation: 90 })];

    const svg = renderDrawingToSvg({ model, approvedSymbols: [railSymbol] });

    expect(svg).toContain('data-generated-din-rail="true"');
    expect(svg).not.toContain('data-authored-rail="true"');
    expect(svg).toContain("rotate(90");
  });

  it("keeps non-rail layout-helper artwork on the existing renderer", () => {
    const ordinarySymbol: ApprovedDrawingSymbol = {
      ...railSymbol,
      symbolId: "symbol_layout_helper",
      symbolKey: "ordinary_layout_helper",
      displayName: "Ordinary Layout Helper",
      category: "other",
      technicalKind: "other",
      versionId: "version_layout_helper_1",
      svg: '<svg viewBox="0 0 300 35"><rect data-authored-helper="true" width="300" height="35"/></svg>',
      metadata: {
        ...railSymbol.metadata,
        symbolKey: "ordinary_layout_helper",
        displayName: "Ordinary Layout Helper",
        panelCategory: "other"
      }
    };
    const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
    model.placements = [
      railPlacement({
        symbolId: ordinarySymbol.symbolId,
        versionId: ordinarySymbol.versionId
      })
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [ordinarySymbol]
    });

    expect(svg).toContain('data-authored-helper="true"');
    expect(svg).not.toContain('data-generated-din-rail="true"');
  });
});
