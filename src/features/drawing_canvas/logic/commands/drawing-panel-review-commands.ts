import {
  getPanelFindingNavigationTarget,
  runPanelDrawingQualityChecks,
  buildPanelQualityIndex,
  buildPackageConnectivityGraph,
  type PanelDrawingQualityFinding,
  type PanelFindingNavigationTarget
} from "@/features/drawing_panel_wiring/api/public";
import { drawingPackageModelSchema, type DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";

export type DrawingPanelRepairResult = {
  model: DrawingModel;
  modelChanged: boolean;
  resolvedFindingId: string;
  affectedIds: string[];
  warnings: string[];
};

export function navigateToPanelFinding(
  finding: PanelDrawingQualityFinding
): PanelFindingNavigationTarget | undefined {
  return getPanelFindingNavigationTarget(finding);
}

function currentFinding(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  findingId: string,
  panelAssetId: string
): PanelDrawingQualityFinding | undefined {
  const graph = buildPackageConnectivityGraph(
    createPanelWiringSource(model, symbols)
  );
  const report = runPanelDrawingQualityChecks(
    buildPanelQualityIndex({ graph, panelAssetId })
  );
  return report.findings.find((finding) => finding.id === findingId);
}

export function applyApprovedPanelRepair({
  model,
  symbols,
  finding
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  finding: PanelDrawingQualityFinding;
}): DrawingPanelRepairResult {
  const current = currentFinding(
    model,
    symbols,
    finding.id,
    finding.panelAssetId
  );
  if (!current?.repair || current.repair.kind !== finding.repair?.kind) {
    throw new Error(
      "This repair is stale because the drawing has changed. Run Panel Review again."
    );
  }
  const parameters = current.repair.parameters;
  let nextModel = model;
  const affectedIds: string[] = [];

  if (
    current.repair.kind === "remove_orphan_route" ||
    current.repair.kind === "remove_duplicate_route"
  ) {
    const { sheetId, connectionId } = parameters;
    const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
    if (!sheet?.connections.some((connection) => connection.id === connectionId)) {
      throw new Error("The route selected for repair no longer exists.");
    }
    nextModel = {
      ...model,
      sheets: model.sheets.map((candidate) =>
        candidate.id === sheetId
          ? {
              ...candidate,
              connections: candidate.connections.filter(
                (connection) => connection.id !== connectionId
              )
            }
          : candidate
      )
    };
    affectedIds.push(sheetId, connectionId);
  } else if (
    current.repair.kind === "remove_stale_mapping" ||
    current.repair.kind === "remove_redundant_mapping"
  ) {
    const mappingId = parameters.mappingId;
    if (!model.panelWiring?.terminalMappings.some((item) => item.id === mappingId)) {
      throw new Error("The terminal mapping selected for repair no longer exists.");
    }
    nextModel = applyPanelWiringMutations(model, {
      kind: "remove-terminal-mapping",
      mappingId
    });
    affectedIds.push(mappingId);
  } else if (
    current.repair.kind === "remove_unreferenced_duplicate_occurrence"
  ) {
    const { sheetId, placementId, assetId } = parameters;
    const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
    const placement = sheet?.placements.find(
      (candidate) => candidate.id === placementId
    );
    if (!sheet || !placement || placement.assetId !== assetId) {
      throw new Error("The duplicate occurrence selected for repair no longer exists.");
    }
    if (
      sheet.connections.some(
        (connection) =>
          connection.from.placementId === placementId ||
          connection.to.placementId === placementId
      )
    ) {
      throw new Error(
        "The duplicate occurrence is now connected and must be reviewed manually."
      );
    }
    nextModel = {
      ...model,
      sheets: model.sheets.map((candidate) =>
        candidate.id === sheetId
          ? {
              ...candidate,
              placements: candidate.placements.filter(
                (item) => item.id !== placementId
              )
            }
          : candidate
      )
    };
    affectedIds.push(sheetId, placementId, assetId);
  }

  return {
    model: drawingPackageModelSchema.parse(nextModel),
    modelChanged: nextModel !== model,
    resolvedFindingId: finding.id,
    affectedIds,
    warnings: []
  };
}
