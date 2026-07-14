import type {
  PanelDiscoveryBuildContext,
  PanelDiscoveryIndex,
  PanelConnectivityGraph
} from "../../types";
import { buildPanelAssociatedAssetCatalog } from "./panel-associated-asset-catalog";
import { buildExternalTerminationCatalog } from "./external-termination-catalog";
import { buildExternalTerminationMappingRows } from "./external-termination-mapping";
import { detectPanelDiscoveryWarnings } from "./panel-discovery-warnings";
import { buildPanelTerminalCatalog } from "./panel-terminal-catalog";

function representedPlacementIndex(
  graph: PanelConnectivityGraph,
  detailedSheetId: string
): ReadonlyMap<string, string> {
  const represented = new Map<string, string>();
  const sheet = graph.sheetsById.get(detailedSheetId);

  sheet?.occurrences
    .filter((occurrence) => Boolean(occurrence.assetId))
    .sort((first, second) => first.placementId.localeCompare(second.placementId))
    .forEach((occurrence) => {
      if (occurrence.assetId && !represented.has(occurrence.assetId)) {
        represented.set(occurrence.assetId, occurrence.placementId);
      }
    });

  return represented;
}

export function buildPanelDiscoveryIndex({
  graph,
  panelAssetId,
  detailedSheetId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  detailedSheetId: string;
}): PanelDiscoveryIndex {
  const representedPlacementIdsByAssetId = representedPlacementIndex(
    graph,
    detailedSheetId
  );
  const context: PanelDiscoveryBuildContext = {
    graph,
    panelAssetId,
    detailedSheetId,
    representedPlacementIdsByAssetId
  };
  const assets = buildPanelAssociatedAssetCatalog(context);
  const terminations = buildExternalTerminationCatalog(context, assets);
  const terminalCatalog = buildPanelTerminalCatalog({ graph, panelAssetId });
  const mappingRows = buildExternalTerminationMappingRows({
    graph,
    panelAssetId,
    terminations,
    terminalCatalog
  });
  const warnings = detectPanelDiscoveryWarnings(
    context,
    assets,
    terminations
  );

  return {
    panelAssetId,
    detailedSheetId,
    assetsById: new Map(assets.map((asset) => [asset.assetId, asset])),
    terminationsById: new Map(
      terminations.map((termination) => [
        termination.terminationId,
        termination
      ])
    ),
    terminalCatalog,
    mappingRowsByTerminationId: new Map(
      mappingRows.map((row) => [row.terminationId, row])
    ),
    representedPlacementIdByAssetId: representedPlacementIdsByAssetId,
    warnings
  };
}
