import { describe, expect, it } from "vitest";
import type { DrawingPlacement } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import {
  getLayoutLabelPoint,
  isDinRailSymbol,
  resolveLayoutLabel
} from "../logic/services/drawing-layout-labels";
import {
  createGeneratedWireTrayLibrarySymbol,
  GENERATED_WIRE_TRAY_SYMBOL_ID,
  GENERATED_WIRE_TRAY_VERSION_ID
} from "../logic/services/drawing-wire-tray-layouts";

function createSymbol(
  overrides: Partial<ApprovedDrawingSymbol> = {}
): ApprovedDrawingSymbol {
  return {
    symbolId: "symbol_1",
    symbolKey: "test_symbol",
    displayName: "Test Symbol",
    category: "other",
    versionId: "version_1",
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 20"></svg>',
    metadata: {
      symbolKey: "test_symbol",
      displayName: "Test Symbol",
      category: "other",
      viewBox: { x: 0, y: 0, width: 100, height: 20 },
      anchors: [],
      terminals: []
    },
    ...overrides
  };
}

function createPlacement(
  overrides: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "placement_1",
    symbolId: "symbol_1",
    versionId: "version_1",
    role: "other",
    tag: "TEST-1",
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutParentId: "backplane_1",
    ...overrides
  };
}

describe("isDinRailSymbol", () => {
  it("recognizes a registered rail by its panel category", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(isDinRailSymbol(symbol)).toBe(true);
  });

  it("does not treat equipment mounted on DIN rail as rail material", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        mountingType: "din_rail"
      }
    });

    expect(isDinRailSymbol(symbol)).toBe(false);
  });

  it("retains legacy name and key recognition", () => {
    expect(
      isDinRailSymbol(
        createSymbol({
          symbolKey: "standard_th35_din_rail",
          displayName: "Standard TH35 DIN Rail"
        })
      )
    ).toBe(true);
  });
});

describe("resolveLayoutLabel", () => {
  it("hides DIN rail labels by default", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(
      resolveLayoutLabel({
        placement: createPlacement({ assetId: "asset_rail_1" }),
        symbol
      }).visible
    ).toBe(false);
  });

  it("hides generated wire tray labels by default", () => {
    expect(
      resolveLayoutLabel({
        placement: createPlacement({
          symbolId: GENERATED_WIRE_TRAY_SYMBOL_ID,
          versionId: GENERATED_WIRE_TRAY_VERSION_ID
        }),
        symbol: createGeneratedWireTrayLibrarySymbol()
      }).visible
    ).toBe(false);
  });

  it("keeps ordinary asset labels visible by default", () => {
    expect(
      resolveLayoutLabel({
        placement: createPlacement({ assetId: "asset_equipment_1" }),
        symbol: createSymbol()
      }).visible
    ).toBe(true);
  });

  it("honors an explicit label visibility override", () => {
    const symbol = createSymbol({
      metadata: {
        ...createSymbol().metadata,
        panelCategory: "rail"
      }
    });

    expect(
      resolveLayoutLabel({
        placement: createPlacement({
          layoutLabel: { visible: true, position: "top-right" }
        }),
        symbol
      }).visible
    ).toBe(true);
  });
});

describe("getLayoutLabelPoint", () => {
  it("derives the automatic top-center point from rendered layout bounds", () => {
    expect(
      getLayoutLabelPoint({
        placement: createPlacement({
          x: 20,
          y: 30,
          layoutDimensions: { lengthMm: 40, widthMm: 15 }
        }),
        position: "top-center"
      })
    ).toEqual({ x: 40, y: 28.65, textAnchor: "middle" });
  });

  it("uses a saved manual label position without changing the placement", () => {
    expect(
      getLayoutLabelPoint({
        placement: createPlacement({
          x: 20,
          y: 30,
          layoutDimensions: { lengthMm: 40, widthMm: 15 },
          labelPosition: { x: 72.25, y: 41.5 }
        }),
        position: "bottom-right"
      })
    ).toEqual({ x: 72.25, y: 41.5, textAnchor: "middle" });
  });
});
