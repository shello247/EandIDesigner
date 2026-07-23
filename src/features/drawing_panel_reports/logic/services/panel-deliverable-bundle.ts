import type { GeneratedDrawingBom } from "@/features/bom_creator/types";
import type {
  PackagePanelDrawingQualityReport,
  PanelConnectivityGraph
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelDeliverableBundle,
  PanelDeliverableIssueMode,
  PanelReportKind,
  PanelReportScope
} from "../../data/schema";
import { buildPanelAssetSchedule } from "./panel-asset-schedule";
import { buildPanelBomProjection } from "./panel-bom-projection";
import { buildPanelReportIndex } from "./panel-report-index";
import { buildPanelTerminalSchedule } from "./panel-terminal-schedule";
import { buildPanelWireSchedule } from "./panel-wire-schedule";

type DrawingStatus = "draft" | "needs_review" | "approved" | "archived";

function panelIdsForScope(graph: PanelConnectivityGraph, scope: PanelReportScope) {
  if (scope.kind === "active_panel") return [scope.panelAssetId];
  const firstSheetByPanel = new Map<string, number>();
  graph.source.sheets.forEach((sheet) => {
    const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
    if (!panelAssetId) return;
    firstSheetByPanel.set(
      panelAssetId,
      Math.min(firstSheetByPanel.get(panelAssetId) ?? Number.MAX_SAFE_INTEGER, sheet.sheetNumber)
    );
  });
  return [...firstSheetByPanel.entries()]
    .sort((first, second) => first[1] - second[1])
    .map(([panelAssetId]) => panelAssetId);
}

function qualityForScope(
  quality: PackagePanelDrawingQualityReport,
  panelIds: string[]
) {
  const reports = quality.reports.filter((report) => panelIds.includes(report.panelAssetId));
  return reports.reduce(
    (counts, report) => ({
      blockingErrors: counts.blockingErrors + report.counts.blockingErrors,
      warnings: counts.warnings + report.counts.warnings,
      information: counts.information + report.counts.information
    }),
    { blockingErrors: 0, warnings: 0, information: 0 }
  );
}

export function buildPanelDeliverableBundle({
  drawingId,
  drawingKey,
  drawingTitle,
  drawingStatus,
  issueMode,
  reports,
  scope,
  graph,
  quality,
  bomByPanelAssetId
}: {
  drawingId: string;
  drawingKey?: string;
  drawingTitle: string;
  drawingStatus: DrawingStatus;
  issueMode: PanelDeliverableIssueMode;
  reports: PanelReportKind[];
  scope: PanelReportScope;
  graph: PanelConnectivityGraph;
  quality: PackagePanelDrawingQualityReport;
  bomByPanelAssetId?: ReadonlyMap<string, GeneratedDrawingBom>;
}): PanelDeliverableBundle {
  const panelIds = panelIdsForScope(graph, scope);
  const qcCounts = qualityForScope(quality, panelIds);
  const reportIndex = buildPanelReportIndex({
    graph,
    qualityFindings: quality.reports.flatMap((report) => report.findings)
  });
  const panels = panelIds.flatMap((panelAssetId) => {
    const qualityReport = quality.reports.find((report) => report.panelAssetId === panelAssetId);
    if (!graph.assetsById.has(panelAssetId)) return [];
    const findings = qualityReport?.findings ?? [];
    const assetSchedule = buildPanelAssetSchedule({
      graph,
      panelAssetId,
      qualityFindings: findings,
      index: reportIndex
    });
    return [{
      panelAssetId,
      panelTag: graph.assetsById.get(panelAssetId)?.tag ?? panelAssetId,
      terminalSchedule: buildPanelTerminalSchedule({
        graph,
        panelAssetId,
        qualityFindings: findings,
        index: reportIndex
      }),
      wireSchedule: buildPanelWireSchedule({
        graph,
        panelAssetId,
        qualityFindings: findings,
        index: reportIndex
      }),
      assetSchedule,
      bomProjection: buildPanelBomProjection({ graph, panelAssetId, assetSchedule }),
      bom: bomByPanelAssetId?.get(panelAssetId)
    }];
  });
  const information = panels.flatMap((panel) => panel.bomProjection.information);

  return {
    manifest: {
      drawingId,
      drawingKey,
      drawingTitle,
      drawingStatus,
      issueMode,
      scope,
      reports: [...new Set(reports)],
      qcCounts,
      canIssue:
        drawingStatus === "approved" && quality.counts.blockingErrors === 0,
      information: [...new Set(information)]
    },
    panels
  };
}
