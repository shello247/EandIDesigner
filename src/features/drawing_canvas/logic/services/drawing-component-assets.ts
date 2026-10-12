import { createStablePlacementAssetId, type DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

/** Recover legacy component-bearing equipment before layout-helper filtering.
 * Existing identities, geometry and selections are retained. Missing selections
 * deliberately remain missing: registry alternatives are not project choices.
 */
export function normalizeComponentDrawingAssets(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const componentSymbols = new Set(
    symbols.filter((symbol) => symbol.metadata.componentPositions?.length)
      .map((symbol) => `${symbol.symbolId}::${symbol.versionId}`)
  );
  let changed = false;
  const sheets = model.sheets.map((sheet) => {
    let sheetChanged = false;
    const placements = sheet.placements.map((placement) => {
      if (
        placement.layoutKind !== "layout_helper" || placement.role !== "other" ||
        placement.panelReference || placement.panelPatternLegend ||
        !componentSymbols.has(`${placement.symbolId}::${placement.versionId}`)
      ) return placement;
      changed = sheetChanged = true;
      return {
        ...placement,
        assetId: placement.assetId?.trim() || createStablePlacementAssetId(placement.id),
        role: "device" as const
      };
    });
    return sheetChanged ? { ...sheet, placements } : sheet;
  });
  return changed ? { ...model, sheets } : model;
}
