import { collectComponentSelectionVersionIds } from "@/features/symbol_components/api/public";
import type { DrawingModel } from "../../data/schema";

export function collectDrawingSymbolVersionIds(model: DrawingModel): string[] {
  return [
    ...new Set([
      ...model.sheets.flatMap((sheet) =>
        sheet.placements.map((placement) => placement.versionId)
      ),
      ...model.assets.flatMap((asset) =>
        collectComponentSelectionVersionIds(asset.componentSelections)
      )
    ])
  ];
}
