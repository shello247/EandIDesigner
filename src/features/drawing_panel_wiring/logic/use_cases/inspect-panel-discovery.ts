import type {
  PanelConnectivityGraph,
  PanelDiscoverySnapshot
} from "../../types";
import { buildPanelDiscoveryIndex } from "../services/panel-discovery-index";

export function inspectPanelDiscovery(
  graph: PanelConnectivityGraph,
  input: { panelAssetId: string; detailedSheetId: string }
): PanelDiscoverySnapshot {
  const index = buildPanelDiscoveryIndex({ graph, ...input });

  return {
    panelAssetId: index.panelAssetId,
    detailedSheetId: index.detailedSheetId,
    assets: [...index.assetsById.values()],
    terminations: [...index.terminationsById.values()],
    warnings: index.warnings
  };
}
