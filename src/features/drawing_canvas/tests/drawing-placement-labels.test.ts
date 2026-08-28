import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../data/schema";
import {
  getPlacementLabelPoints,
  getPlacementTitlePoint
} from "../logic/services/placement-title-labels";
import type { ApprovedDrawingSymbol } from "../types";

const sheet: DrawingSheetCanvasModel["sheet"] = {
  size: "A3_LANDSCAPE",
  width: 420,
  height: 297,
  gridSize: 10,
  titleBlock: {
    revision: "A",
    date: "2026-08-01"
  }
};

const metadata: SymbolMetadata = {
  symbolKey: "placement_label_fixture",
  displayName: "Placement Label Fixture",
  category: "instrument",
  viewBox: { x: 10, y: 20, width: 100, height: 80 },
  anchors: [],
  terminals: []
};

const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_placement_label_fixture",
  symbolKey: metadata.symbolKey,
  displayName: metadata.displayName,
  category: "instrument",
  versionId: "version_placement_label_fixture",
  versionNumber: 1,
  svg: '<svg viewBox="10 20 100 80" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="100" height="80"/></svg>',
  metadata
};

function placement(
  changes: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "placement_1",
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: "device",
    tag: "PLC-101",
    title: "Controller",
    x: 20,
    y: 30,
    rotation: 0,
    scale: 0.5,
    ...changes
  };
}

describe("placement label clearance", () => {
  it("places the complete default label block above an unrotated symbol", () => {
    const points = getPlacementLabelPoints({
      placement: placement(),
      symbol,
      sheet
    });

    expect(points).toEqual({
      tagPoint: { x: 20, y: 22.3 },
      titlePoint: { x: 20, y: 27.5 }
    });
    expect(points.titlePoint.y).toBeLessThan(30);
  });

  it("uses physical layout dimensions when deriving label clearance", () => {
    const points = getPlacementLabelPoints({
      placement: placement({
        x: 40,
        y: 110,
        scale: 1,
        layoutDimensions: { lengthMm: 28, widthMm: 90 }
      }),
      symbol,
      sheet
    });

    expect(points).toEqual({
      tagPoint: { x: 40, y: 102.3 },
      titlePoint: { x: 40, y: 107.5 }
    });
  });

  it("uses the rotated artwork boundary for portrait and landscape symbols", () => {
    const points = getPlacementLabelPoints({
      placement: placement({ x: 100, y: 100, rotation: 90, scale: 0.6 }),
      symbol,
      sheet
    });

    // The unrotated 60 x 48 mm body becomes a 48 x 60 mm rendered boundary
    // centred on the same point, whose upper-left corner is (106, 94).
    expect(points).toEqual({
      tagPoint: { x: 106, y: 86.3 },
      titlePoint: { x: 106, y: 91.5 }
    });
  });

  it("moves the label block below artwork that is too close to the top edge", () => {
    const points = getPlacementLabelPoints({
      placement: placement({ y: 1 }),
      symbol,
      sheet
    });

    expect(points).toEqual({
      tagPoint: { x: 20, y: 47.5 },
      titlePoint: { x: 20, y: 52.7 }
    });
    expect(points.tagPoint.y - 4).toBe(43.5);
  });

  it("clamps an edge-constrained label block inside the sheet", () => {
    const constrainedSheet = { ...sheet, height: 60 };
    const points = getPlacementLabelPoints({
      placement: placement({ y: 10, scale: 0.6 }),
      symbol,
      sheet: constrainedSheet
    });

    expect(points.tagPoint.y - 4).toBeGreaterThanOrEqual(0);
    expect(points.titlePoint.y + 3.1 * 0.25).toBeLessThanOrEqual(
      constrainedSheet.height
    );
  });

  it("preserves a saved label position exactly", () => {
    const customPlacement = placement({
      labelPosition: { x: 55.123, y: 66.789 }
    });
    const points = getPlacementLabelPoints({
      placement: customPlacement,
      symbol,
      sheet
    });

    expect(points.titlePoint).toBe(customPlacement.labelPosition);
    expect(points).toEqual({
      tagPoint: { x: 55.123, y: 61.59 },
      titlePoint: { x: 55.123, y: 66.789 }
    });
  });

  it("preserves a legacy device title position exactly", () => {
    const legacyPlacement = placement({
      deviceTitlePosition: { x: 88.456, y: 77.321 }
    });

    expect(
      getPlacementTitlePoint({
        placement: legacyPlacement,
        symbol,
        sheet
      })
    ).toBe(legacyPlacement.deviceTitlePosition);
  });
});
