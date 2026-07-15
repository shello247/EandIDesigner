import type {
  ApprovedDrawingSymbol,
  DrawingAssetRecord,
  DrawingConnection,
  DrawingModel,
  DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  isNonAssetDrawingPlacement,
  placementAssetId
} from "@/features/drawing_canvas/api/asset-contracts";
import type {
  BomAssemblyProjection,
  SymbolBomTemplateDetail
} from "../../data/schema";
import { generateBomFromProjection } from "./generate-bom-from-projection";

export type GenerateDrawingBomInput = {
  drawingId: string;
  drawingTitle: string;
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
};

type SheetRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
};

type AssetContext = {
  asset: DrawingAssetRecord;
  placements: DrawingPlacement[];
  rawPlacementCount: number;
  sheetRefs: SheetRef[];
};

function fallbackAssetType(placement: DrawingPlacement): DrawingAssetRecord["type"] {
  if (placement.role === "cable_assembly") return "cable";
  if (placement.role === "terminal_block") return "terminal_block";
  if (placement.role === "enclosure") {
    return placement.enclosure?.kind === "junction_box" ? "junction_box" : "panel";
  }
  return "other";
}

function fallbackAssetFromPlacement(placement: DrawingPlacement): DrawingAssetRecord {
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

function buildAssetContexts(model: DrawingModel): AssetContext[] {
  const nonAssetPlacementIds = new Set(
    model.sheets.flatMap((sheet) =>
      sheet.placements
        .filter(isNonAssetDrawingPlacement)
        .map(placementAssetId)
    )
  );
  const assets = new Map(
    (model.assets ?? [])
      .filter((asset) => !nonAssetPlacementIds.has(asset.id))
      .map((asset) => [asset.id, asset])
  );
  const placements = new Map<string, DrawingPlacement[]>();
  const rawCounts = new Map<string, number>();
  const sheetRefs = new Map<string, Map<string, SheetRef>>();

  model.sheets.forEach((sheet, sheetIndex) => {
    for (const placement of sheet.placements) {
      if (isNonAssetDrawingPlacement(placement)) continue;
      const assetId = placementAssetId(placement);
      rawCounts.set(assetId, (rawCounts.get(assetId) ?? 0) + 1);
      if (placement.layoutKind) continue;
      if (!assets.has(assetId)) assets.set(assetId, fallbackAssetFromPlacement(placement));
      placements.set(assetId, [...(placements.get(assetId) ?? []), placement]);
      const refs = sheetRefs.get(assetId) ?? new Map<string, SheetRef>();
      refs.set(sheet.id, {
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1
      });
      sheetRefs.set(assetId, refs);
    }
  });

  return [...assets.values()]
    .map((asset) => ({
      asset,
      placements: placements.get(asset.id) ?? [],
      rawPlacementCount: rawCounts.get(asset.id) ?? 0,
      sheetRefs: [...(sheetRefs.get(asset.id)?.values() ?? [])]
    }))
    .filter((context) => context.placements.length > 0 || context.rawPlacementCount === 0)
    .sort((first, second) =>
      first.asset.tag.localeCompare(second.asset.tag, undefined, { numeric: true })
    );
}

function connectionCount(
  connections: DrawingConnection[],
  placements: DrawingPlacement[]
): number {
  const placementIds = new Set(placements.map((placement) => placement.id));
  return new Set(
    connections
      .filter(
        (connection) =>
          placementIds.has(connection.from.placementId) ||
          placementIds.has(connection.to.placementId) ||
          Boolean(
            connection.cablePlacementId && placementIds.has(connection.cablePlacementId)
          )
      )
      .map((connection) => connection.id)
  ).size;
}

export function generateDrawingBom({
  drawingId,
  drawingTitle,
  model,
  symbols,
  templates
}: GenerateDrawingBomInput) {
  const connections = model.sheets.flatMap((sheet) => sheet.connections);
  const assemblies: BomAssemblyProjection[] = buildAssetContexts(model).map((context) => {
    const count = connectionCount(connections, context.placements);
    return {
      assetId: context.asset.id,
      assetTag: context.asset.tag,
      assetType: context.asset.type,
      title: context.asset.title,
      symbolId: context.asset.symbolId,
      versionId: context.asset.versionId,
      sheetRefs: context.sheetRefs,
      quantityFacts: {
        cableEndCount: 2,
        conductorTerminationCount: count,
        connectionCount: count
      }
    };
  });

  return generateBomFromProjection({
    drawingId,
    drawingTitle,
    assemblies,
    symbols,
    templates
  });
}
