import type { BomAssemblyProjection } from "@/features/bom_creator/types";
import type { PanelConnectivityGraph } from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelAssetScheduleRow,
  PanelBomProjection
} from "../../data/schema";

export function buildPanelBomProjection({
  graph,
  panelAssetId,
  assetSchedule
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  assetSchedule: PanelAssetScheduleRow[];
}): PanelBomProjection {
  const panelTag = graph.assetsById.get(panelAssetId)?.tag ?? panelAssetId;
  const assemblies: BomAssemblyProjection[] = assetSchedule.map((asset) => ({
    assetId: asset.assetId,
    assetTag: asset.assetTag,
    assetType: asset.assetType,
    title: asset.title,
    symbolId: asset.symbolId,
    versionId: asset.versionId,
    sheetRefs: asset.sheetRefs.map((sheet) => ({
      sheetId: sheet.sheetId,
      sheetName: sheet.sheetName,
      sheetNumber: sheet.sheetNumber
    })),
    quantityFacts: {
      cableEndCount: 0,
      conductorTerminationCount: asset.conductorTerminationCount,
      connectionCount: asset.connectionCount
    }
  }));
  const hasLayoutMaterials = graph.source.sheets.some((sheet) =>
    sheet.occurrences.some(
      (occurrence) =>
        occurrence.containerAssetId === panelAssetId &&
        occurrence.occurrenceKind === "layout" &&
        occurrence.role === "other"
    )
  );

  return {
    panelAssetId,
    panelTag,
    assemblies,
    information: hasLayoutMaterials
      ? ["Generated DIN rail and wire duct layout materials are not BOM-linked in Phase 9."]
      : []
  };
}
