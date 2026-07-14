import type {
  PanelDrawingQualityReport,
  PanelWiringSourcePackage,
  PackagePanelDrawingQualityReport
} from "../../data/schema";
import { buildPackageConnectivityGraph } from "../services/connectivity-graph";
import {
  runPackagePanelDrawingQualityChecks,
  runPanelDrawingQualityChecks
} from "../services/panel-quality-checks";
import { buildPanelQualityIndex } from "../services/panel-quality-index";

export function reviewPanelDrawing(
  source: PanelWiringSourcePackage,
  panelAssetId: string
): PanelDrawingQualityReport {
  const graph = buildPackageConnectivityGraph(source);
  return runPanelDrawingQualityChecks(
    buildPanelQualityIndex({ graph, panelAssetId })
  );
}

export function reviewPackagePanelDrawings(
  source: PanelWiringSourcePackage
): PackagePanelDrawingQualityReport {
  return runPackagePanelDrawingQualityChecks(
    buildPackageConnectivityGraph(source)
  );
}
