import type {
  DrawingConnection,
  DrawingEndpoint,
  DrawingSheetCanvasModel as DrawingModel,
  DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getRenderableSymbolForPlacement,
  packageSymbolKey
} from "./drawing-generated-symbols";
import { deriveWireId } from "./drawing-identification";

function packageKey(symbolId: string, versionId: string): string {
  return packageSymbolKey(symbolId, versionId);
}

export function endpointKey(endpoint: DrawingEndpoint): string {
  return `${endpoint.placementId}:${endpoint.anchorKey}`;
}

export function areSameEndpoint(
  first: DrawingEndpoint,
  second: DrawingEndpoint
): boolean {
  return endpointKey(first) === endpointKey(second);
}

export function connectionPairKey(connection: {
  from: DrawingEndpoint;
  to: DrawingEndpoint;
}): string {
  return [endpointKey(connection.from), endpointKey(connection.to)]
    .sort()
    .join("::");
}

export function isDuplicateConnection(
  connections: DrawingConnection[],
  from: DrawingEndpoint,
  to: DrawingEndpoint,
  ignoreConnectionId?: string
): boolean {
  const candidateKey = connectionPairKey({ from, to });

  return connections.some(
    (connection) =>
      connection.id !== ignoreConnectionId &&
      connectionPairKey(connection) === candidateKey
  );
}

export function getPlacementById(
  model: DrawingModel,
  placementId: string
): DrawingPlacement | undefined {
  return model.placements.find((placement) => placement.id === placementId);
}

export function getSymbolForPlacement(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  return getRenderableSymbolForPlacement(placement, symbols);
}

export function getAnchorForEndpoint(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  endpoint: DrawingEndpoint
) {
  const placement = getPlacementById(model, endpoint.placementId);
  const symbol = getSymbolForPlacement(placement, symbols);
  const anchor = symbol?.metadata.anchors.find(
    (candidate) => candidate.key === endpoint.anchorKey
  );

  return placement && symbol && anchor ? { placement, symbol, anchor } : null;
}

export function getConnectionEndpointLabel(
  model: DrawingModel,
  endpoint: DrawingEndpoint
): string {
  const placement = getPlacementById(model, endpoint.placementId);

  return `${placement?.tag ?? endpoint.placementId}:${endpoint.anchorKey}`;
}

export function getConnectionLabel(
  model: DrawingModel,
  connection: DrawingConnection
): string {
  return `${getConnectionEndpointLabel(
    model,
    connection.from
  )} -> ${getConnectionEndpointLabel(model, connection.to)}`;
}

export function getConnectionCableDefaults(
  model: DrawingModel,
  from: DrawingEndpoint,
  to: DrawingEndpoint
): Pick<DrawingConnection, "cablePlacementId" | "conductorKey" | "wireId"> {
  const fromPlacement = getPlacementById(model, from.placementId);
  const toPlacement = getPlacementById(model, to.placementId);
  const endpointCablePlacement =
    fromPlacement?.role === "cable_assembly"
      ? fromPlacement
      : toPlacement?.role === "cable_assembly"
        ? toPlacement
        : undefined;
  const cablePlacement =
    endpointCablePlacement ??
    model.placements.find((placement) => placement.role === "cable_assembly");

  if (!cablePlacement) {
    return {};
  }

  const cableEndpoint =
    from.placementId === cablePlacement.id
      ? from
      : to.placementId === cablePlacement.id
        ? to
        : undefined;

  const defaults = {
    cablePlacementId: cablePlacement.id,
    conductorKey: cableEndpoint?.anchorKey
  };

  return {
    ...defaults,
    wireId: deriveWireId(model, [], {
      id: "draft_connection",
      from,
      to,
      ...defaults
    })
  };
}

export function createConnectionFromEndpoints(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  from: DrawingEndpoint;
  to: DrawingEndpoint;
}):
  | { ok: true; connection: DrawingConnection }
  | { ok: false; error: string } {
  if (areSameEndpoint(input.from, input.to)) {
    return {
      ok: false,
      error: "Choose a different destination anchor."
    };
  }

  if (
    !getAnchorForEndpoint(input.model, input.symbols, input.from) ||
    !getAnchorForEndpoint(input.model, input.symbols, input.to)
  ) {
    return {
      ok: false,
      error: "Connection endpoint is no longer available."
    };
  }

  if (
    isDuplicateConnection(
      input.model.connections,
      input.from,
      input.to
    )
  ) {
    return {
      ok: false,
      error: "Those anchors are already connected."
    };
  }

  return {
    ok: true,
    connection: {
      id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from: input.from,
      to: input.to,
      ...getConnectionCableDefaults(input.model, input.from, input.to)
    }
  };
}

export function getUnconnectedRequiredTerminals(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
) {
  const symbolsByPlacementKey = new Map(
    symbols.map((symbol) => [
      packageKey(symbol.symbolId, symbol.versionId),
      symbol
    ])
  );
  const connectedEndpointKeys = new Set(
    model.connections.flatMap((connection) => [
      endpointKey(connection.from),
      endpointKey(connection.to)
    ])
  );

  return model.placements.flatMap((placement) => {
    const symbol = symbolsByPlacementKey.get(
      packageKey(placement.symbolId, placement.versionId)
    );

    if (!symbol) {
      return [];
    }

    return symbol.metadata.terminals
      .filter(
        (terminal) =>
          terminal.requiredForWiring &&
          !connectedEndpointKeys.has(
            endpointKey({
              placementId: placement.id,
              anchorKey: terminal.anchorKey
            })
          )
      )
      .map((terminal) => ({
        placement,
        symbol,
        terminal
      }));
  });
}
