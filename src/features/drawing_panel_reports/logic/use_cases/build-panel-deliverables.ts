import {
  generateBomFromProjection,
  type SymbolBomTemplateDetail
} from "@/features/bom_creator/api/public";
import { createPanelWiringSource } from "@/features/drawing_canvas/api/panel-wiring-contracts";
import type {
  ApprovedDrawingSymbol,
  DrawingModel
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  buildPackageConnectivityGraph,
  runPackagePanelDrawingQualityChecks,
  type PackagePanelDrawingQualityReport,
  type PanelConnectivityGraph
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelDeliverableBundle,
  PanelDeliverableRequest
} from "../../data/schema";
import { buildPanelDeliverableBundle } from "../services/panel-deliverable-bundle";
import { validatePanelDeliverableRequest } from "../services/panel-deliverable-validation";

type SharedDeliverableInput = {
  drawingId: string;
  drawingKey?: string;
  drawingTitle: string;
  drawingStatus: "draft" | "needs_review" | "approved" | "archived";
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
  request: PanelDeliverableRequest;
  enforceIssuance?: boolean;
};

export function buildPanelDeliverablesFromGraph({
  graph,
  quality,
  ...input
}: SharedDeliverableInput & {
  graph: PanelConnectivityGraph;
  quality: PackagePanelDrawingQualityReport;
}): PanelDeliverableBundle {
  const availablePanelIds = new Set(
    graph.source.sheets.flatMap((sheet) =>
      sheet.panelDrawingContext ? [sheet.panelDrawingContext.panelAssetId] : []
    )
  );
  const parsedRequest = input.enforceIssuance
    ? validatePanelDeliverableRequest({
        request: input.request,
        drawingStatus: input.drawingStatus,
        quality,
        availablePanelIds
      })
    : input.request;
  const base = buildPanelDeliverableBundle({
    drawingId: input.drawingId,
    drawingKey: input.drawingKey,
    drawingTitle: input.drawingTitle,
    drawingStatus: input.drawingStatus,
    issueMode: parsedRequest.issueMode,
    reports: parsedRequest.reports,
    scope: parsedRequest.scope,
    graph,
    quality
  });
  const bomByPanelAssetId = new Map(
    base.panels.map((panel) => [
      panel.panelAssetId,
      generateBomFromProjection({
        drawingId: input.drawingId,
        drawingTitle: `${input.drawingTitle} - ${panel.panelTag}`,
        assemblies: panel.bomProjection.assemblies,
        symbols: input.symbols,
        templates: input.templates
      })
    ])
  );
  return buildPanelDeliverableBundle({
    drawingId: input.drawingId,
    drawingKey: input.drawingKey,
    drawingTitle: input.drawingTitle,
    drawingStatus: input.drawingStatus,
    issueMode: parsedRequest.issueMode,
    reports: parsedRequest.reports,
    scope: parsedRequest.scope,
    graph,
    quality,
    bomByPanelAssetId
  });
}

export function buildPanelDeliverables({
  drawingId,
  drawingKey,
  drawingTitle,
  drawingStatus,
  model,
  symbols,
  templates,
  request,
  enforceIssuance = false
}: {
  drawingId: string;
  drawingKey?: string;
  drawingTitle: string;
  drawingStatus: "draft" | "needs_review" | "approved" | "archived";
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  templates: SymbolBomTemplateDetail[];
  request: PanelDeliverableRequest;
  enforceIssuance?: boolean;
}): PanelDeliverableBundle {
  const graph = buildPackageConnectivityGraph(createPanelWiringSource(model, symbols));
  const quality = runPackagePanelDrawingQualityChecks(graph);
  return buildPanelDeliverablesFromGraph({
    drawingId,
    drawingKey,
    drawingTitle,
    drawingStatus,
    graph,
    quality,
    symbols,
    templates,
    request,
    enforceIssuance
  });
}
