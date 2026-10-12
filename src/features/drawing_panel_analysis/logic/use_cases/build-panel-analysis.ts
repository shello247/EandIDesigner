import {
  buildPanelEngineeringSnapshotFromValidatedSource,
  runPackagePanelDrawingQualityChecks
} from "@/features/drawing_panel_wiring/api/public";
import {
  buildPanelAssetSchedule,
  buildPanelBomProjection,
  buildPanelReportIndex,
  buildPanelTerminalSchedule,
  buildPanelWireSchedule
} from "@/features/drawing_panel_reports/api/public";
import { buildDrawingPanelWiringSource } from "@/features/drawing_canvas/logic/services/drawing-panel-wiring-source";
import type {
  ApprovedDrawingSymbol,
  DrawingDetail
} from "@/features/drawing_canvas/types";
import {
  panelAnalysisResultSchema,
  type PanelAnalysisPanelSchedules,
  type PanelAnalysisResult
} from "../../data/schema";
import { createPanelAnalysisRules } from "../services/panel-analysis-rule-set";
import { groupPanelAnalysisFindings } from "../services/panel-analysis-grouping";
import { runPanelAnalysisRules } from "../services/panel-analysis-rules";
import type {ResolvedDrawingProduct} from "@/features/drawing_canvas/api/product-server";
import {calculatePowerBudgets} from "../services/power-budget";
import {buildIoSchedule} from "../services/io-schedule";

export type BuildSavedPanelAnalysisInput = {
  drawing: DrawingDetail;
  symbols: readonly ApprovedDrawingSymbol[];
  generatedAt?: Date;
  products?: readonly ResolvedDrawingProduct[];
};

export type BuildSavedPanelAnalysisDependencies = {
  buildSource: typeof buildDrawingPanelWiringSource;
  buildSnapshot: typeof buildPanelEngineeringSnapshotFromValidatedSource;
  buildReportIndex: typeof buildPanelReportIndex;
};

const defaultDependencies: BuildSavedPanelAnalysisDependencies = {
  buildSource: buildDrawingPanelWiringSource,
  buildSnapshot: buildPanelEngineeringSnapshotFromValidatedSource,
  buildReportIndex: buildPanelReportIndex
};

export function buildSavedPanelAnalysis(
  { drawing, symbols, products = [], generatedAt = new Date() }: BuildSavedPanelAnalysisInput,
  dependencies: BuildSavedPanelAnalysisDependencies = defaultDependencies
): PanelAnalysisResult {
  const source = dependencies.buildSource(drawing.model, [...symbols]);
  const snapshot = dependencies.buildSnapshot(source, drawing.updatedAt);
  const qualityReport = runPackagePanelDrawingQualityChecks(snapshot.graph);
  const powerAnalysis = calculatePowerBudgets(products);
  const context = {
    model: drawing.model,
    source: snapshot.source,
    graph: snapshot.graph,
    symbols,
    qualityReport,
    products,
    powerAnalysis
  };
  const ruleRun = runPanelAnalysisRules({
    context,
    rules: createPanelAnalysisRules(context)
  });
  const qualityFindings = qualityReport.reports.flatMap(
    (report) => report.findings
  );
  const reportIndex = dependencies.buildReportIndex({
    graph: snapshot.graph,
    qualityFindings
  });
  const panels = snapshot.panelAssetIds.flatMap((panelAssetId) => {
    const panel = snapshot.graph.assetsById.get(panelAssetId);
    return panel
      ? [{ assetId: panel.id, tag: panel.tag, title: panel.title }]
      : [];
  });
  const schedules = panels.map(
    (panel): PanelAnalysisPanelSchedules => {
      const panelFindings = qualityReport.reports.find(
        (report) => report.panelAssetId === panel.assetId
      )?.findings;
      const assets = buildPanelAssetSchedule({
        graph: snapshot.graph,
        panelAssetId: panel.assetId,
        qualityFindings: panelFindings,
        index: reportIndex
      });
      return {
        panelAssetId: panel.assetId,
        panelTag: panel.tag,
        terminals: buildPanelTerminalSchedule({
          graph: snapshot.graph,
          panelAssetId: panel.assetId,
          qualityFindings: panelFindings,
          index: reportIndex
        }),
        internalWires: buildPanelWireSchedule({
          graph: snapshot.graph,
          panelAssetId: panel.assetId,
          qualityFindings: panelFindings,
          index: reportIndex
        }),
        assets,
        bomProjection: buildPanelBomProjection({
          graph: snapshot.graph,
          panelAssetId: panel.assetId,
          assetSchedule: assets
        })
      };
    }
  );

  return panelAnalysisResultSchema.parse({
    ...(products.some(p=>p.selection) ? {powerAnalysis,ioSchedule:buildIoSchedule(context)} : {}),
    sourceRevision: {
      drawingId: drawing.id,
      drawingKey: drawing.drawingKey,
      title: drawing.title,
      description: drawing.description,
      status: drawing.status,
      savedAt: drawing.updatedAt,
      project: drawing.project
        ? {
            id: drawing.project.id,
            name: drawing.project.name,
            projectNumber: drawing.project.projectNumber
          }
        : null
    },
    generatedAt: generatedAt.toISOString(),
    coverage: ruleRun.coverage,
    summary: ruleRun.summary,
    panels,
    outcomes: ruleRun.outcomes,
    findingGroups: groupPanelAnalysisFindings(ruleRun.findings),
    findings: ruleRun.findings,
    schedules
  });
}
