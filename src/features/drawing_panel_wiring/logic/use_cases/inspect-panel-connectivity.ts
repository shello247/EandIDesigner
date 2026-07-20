import type { PanelWiringSourcePackage } from "../../data/schema";
import type { PanelConnectivitySnapshot } from "../../types";
import {
  buildPackageConnectivityGraph,
  getPanelConnectivitySnapshot
} from "../services/connectivity-graph";

export function inspectPanelConnectivity(
  source: PanelWiringSourcePackage,
  panelAssetId?: string
): PanelConnectivitySnapshot {
  return getPanelConnectivitySnapshot(
    buildPackageConnectivityGraph(source),
    panelAssetId
  );
}
