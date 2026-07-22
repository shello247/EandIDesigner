import { describe, expect, it } from "vitest";
import type { DrawingPlacement } from "../data/schema";
import { normalizeLayoutHelperDimensionsForSymbol } from "../logic/services/drawing-backplane-layouts";
import { getPlacementBounds } from "../logic/services/drawing-geometry";
import type { ApprovedDrawingSymbol } from "../types";

const physicalSymbols = [
  {
    name: "Phoenix Contact power supply",
    symbolKey: "phoenix_trio3_power_supply",
    viewBox: { x: 0, y: 0, width: 42, height: 143 },
    physicalWidthMm: 30,
    physicalHeightMm: 135
  },
  {
    name: "2085-IF4",
    symbolKey: "allen_bradley_2085_if4",
    viewBox: { x: 0, y: 0, width: 169, height: 511 },
    physicalWidthMm: 28,
    physicalHeightMm: 90
  },
  {
    name: "Terminal Block Single",
    symbolKey: "terminal_block_single",
    viewBox: { x: 0, y: 0, width: 20, height: 178 },
    physicalWidthMm: 5.2,
    physicalHeightMm: 50
  }
] as const;

function createSymbol(
  definition: (typeof physicalSymbols)[number]
): ApprovedDrawingSymbol {
  return {
    symbolId: `symbol_${definition.symbolKey}`,
    symbolKey: definition.symbolKey,
    displayName: definition.name,
    category: "other",
    versionId: `version_${definition.symbolKey}`,
    versionNumber: 1,
    svg: `<svg viewBox="${definition.viewBox.x} ${definition.viewBox.y} ${definition.viewBox.width} ${definition.viewBox.height}"/>`,
    metadata: {
      symbolKey: definition.symbolKey,
      displayName: definition.name,
      category: "other",
      layoutUsage: "panel_layout",
      mountingType: "din_rail",
      panelCategory: "power",
      resizable: false,
      physicalWidthMm: definition.physicalWidthMm,
      physicalHeightMm: definition.physicalHeightMm,
      viewBox: definition.viewBox,
      anchors: [],
      terminals: []
    }
  };
}

function createStalePlacement(symbol: ApprovedDrawingSymbol): DrawingPlacement {
  return {
    id: `placement_${symbol.symbolKey}`,
    assetId: `asset_${symbol.symbolKey}`,
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: "device",
    tag: symbol.symbolKey,
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutDimensions: {
      lengthMm: symbol.metadata.viewBox.width,
      widthMm: symbol.metadata.viewBox.height
    }
  };
}

describe("fixed panel symbol physical dimensions", () => {
  it.each(physicalSymbols)(
    "keeps $name at its physical dimensions independently of preview geometry",
    (definition) => {
      const symbol = createSymbol(definition);
      const placement = normalizeLayoutHelperDimensionsForSymbol(
        createStalePlacement(symbol),
        symbol
      );
      const bounds = getPlacementBounds(placement, symbol.metadata);

      expect(placement.layoutDimensions).toEqual({
        lengthMm: definition.physicalWidthMm,
        widthMm: definition.physicalHeightMm
      });
      expect(bounds.width).toBeCloseTo(definition.physicalWidthMm);
      expect(bounds.height).toBeCloseTo(definition.physicalHeightMm);
    }
  );
});
