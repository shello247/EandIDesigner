import {
  getEffectiveInternalWireId,
  type PanelConnectionDisplayMode,
  type PanelConnectivityGraph,
  type PanelWiringSourceOccurrence,
  type PanelWiringSourceSheet
} from "@/features/drawing_panel_wiring/api/public";
import type { ConnectedWireScheduleAnnotation } from "../../data/schema";
import type {
  AssetConnectedWireRow,
  ConnectedWireEndpoint,
  ConnectedWireScheduleIndex,
  ConnectedWireScheduleProjection
} from "../../types";
import { paginateConnectedWireScheduleRows } from "./connected-wire-schedule-pagination";

function sheetPlacementKey(sheetId: string, placementId: string): string {
  return `${sheetId}:${placementId}`;
}

function assetTag(graph: PanelConnectivityGraph, assetId: string): string {
  return (
    graph.assetsById.get(assetId)?.tag ??
    graph.occurrencesByAssetId.get(assetId)?.[0]?.tag ??
    assetId
  );
}

function occurrenceForEndpoint(
  graph: PanelConnectivityGraph,
  sheetId: string,
  placementId: string
): PanelWiringSourceOccurrence | undefined {
  return graph.occurrencesBySheetPlacement.get(
    sheetPlacementKey(sheetId, placementId)
  );
}

function terminalKeyForAnchor(
  occurrence: PanelWiringSourceOccurrence | undefined,
  anchorKey: string
): string | undefined {
  if (!occurrence || occurrence.terminalResolutionStatus !== "resolved") {
    return undefined;
  }
  const matches = occurrence.terminals.filter(
    (terminal) =>
      terminal.status === "resolved" &&
      terminal.anchors.some((anchor) => anchor.anchorKey === anchorKey)
  );
  return matches.length === 1 ? matches[0].terminalKey : undefined;
}

function sourceSheetsForInternalWire(
  graph: PanelConnectivityGraph,
  wireId: string
): Array<{ id: string; number: number; name: string }> {
  return [...graph.sheetsById.values()]
    .filter((sheet) =>
      sheet.connections.some(
        (connection) => connection.panelConnectionId === wireId
      )
    )
    .sort((first, second) => first.sheetNumber - second.sheetNumber)
    .map((sheet) => ({
      id: sheet.id,
      number: sheet.sheetNumber,
      name: sheet.name
    }));
}

function fieldConnectionTouchesSource(input: {
  sheet: PanelWiringSourceSheet;
  sourceSheetId: string;
  sourcePlacementId: string;
  connection: PanelWiringSourceSheet["connections"][number];
}): boolean {
  return (
    input.sheet.id === input.sourceSheetId &&
    [input.connection.from, input.connection.to].some(
      (endpoint) => endpoint.placementId === input.sourcePlacementId
    )
  );
}

function internalWireTouchesSource(input: {
  graph: PanelConnectivityGraph;
  sourceSheetId: string;
  sourcePlacementId: string;
  wireId: string;
}): boolean {
  const sheet = input.graph.sheetsById.get(input.sourceSheetId);
  return Boolean(
    sheet?.connections.some(
      (connection) =>
        connection.panelConnectionId === input.wireId &&
        [connection.from, connection.to].some(
          (endpoint) => endpoint.placementId === input.sourcePlacementId
        )
    )
  );
}

function compareRows(
  first: AssetConnectedWireRow,
  second: AssetConnectedWireRow
): number {
  const firstNumber = first.wireNumber ?? Number.MAX_SAFE_INTEGER;
  const secondNumber = second.wireNumber ?? Number.MAX_SAFE_INTEGER;
  return (
    firstNumber - secondNumber ||
    first.wireId.localeCompare(second.wireId, undefined, { numeric: true }) ||
    first.canonicalId.localeCompare(second.canonicalId)
  );
}

function endpoint(
  graph: PanelConnectivityGraph,
  occurrence: PanelWiringSourceOccurrence,
  assetId: string,
  terminalKey: string
): ConnectedWireEndpoint {
  return endpointForAsset(graph, assetId, terminalKey, occurrence);
}

function endpointForAsset(
  graph: PanelConnectivityGraph,
  assetId: string,
  terminalKey: string,
  preferredOccurrence?: PanelWiringSourceOccurrence
): ConnectedWireEndpoint {
  const asset = graph.assetsById.get(assetId);
  const occurrence =
    preferredOccurrence ??
    graph.occurrencesByAssetId
      .get(assetId)
      ?.find(
        (candidate) =>
          candidate.terminalResolutionStatus === "resolved" &&
          candidate.terminals.some(
            (terminal) =>
              terminal.status === "resolved" &&
              terminal.terminalKey === terminalKey
          )
      );
  const terminal = occurrence?.terminals.find(
    (candidate) =>
      candidate.status === "resolved" && candidate.terminalKey === terminalKey
  );

  return {
    assetTag: preferredOccurrence?.tag ?? assetTag(graph, assetId),
    ...(asset?.title ? { assetTitle: asset.title } : {}),
    terminalKey,
    ...(terminal?.label ? { terminalLabel: terminal.label } : {}),
    ...(terminal?.function ? { terminalFunction: terminal.function } : {})
  };
}

export function buildConnectedWireScheduleProjection(input: {
  graph: PanelConnectivityGraph;
  sheetId: string;
  annotation: ConnectedWireScheduleAnnotation;
  displayMode?: PanelConnectionDisplayMode;
}): ConnectedWireScheduleProjection {
  const { graph, annotation } = input;
  const { assetId, sourcePlacementId, scope } = annotation.schedule;
  const sourceOccurrence = graph.occurrencesBySheetPlacement.get(
    sheetPlacementKey(input.sheetId, sourcePlacementId)
  );
  const linkedOccurrenceAvailable = sourceOccurrence?.assetId === assetId;
  const rows: AssetConnectedWireRow[] = [];
  let unresolvedCount = 0;
  const routeScope = input.displayMode
    ? input.displayMode === "sheet_only"
      ? "sheet_routes"
      : "all_connected"
    : scope;
  const includeFieldConnections =
    input.displayMode !== "internal_connected";
  const includeInternalWires =
    input.displayMode !== "external_connected";
  const projectedFieldConnectionIds = new Set<string>();

  if (includeFieldConnections) {
    const linkedSheet = graph.sheetsById.get(input.sheetId);
    const panelAssetId = linkedSheet?.panelDrawingContext?.panelAssetId;
    if (
      routeScope === "all_connected" &&
      panelAssetId &&
      sourceOccurrence
    ) {
      for (const terminationId of
        graph.externalTerminationIdsByPanelAssetId.get(panelAssetId) ?? []) {
        const termination = graph.externalTerminationsById.get(terminationId);
        if (
          termination?.status !== "resolved" ||
          termination.target?.assetId !== assetId
        ) {
          continue;
        }
        const sourceSheet = graph.sheetsById.get(termination.source.sheetId);
        const connection = graph.connectionsBySheetConnection.get(
          `${termination.source.sheetId}:${termination.source.connectionId}`
        );
        const mappedRole = termination.source.endpointRole;
        const oppositeRole = mappedRole === "from" ? "to" : "from";
        const oppositeConnectionEndpoint = connection?.[oppositeRole];
        const oppositeOccurrence = oppositeConnectionEndpoint
          ? occurrenceForEndpoint(
              graph,
              termination.source.sheetId,
              oppositeConnectionEndpoint.placementId
            )
          : undefined;
        const oppositeTerminal = oppositeConnectionEndpoint
          ? terminalKeyForAnchor(
              oppositeOccurrence,
              oppositeConnectionEndpoint.anchorKey
            )
          : undefined;
        if (!sourceSheet || !connection || !oppositeOccurrence?.assetId) {
          unresolvedCount += 1;
          continue;
        }
        const canonicalId = `${sourceSheet.id}:${connection.id}`;
        if (projectedFieldConnectionIds.has(canonicalId)) continue;
        projectedFieldConnectionIds.add(canonicalId);
        const mappedEndpoint = endpointForAsset(
          graph,
          assetId,
          termination.target.terminalKey,
          sourceOccurrence
        );
        const oppositeEndpoint = endpoint(
          graph,
          oppositeOccurrence,
          oppositeOccurrence.assetId,
          oppositeTerminal ?? oppositeConnectionEndpoint!.anchorKey
        );
        const fieldSpecification = [
          termination.cableTag,
          termination.conductorKey
        ]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(" / ");
        rows.push({
          canonicalKind: "field_connection",
          canonicalId,
          wireId:
            termination.wireId?.trim() || fieldSpecification || "FIELD",
          from: mappedRole === "from" ? mappedEndpoint : oppositeEndpoint,
          to: mappedRole === "to" ? mappedEndpoint : oppositeEndpoint,
          specification: fieldSpecification
            ? { name: fieldSpecification }
            : undefined,
          description: connection.label?.trim() || undefined,
          sourceSheets: [
            {
              id: sourceSheet.id,
              number: sourceSheet.sheetNumber,
              name: sourceSheet.name
            }
          ]
        });
      }
    }

    for (const sheet of [...graph.sheetsById.values()].sort(
      (first, second) => first.sheetNumber - second.sheetNumber
    )) {
      for (const connection of sheet.connections) {
        if (connection.panelConnectionId || connection.panelPatternId) continue;
        const canonicalId = `${sheet.id}:${connection.id}`;
        if (projectedFieldConnectionIds.has(canonicalId)) continue;
        const fromOccurrence = occurrenceForEndpoint(
          graph,
          sheet.id,
          connection.from.placementId
        );
        const toOccurrence = occurrenceForEndpoint(
          graph,
          sheet.id,
          connection.to.placementId
        );
        if (
          fromOccurrence?.assetId !== assetId &&
          toOccurrence?.assetId !== assetId
        ) {
          continue;
        }
        if (
          routeScope === "sheet_routes" &&
          !fieldConnectionTouchesSource({
            sheet,
            sourceSheetId: input.sheetId,
            sourcePlacementId,
            connection
          })
        ) {
          continue;
        }
        const fromTerminal = terminalKeyForAnchor(
          fromOccurrence,
          connection.from.anchorKey
        );
        const toTerminal = terminalKeyForAnchor(
          toOccurrence,
          connection.to.anchorKey
        );
        if (!fromOccurrence?.assetId || !toOccurrence?.assetId) {
          unresolvedCount += 1;
          continue;
        }
        const fallbackWireId =
          connection.wireId?.trim() ||
          [connection.cableTag, connection.conductorKey]
            .filter((value): value is string => Boolean(value?.trim()))
            .join("/") ||
          "FIELD";
        const fieldSpecification = [
          connection.cableTag,
          connection.conductorKey
        ]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(" / ");
        projectedFieldConnectionIds.add(canonicalId);
        rows.push({
          canonicalKind: "field_connection",
          canonicalId,
          wireId: fallbackWireId,
          from: endpoint(
            graph,
            fromOccurrence,
            fromOccurrence.assetId,
            fromTerminal ?? connection.from.anchorKey
          ),
          to: endpoint(
            graph,
            toOccurrence,
            toOccurrence.assetId,
            toTerminal ?? connection.to.anchorKey
          ),
          specification: fieldSpecification
            ? { name: fieldSpecification }
            : undefined,
          description: connection.label?.trim() || undefined,
          sourceSheets: [
            { id: sheet.id, number: sheet.sheetNumber, name: sheet.name }
          ]
        });
      }
    }
  }

  if (includeInternalWires) {
    for (const wire of graph.internalWiresById.values()) {
      if (wire.from.assetId !== assetId && wire.to.assetId !== assetId) continue;
      if (
        routeScope === "sheet_routes" &&
        !internalWireTouchesSource({
          graph,
          sourceSheetId: input.sheetId,
          sourcePlacementId,
          wireId: wire.id
        })
      ) {
        continue;
      }
      rows.push({
        canonicalKind: "internal_wire",
        canonicalId: wire.id,
        wireNumber: wire.wireNumber,
        wireId: getEffectiveInternalWireId(graph.source, wire),
        from: endpointForAsset(
          graph,
          wire.from.assetId,
          wire.from.terminalKey
        ),
        to: endpointForAsset(graph, wire.to.assetId, wire.to.terminalKey),
        specification: wire.specification
          ? {
              name: wire.specification.catalogEntryName,
              wireType: wire.specification.wireType,
              size: wire.specification.size,
              color: wire.specification.color
            }
          : wire.attributes
            ? {
                wireType: wire.attributes.wireType,
                size: wire.attributes.size,
                color: wire.attributes.color
              }
            : undefined,
        description: wire.attributes?.description,
        sourceSheets: sourceSheetsForInternalWire(graph, wire.id)
      });
    }
  }

  rows.sort(compareRows);
  const page = paginateConnectedWireScheduleRows(
    rows,
    annotation.schedule.pagination
  );
  return {
    annotationId: annotation.id,
    allRows: rows,
    ...page,
    unresolvedCount,
    linkedOccurrenceAvailable
  };
}

export function buildConnectedWireScheduleIndex(input: {
  graph: PanelConnectivityGraph;
  schedulesBySheetId: ReadonlyMap<
    string,
    ConnectedWireScheduleAnnotation[]
  >;
  displayModesBySheetPlacement?: ReadonlyMap<
    string,
    PanelConnectionDisplayMode
  >;
}): ConnectedWireScheduleIndex {
  const index = new Map<string, ConnectedWireScheduleProjection>();
  for (const [sheetId, annotations] of input.schedulesBySheetId) {
    for (const annotation of annotations) {
      index.set(
        annotation.id,
        buildConnectedWireScheduleProjection({
          graph: input.graph,
          sheetId,
          annotation,
          displayMode: input.displayModesBySheetPlacement?.get(
            sheetPlacementKey(sheetId, annotation.schedule.sourcePlacementId)
          )
        })
      );
    }
  }
  return index;
}
