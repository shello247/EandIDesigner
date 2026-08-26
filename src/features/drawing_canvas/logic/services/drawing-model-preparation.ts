import type { PanelWiringSourcePackage } from "@/features/drawing_panel_wiring/api/contracts";
import { reconcileDerivedInternalWireIds } from "@/features/drawing_panel_wiring/api/public";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { reconcileDrawingAssets } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";

export type PreparedDrawingModel = {
  model: DrawingModel;
  panelWiringSource: PanelWiringSourcePackage;
};

export type DrawingModelPreparationCache = {
  prepare: (model: DrawingModel) => PreparedDrawingModel;
};

/**
 * React Server Action responses can re-serialize an unchanged symbol bundle.
 * Use the engineering fields consumed by model preparation to keep the
 * editor-scoped cache stable across that referential churn while still
 * invalidating it when a render dependency actually changes.
 */
export function createDrawingModelPreparationSymbolKey(
  symbols: ApprovedDrawingSymbol[]
): string {
  return symbols
    .map((symbol) =>
      JSON.stringify({
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        symbolKey: symbol.symbolKey,
        displayName: symbol.displayName,
        category: symbol.category,
        technicalKind: symbol.technicalKind,
        managedCategory: symbol.managedCategory,
        metadata: symbol.metadata
      })
    )
    .sort()
    .join("\u001e");
}

export function createDrawingModelPreparationCache({
  symbols,
  createSource = (model) => createPanelWiringSource(model, symbols)
}: {
  symbols: ApprovedDrawingSymbol[];
  createSource?: (model: DrawingModel) => PanelWiringSourcePackage;
}): DrawingModelPreparationCache {
  const preparedByModel = new WeakMap<DrawingModel, PreparedDrawingModel>();

  return {
    prepare(model) {
      const existing = preparedByModel.get(model);
      if (existing) return existing;

      const reconciled = reconcileDrawingAssets(
        {
          ...model,
          measurementUnit: model.measurementUnit ?? "mm"
        },
        symbols
      );
      const reconciledSource = createSource(reconciled);
      const mutations = reconcileDerivedInternalWireIds(reconciledSource);
      const finalModel = mutations.length
        ? applyPanelWiringMutations(reconciled, mutations)
        : reconciled;
      const result = {
        model: finalModel,
        panelWiringSource: mutations.length
          ? createSource(finalModel)
          : reconciledSource
      };

      preparedByModel.set(model, result);
      preparedByModel.set(finalModel, result);
      return result;
    }
  };
}
