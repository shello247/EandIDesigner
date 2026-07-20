import type {
  DrawingAssetRecord,
  DrawingModel,
  DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import { placementAssetId } from "@/features/drawing_canvas/api/asset-contracts";

export type BomGenerationSheetRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
};

export type BomGenerationAssetContext = {
  asset: DrawingAssetRecord;
  placements: DrawingPlacement[];
  rawPlacementCount: number;
  sheetRefs: BomGenerationSheetRef[];
  connectionCount: number;
};

function fallbackAssetType(
  placement: DrawingPlacement
): DrawingAssetRecord["type"] {
  if (placement.role === "cable_assembly") {
    return "cable";
  }

  if (placement.role === "terminal_block") {
    return "terminal_block";
  }

  if (placement.role === "enclosure") {
    return placement.enclosure?.kind === "junction_box"
      ? "junction_box"
      : "panel";
  }

  return "other";
}

function fallbackAssetFromPlacement(
  placement: DrawingPlacement
): DrawingAssetRecord {
  return {
    id: placementAssetId(placement),
    tag: placement.tag,
    type: fallbackAssetType(placement),
    title:
      placement.title?.trim() ||
      placement.enclosure?.title?.trim() ||
      placement.terminalBlock?.kind?.replace(/_/g, " ") ||
      placement.tag,
    symbolId: placement.symbolId,
    versionId: placement.versionId
  };
}

export function buildBomGenerationContexts(
  model: DrawingModel
): BomGenerationAssetContext[] {
  const assets = new Map<string, DrawingAssetRecord>();
  const placements = new Map<string, DrawingPlacement[]>();
  const placementAssetIds = new Map<string, string>();
  const rawPlacementCounts = new Map<string, number>();
  const sheetRefs = new Map<
    string,
    Map<string, BomGenerationSheetRef>
  >();

  for (const asset of model.assets ?? []) {
    assets.set(asset.id, asset);
  }

  model.sheets.forEach((sheet, sheetIndex) => {
    for (const placement of sheet.placements) {
      const assetId = placementAssetId(placement);
      rawPlacementCounts.set(assetId, (rawPlacementCounts.get(assetId) ?? 0) + 1);

      if (placement.layoutKind) {
        continue;
      }

      if (!assets.has(assetId)) {
        assets.set(assetId, fallbackAssetFromPlacement(placement));
      }

      const assetPlacements = placements.get(assetId) ?? [];
      assetPlacements.push(placement);
      placements.set(assetId, assetPlacements);
      placementAssetIds.set(placement.id, assetId);

      const refs = sheetRefs.get(assetId) ?? new Map();
      refs.set(sheet.id, {
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1
      });
      sheetRefs.set(assetId, refs);
    }
  });

  const connectionIdsByAsset = new Map<string, Set<string>>();

  for (const sheet of model.sheets) {
    for (const connection of sheet.connections) {
      const touchedAssetIds = new Set<string>();
      const placementIds = [
        connection.from.placementId,
        connection.to.placementId,
        connection.cablePlacementId
      ];

      for (const placementId of placementIds) {
        if (!placementId) {
          continue;
        }

        const assetId = placementAssetIds.get(placementId);

        if (assetId) {
          touchedAssetIds.add(assetId);
        }
      }

      for (const assetId of touchedAssetIds) {
        const connectionIds = connectionIdsByAsset.get(assetId) ?? new Set();
        connectionIds.add(connection.id);
        connectionIdsByAsset.set(assetId, connectionIds);
      }
    }
  }

  return [...assets.values()]
    .map((asset) => ({
      asset,
      placements: placements.get(asset.id) ?? [],
      rawPlacementCount: rawPlacementCounts.get(asset.id) ?? 0,
      sheetRefs: [...(sheetRefs.get(asset.id)?.values() ?? [])],
      connectionCount: connectionIdsByAsset.get(asset.id)?.size ?? 0
    }))
    .filter(
      (context) =>
        context.placements.length > 0 || context.rawPlacementCount === 0
    )
    .sort((first, second) =>
      first.asset.tag.localeCompare(second.asset.tag, undefined, {
        numeric: true
      })
    );
}
