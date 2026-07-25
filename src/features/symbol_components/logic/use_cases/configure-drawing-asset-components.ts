import type { DrawingComponentSelection } from "../../data/schema";
import type {
  ComponentSelectableSymbol
} from "../services/component-selection-resolver";
import { validateDrawingComponentSelections } from "../services/component-selection-resolver";
import type { ValidationIssue } from "@/features/symbol_registry/api/public";

export function replaceDrawingAssetComponentSelections<
  TModel extends {
    assets: Array<{
      id: string;
      componentSelections?: DrawingComponentSelection[];
    }>;
  }
>(
  model: TModel,
  assetId: string,
  componentSelections: DrawingComponentSelection[]
): TModel {
  return {
    ...model,
    assets: model.assets.map((asset) =>
      asset.id === assetId
        ? {
            ...asset,
            componentSelections:
              componentSelections.length > 0
                ? componentSelections
                : undefined
          }
        : asset
    )
  };
}

export function validateDrawingAssetComponentConfigurations(params: {
  model: {
    assets: Array<{
      id: string;
      tag: string;
      symbolId?: string;
      versionId?: string;
      componentSelections?: DrawingComponentSelection[];
    }>;
  };
  symbols: ComponentSelectableSymbol[];
}): ValidationIssue[] {
  const exactVersions = new Map(
    params.symbols.map((symbol) => [
      `${symbol.symbolId}:${symbol.versionId}`,
      symbol
    ])
  );

  return params.model.assets.flatMap((asset) => {
    const parent =
      asset.symbolId && asset.versionId
        ? exactVersions.get(`${asset.symbolId}:${asset.versionId}`)
        : undefined;

    if (!parent?.metadata.componentPositions?.length) {
      return [];
    }

    return validateDrawingComponentSelections({
      parent,
      selections: asset.componentSelections ?? [],
      symbols: params.symbols
    }).map((issue) => ({
      ...issue,
      message: `${asset.tag}: ${issue.message}`,
      path: `assets.${asset.id}.${issue.path ?? "componentSelections"}`
    }));
  });
}
