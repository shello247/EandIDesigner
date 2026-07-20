import type {
  PanelConnectivityGraph,
  PanelDrawingQualityFinding
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelAssetScheduleRow,
  PanelReportTraceRef
} from "../../data/schema";
import {
  buildPanelReportIndex,
  getPanelReportAssetFindings,
  getPanelReportConductorRelationshipIds,
  type PanelReportIndex
} from "./panel-report-index";
import {
  findingRefs,
  naturalCompare,
  sheetRef,
  uniqueSheetRefs
} from "./panel-report-helpers";

export function buildPanelAssetSchedule({
  graph,
  panelAssetId,
  qualityFindings = [],
  index
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  qualityFindings?: PanelDrawingQualityFinding[];
  index?: PanelReportIndex;
}): PanelAssetScheduleRow[] {
  const panel = graph.assetsById.get(panelAssetId);
  if (!panel) return [];
  const reportIndex = index ?? buildPanelReportIndex({ graph, qualityFindings });
  const associated = new Set([
    panelAssetId,
    ...(graph.assetIdsByPanelAssetId.get(panelAssetId) ?? [])
  ]);

  return [...associated]
    .flatMap((assetId): PanelAssetScheduleRow[] => {
      const asset = graph.assetsById.get(assetId);
      if (!asset || asset.type === "cable") return [];
      const occurrences = graph.occurrencesByAssetId.get(assetId) ?? [];
      const occurrenceRefs = occurrences.map((occurrence) =>
        sheetRef(graph, occurrence.sheetId, occurrence.placementId)
      );
      const contextRefs = assetId === panelAssetId
        ? graph.source.sheets
            .filter((sheet) => sheet.panelDrawingContext?.panelAssetId === panelAssetId)
            .map((sheet) => sheetRef(graph, sheet.id))
        : [];
      const sheetRefs = uniqueSheetRefs([...occurrenceRefs, ...contextRefs]);
      const terminalCount = reportIndex.terminalCountByAssetId.get(assetId) ?? 0;
      const relationshipIds = getPanelReportConductorRelationshipIds(
        reportIndex,
        panelAssetId,
        assetId
      );
      const traces: PanelReportTraceRef[] = [];
      const preferredOccurrence = occurrences.find((occurrence) =>
        graph.sheetsById.get(occurrence.sheetId)?.panelDrawingContext?.panelAssetId === panelAssetId
      ) ?? occurrences[0];
      if (preferredOccurrence) {
        const sheet = graph.sheetsById.get(preferredOccurrence.sheetId);
        if (sheet) {
          traces.push({
            kind: "sheet_object",
            sheet: {
              sheetId: sheet.id,
              sheetNumber: sheet.sheetNumber,
              sheetName: sheet.name,
              objectId: preferredOccurrence.placementId
            },
            objectKind: "placement",
            label: "Open occurrence"
          });
        }
      }
      traces.push({
        kind: "asset_manager",
        assetId,
        label: "Open Asset Manager"
      });

      return [{
        id: `asset-schedule:${panelAssetId}:${assetId}`,
        panelAssetId,
        panelTag: panel.tag,
        assetId,
        assetTag: asset.tag,
        title: asset.title,
        assetType: asset.type,
        symbolId: asset.symbolId,
        versionId: asset.versionId,
        terminalCount,
        occurrenceCount: new Set(occurrences.map((occurrence) => occurrence.placementId)).size,
        conductorTerminationCount: relationshipIds.size,
        connectionCount: relationshipIds.size,
        sheetRefs,
        findings: findingRefs(
          getPanelReportAssetFindings(reportIndex, panelAssetId, assetId),
          () => true
        ),
        traces
      }];
    })
    .sort((first, second) => naturalCompare(first.assetTag, second.assetTag));
}
