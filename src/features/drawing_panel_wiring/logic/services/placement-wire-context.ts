import type {
  PanelInternalWireRecord,
  PanelTerminalSide,
  PanelWiringSourceConnection,
  PanelWiringSourceOccurrence,
  PanelWiringSourceSheet
} from "../../data/schema";
import type {
  PanelConnectivityGraph,
  PanelExternalTerminationDisplayRow,
  PlacementWireContextDisplayIndex,
  PlacementWireContextDisplayRow,
  PlacementWireContextRequest,
  PlacementWireContextSummary
} from "../../types";
import { buildPanelExternalTerminationDisplayIndex } from "./external-termination-display";
import { getEffectiveInternalWireId } from "./internal-wire-identity";

type ResolvedOccurrenceTerminal = {
  terminalKey: string;
  side: PanelTerminalSide;
};

type FieldEndpointCandidate = {
  sheet: PanelWiringSourceSheet;
  connection: PanelWiringSourceConnection;
  endpointRole: "from" | "to";
  occurrence: PanelWiringSourceOccurrence;
};

type InternalEndpointCandidate = {
  wire: PanelInternalWireRecord;
  endpointRole: "from" | "to";
};

function appendMapValue<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) {
    values.push(value);
  } else {
    map.set(key, [value]);
  }
}

function sheetPlacementKey(sheetId: string, placementId: string): string {
  return `${sheetId}:${placementId}`;
}

function compareRows(
  first: PlacementWireContextDisplayRow,
  second: PlacementWireContextDisplayRow
): number {
  return (
    first.placementId.localeCompare(second.placementId) ||
    first.anchorKey.localeCompare(second.anchorKey, undefined, { numeric: true }) ||
    first.wireId.localeCompare(second.wireId, undefined, { numeric: true }) ||
    first.canonicalId.localeCompare(second.canonicalId)
  );
}

function occurrenceForEndpoint(
  sheet: PanelWiringSourceSheet,
  placementId: string
): PanelWiringSourceOccurrence | undefined {
  return sheet.occurrences.find(
    (occurrence) => occurrence.placementId === placementId
  );
}

function resolveOccurrenceTerminal(
  occurrence: PanelWiringSourceOccurrence,
  anchorKey: string
): ResolvedOccurrenceTerminal | undefined {
  const matches = occurrence.terminals.flatMap((terminal) =>
    terminal.anchors
      .filter((anchor) => anchor.anchorKey === anchorKey)
      .map((anchor) => ({ terminal, anchor }))
  );

  if (matches.length !== 1 || matches[0].terminal.status !== "resolved") {
    return undefined;
  }

  const { terminal, anchor } = matches[0];
  const side =
    anchor.sideHint ??
    (terminal.supportedSides.length === 1
      ? terminal.supportedSides[0]
      : undefined);

  return side ? { terminalKey: terminal.terminalKey, side } : undefined;
}

function resolveTargetAnchor(
  occurrence: PanelWiringSourceOccurrence,
  terminalRef: ResolvedOccurrenceTerminal
):
  | { anchorKey: string; physicalPosition?: "top" | "right" | "bottom" | "left" }
  | undefined {
  const terminal = occurrence.terminals.find(
    (candidate) =>
      candidate.terminalKey === terminalRef.terminalKey &&
      candidate.status === "resolved"
  );

  if (!terminal) {
    return undefined;
  }

  const exact = terminal.anchors.filter(
    (anchor) => anchor.sideHint === terminalRef.side
  );
  const anchor =
    exact.length === 1
      ? exact[0]
      : exact.length === 0 &&
          terminal.supportedSides.length === 1 &&
          terminal.supportedSides[0] === terminalRef.side &&
          terminal.anchors.length === 1
        ? terminal.anchors[0]
        : undefined;

  return anchor
    ? {
        anchorKey: anchor.anchorKey,
        physicalPosition: anchor.physicalPosition
      }
    : undefined;
}

function fallbackFieldWireId(connection: PanelWiringSourceConnection): string {
  const cableReference = [connection.cableTag, connection.conductorKey].filter(
    (value): value is string => Boolean(value?.trim())
  );
  return connection.wireId?.trim() || cableReference.join("/") || "FIELD";
}

function oppositeFieldEndpoint(input: {
  sheet: PanelWiringSourceSheet;
  connection: PanelWiringSourceConnection;
  endpointRole: "from" | "to";
}): { assetTag: string; terminalKey: string } {
  const oppositeRole = input.endpointRole === "from" ? "to" : "from";
  const endpoint = input.connection[oppositeRole];
  const occurrence = occurrenceForEndpoint(input.sheet, endpoint.placementId);
  const terminal = occurrence
    ? resolveOccurrenceTerminal(occurrence, endpoint.anchorKey)
    : undefined;

  return {
    assetTag: occurrence?.tag ?? endpoint.placementId,
    terminalKey: terminal?.terminalKey ?? endpoint.anchorKey
  };
}

function assetTag(graph: PanelConnectivityGraph, assetId: string): string {
  return (
    graph.assetsById.get(assetId)?.tag ??
    graph.occurrencesByAssetId.get(assetId)?.[0]?.tag ??
    assetId
  );
}

export function placementWireContextKey(
  sheetId: string,
  placementId: string
): string {
  return sheetPlacementKey(sheetId, placementId);
}

export function buildPlacementWireContextDisplayIndex(input: {
  graph: PanelConnectivityGraph;
  requests: PlacementWireContextRequest[];
}): PlacementWireContextDisplayIndex {
  const rowsBySheetId = new Map<string, PlacementWireContextDisplayRow[]>();
  const summariesBySheetPlacement = new Map<
    string,
    PlacementWireContextSummary
  >();
  const externalRowsBySheetId = buildPanelExternalTerminationDisplayIndex(
    input.graph
  );
  const externalRowsBySheetPlacement = new Map<
    string,
    PanelExternalTerminationDisplayRow[]
  >();
  for (const [sheetId, externalRows] of externalRowsBySheetId) {
    for (const row of externalRows) {
      const key = sheetPlacementKey(sheetId, row.placementId);
      appendMapValue(externalRowsBySheetPlacement, key, row);
    }
  }

  const sortedSheets = [...input.graph.sheetsById.values()].sort(
    (first, second) => first.sheetNumber - second.sheetNumber
  );
  const fieldCandidatesByAssetId = new Map<string, FieldEndpointCandidate[]>();
  const internalCandidatesByAssetId = new Map<
    string,
    InternalEndpointCandidate[]
  >();
  const firstInternalRouteSheetByWireId = new Map<
    string,
    PanelWiringSourceSheet
  >();
  const routedInternalEndpointKeysBySheetPlacement = new Map<
    string,
    Set<string>
  >();

  for (const sheet of sortedSheets) {
    for (const connection of sheet.connections) {
      if (connection.panelConnectionId) {
        if (!firstInternalRouteSheetByWireId.has(connection.panelConnectionId)) {
          firstInternalRouteSheetByWireId.set(connection.panelConnectionId, sheet);
        }
        for (const endpointRole of ["from", "to"] as const) {
          const endpoint = connection[endpointRole];
          const occurrence = input.graph.occurrencesBySheetPlacement.get(
            sheetPlacementKey(sheet.id, endpoint.placementId)
          );
          const terminal = occurrence
            ? resolveOccurrenceTerminal(occurrence, endpoint.anchorKey)
            : undefined;
          if (!terminal) continue;
          const placementKey = sheetPlacementKey(sheet.id, endpoint.placementId);
          const keys =
            routedInternalEndpointKeysBySheetPlacement.get(placementKey) ??
            new Set<string>();
          keys.add(
            `${connection.panelConnectionId}:${terminal.terminalKey}:${terminal.side}`
          );
          routedInternalEndpointKeysBySheetPlacement.set(placementKey, keys);
        }
      }

      if (connection.panelConnectionId || connection.panelPatternId) continue;
      for (const endpointRole of ["from", "to"] as const) {
        const endpoint = connection[endpointRole];
        const occurrence = input.graph.occurrencesBySheetPlacement.get(
          sheetPlacementKey(sheet.id, endpoint.placementId)
        );
        if (!occurrence?.assetId) continue;
        appendMapValue(fieldCandidatesByAssetId, occurrence.assetId, {
          sheet,
          connection,
          endpointRole,
          occurrence
        });
      }
    }
  }

  for (const wire of input.graph.internalWiresById.values()) {
    for (const endpointRole of ["from", "to"] as const) {
      const endpoint = wire[endpointRole];
      appendMapValue(internalCandidatesByAssetId, endpoint.assetId, {
        wire,
        endpointRole
      });
    }
  }
  const seenRequests = new Set<string>();

  for (const request of input.requests) {
    const requestKey = sheetPlacementKey(request.sheetId, request.placementId);
    if (seenRequests.has(requestKey)) continue;
    seenRequests.add(requestKey);

    const sheet = input.graph.sheetsById.get(request.sheetId);
    const occurrence = sheet
      ? occurrenceForEndpoint(sheet, request.placementId)
      : undefined;
    const rows: PlacementWireContextDisplayRow[] = [];
    const rowKeys = new Set<string>();
    let unresolvedCount = 0;
    const includeExternal =
      request.mode === "external_connected" || request.mode === "all_connected";
    const includeInternal =
      request.mode === "internal_connected" || request.mode === "all_connected";

    if (
      sheet &&
      occurrence?.assetId &&
      occurrence.terminalResolutionStatus === "resolved"
    ) {
      const representedExternalConnections = new Set<string>();
      if (includeExternal) {
        for (const externalRow of
          externalRowsBySheetPlacement.get(requestKey) ?? []) {
          const canonicalId = `${externalRow.source.sheetId}:${externalRow.source.connectionId}`;
          representedExternalConnections.add(canonicalId);
          const sourceSheet = input.graph.sheetsById.get(
            externalRow.source.sheetId
          );
          const connection = input.graph.connectionsBySheetConnection.get(
            canonicalId
          );
          const endpointRole = externalRow.source.endpointRole;
          rows.push({
            placementId: request.placementId,
            anchorKey: externalRow.anchorKey,
            physicalPosition: externalRow.physicalPosition,
            canonicalKind: "field_connection",
            canonicalId,
            fieldConnectionId: externalRow.source.connectionId,
            externalTerminationId: externalRow.terminationId,
            direction: endpointRole === "from" ? "outgoing" : "incoming",
            wireId:
              externalRow.wireId?.trim() ||
              [externalRow.cableTag, externalRow.conductorKey]
                .filter(Boolean)
                .join("/") ||
              "FIELD",
            cableTag: externalRow.cableTag,
            conductorKey: externalRow.conductorKey,
            oppositeEndpoint:
              sourceSheet && connection
                ? oppositeFieldEndpoint({
                    sheet: sourceSheet,
                    connection,
                    endpointRole
                  })
                : {
                    assetTag: externalRow.source.placementId,
                    terminalKey: externalRow.source.anchorKey
                  },
            sourceSheet: externalRow.sourceSheet
          });
        }

        for (const candidate of
          fieldCandidatesByAssetId.get(occurrence.assetId) ?? []) {
          const { sheet: sourceSheet, connection, endpointRole } = candidate;
          const endpoint = connection[endpointRole];
          if (
            sourceSheet.id === request.sheetId &&
            endpoint.placementId === request.placementId
          ) {
            continue;
          }
          const canonicalId = `${sourceSheet.id}:${connection.id}`;
          if (representedExternalConnections.has(canonicalId)) continue;

          const terminal = resolveOccurrenceTerminal(
            candidate.occurrence,
            endpoint.anchorKey
          );
          const anchor = terminal
            ? resolveTargetAnchor(occurrence, terminal)
            : undefined;
          if (!terminal || !anchor) {
            unresolvedCount += 1;
            continue;
          }

          const rowKey = `field:${canonicalId}:${endpointRole}:${terminal.terminalKey}:${terminal.side}`;
          if (rowKeys.has(rowKey)) continue;
          rowKeys.add(rowKey);
          rows.push({
            placementId: request.placementId,
            anchorKey: anchor.anchorKey,
            physicalPosition: anchor.physicalPosition,
            canonicalKind: "field_connection",
            canonicalId,
            fieldConnectionId: connection.id,
            direction: endpointRole === "from" ? "outgoing" : "incoming",
            wireId: fallbackFieldWireId(connection),
            cableTag: connection.cableTag,
            conductorKey: connection.conductorKey,
            oppositeEndpoint: oppositeFieldEndpoint({
              sheet: sourceSheet,
              connection,
              endpointRole
            }),
            sourceSheet: {
              id: sourceSheet.id,
              number: sourceSheet.sheetNumber,
              name: sourceSheet.name
            }
          });
        }
      }

      if (includeInternal) {
        for (const candidate of
          internalCandidatesByAssetId.get(occurrence.assetId) ?? []) {
          const { wire, endpointRole } = candidate;
          const endpoint = wire[endpointRole];
          const terminal = {
            terminalKey: endpoint.terminalKey,
            side: endpoint.side
          };
          const routedKeys =
            routedInternalEndpointKeysBySheetPlacement.get(requestKey);
          if (routedKeys?.has(`${wire.id}:${terminal.terminalKey}:${terminal.side}`)) {
            continue;
          }

          const anchor = resolveTargetAnchor(occurrence, terminal);
          if (!anchor) {
            unresolvedCount += 1;
            continue;
          }

          const rowKey = `internal:${wire.id}:${endpointRole}:${terminal.terminalKey}:${terminal.side}`;
          if (rowKeys.has(rowKey)) continue;
          rowKeys.add(rowKey);
          const opposite = wire[endpointRole === "from" ? "to" : "from"];
          const routeSheet = firstInternalRouteSheetByWireId.get(wire.id);
          rows.push({
            placementId: request.placementId,
            anchorKey: anchor.anchorKey,
            physicalPosition: anchor.physicalPosition,
            canonicalKind: "internal_wire",
            canonicalId: wire.id,
            direction: endpointRole === "from" ? "outgoing" : "incoming",
            wireId: getEffectiveInternalWireId(input.graph.source, wire),
            oppositeEndpoint: {
              assetTag: assetTag(input.graph, opposite.assetId),
              terminalKey: opposite.terminalKey
            },
            sourceSheet: routeSheet
              ? {
                  id: routeSheet.id,
                  number: routeSheet.sheetNumber,
                  name: routeSheet.name
                }
              : undefined
          });
        }
      }
    }

    rows.sort(compareRows);
    if (rows.length > 0) {
      rowsBySheetId.set(request.sheetId, [
        ...(rowsBySheetId.get(request.sheetId) ?? []),
        ...rows
      ]);
    }
    let internalVisibleCount = 0;
    let externalVisibleCount = 0;
    for (const row of rows) {
      if (row.canonicalKind === "internal_wire") internalVisibleCount += 1;
      else externalVisibleCount += 1;
    }
    summariesBySheetPlacement.set(requestKey, {
      placementId: request.placementId,
      visibleCount: rows.length,
      internalVisibleCount,
      externalVisibleCount,
      unresolvedCount
    });
  }

  for (const [sheetId, rows] of rowsBySheetId) {
    rowsBySheetId.set(sheetId, rows.sort(compareRows));
  }

  return { rowsBySheetId, summariesBySheetPlacement };
}
