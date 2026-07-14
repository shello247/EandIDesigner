import type {
  PanelConnectivityGraph,
  PanelQualityIndex,
  PanelQualityRouteRef
} from "../../types";
import {
  buildPanelTerminalCatalog,
  buildPanelTerminalCatalogIndex,
  type PanelTerminalCatalogBuildIndex
} from "./panel-terminal-catalog";

export type PanelQualitySharedIndex = {
  detailedSheetsByPanelAssetId: ReadonlyMap<
    string,
    PanelConnectivityGraph["source"]["sheets"]
  >;
  internalWireRoutesByRecordId: ReadonlyMap<string, PanelQualityRouteRef[]>;
  patternRoutesByRecordId: ReadonlyMap<string, PanelQualityRouteRef[]>;
  terminalCatalogIndex: PanelTerminalCatalogBuildIndex;
};

function appendRoute(
  index: Map<string, PanelQualityRouteRef[]>,
  id: string,
  route: PanelQualityRouteRef
): void {
  index.set(id, [...(index.get(id) ?? []), route]);
}

export function buildPanelQualitySharedIndex(
  graph: PanelConnectivityGraph
): PanelQualitySharedIndex {
  const detailedSheetsByPanelAssetId = new Map<
    string,
    PanelConnectivityGraph["source"]["sheets"]
  >();
  const internalWireRoutesByRecordId = new Map<
    string,
    PanelQualityRouteRef[]
  >();
  const patternRoutesByRecordId = new Map<string, PanelQualityRouteRef[]>();

  for (const sheet of graph.source.sheets) {
    const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
    if (panelAssetId) {
      detailedSheetsByPanelAssetId.set(panelAssetId, [
        ...(detailedSheetsByPanelAssetId.get(panelAssetId) ?? []),
        sheet
      ]);
    }
    for (const connection of sheet.connections) {
      const route = {
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        connection
      } satisfies PanelQualityRouteRef;
      if (connection.panelConnectionId) {
        appendRoute(
          internalWireRoutesByRecordId,
          connection.panelConnectionId,
          route
        );
      }
      if (connection.panelPatternId) {
        appendRoute(patternRoutesByRecordId, connection.panelPatternId, route);
      }
    }
  }
  for (const sheets of detailedSheetsByPanelAssetId.values()) {
    sheets.sort(
      (first, second) =>
        first.sheetNumber - second.sheetNumber || first.id.localeCompare(second.id)
    );
  }
  for (const routes of [
    ...internalWireRoutesByRecordId.values(),
    ...patternRoutesByRecordId.values()
  ]) {
    routes.sort(
      (first, second) =>
        first.sheetNumber - second.sheetNumber ||
        first.connection.id.localeCompare(second.connection.id)
    );
  }
  return {
    detailedSheetsByPanelAssetId,
    internalWireRoutesByRecordId,
    patternRoutesByRecordId,
    terminalCatalogIndex: buildPanelTerminalCatalogIndex(graph)
  };
}

export function buildPanelQualityIndex({
  graph,
  panelAssetId,
  sharedIndex = buildPanelQualitySharedIndex(graph)
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  sharedIndex?: PanelQualitySharedIndex;
}): PanelQualityIndex {
  const panel = graph.assetsById.get(panelAssetId);
  const associatedAssetIds =
    graph.assetIdsByPanelAssetId.get(panelAssetId) ?? new Set<string>();
  const detailedSheets = [
    ...(sharedIndex.detailedSheetsByPanelAssetId.get(panelAssetId) ?? [])
  ];

  return {
    graph,
    panelAssetId,
    panelTag: panel?.tag ?? panelAssetId,
    associatedAssetIds,
    detailedSheets,
    terminalCatalog: buildPanelTerminalCatalog({
      graph,
      panelAssetId,
      index: sharedIndex.terminalCatalogIndex
    }),
    internalWireRoutesByRecordId: sharedIndex.internalWireRoutesByRecordId,
    patternRoutesByRecordId: sharedIndex.patternRoutesByRecordId
  };
}
