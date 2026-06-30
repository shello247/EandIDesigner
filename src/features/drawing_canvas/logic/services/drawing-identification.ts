import type {
  DrawingConnection,
  DrawingModel,
  DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

const DEVICE_TAG_PATTERN = /^[A-Z]{1,4}-\d{3}[A-Z]?$/;
const CABLE_ID_PATTERN = /^C-\d{3}[A-Z]?$/;
const TERMINAL_BLOCK_ID_PATTERN = /^TB-\d{3}[A-Z]?$/;

export type CableScheduleRow = {
  cableId: string;
  cablePlacementId: string;
  symbolName: string;
  fromTag?: string;
  toTag?: string;
  wireIds: string[];
  conductorKeys: string[];
};

export type ConnectionScheduleRow = {
  transitionGroup: string;
  wireId?: string;
  fromTag: string;
  fromAnchor: string;
  toTag: string;
  toAnchor: string;
  cableId?: string;
  conductorKey?: string;
};

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort();
}

function getPlacementById(
  model: DrawingModel,
  placementId: string
): DrawingPlacement | undefined {
  return model.placements.find((placement) => placement.id === placementId);
}

function getSymbolForPlacement(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  if (!placement) {
    return undefined;
  }

  return symbols.find(
    (symbol) =>
      symbol.symbolId === placement.symbolId &&
      symbol.versionId === placement.versionId
  );
}

function cablePlacementForConnection(
  model: DrawingModel,
  connection: DrawingConnection
): DrawingPlacement | undefined {
  const assignedCable = connection.cablePlacementId
    ? getPlacementById(model, connection.cablePlacementId)
    : undefined;

  if (assignedCable?.role === "cable_assembly") {
    return assignedCable;
  }

  const fromPlacement = getPlacementById(model, connection.from.placementId);
  const toPlacement = getPlacementById(model, connection.to.placementId);

  if (fromPlacement?.role === "cable_assembly") {
    return fromPlacement;
  }

  if (toPlacement?.role === "cable_assembly") {
    return toPlacement;
  }

  return undefined;
}

function cableEndpointAnchor(
  model: DrawingModel,
  connection: DrawingConnection,
  cablePlacement: DrawingPlacement | undefined
): string | undefined {
  if (!cablePlacement) {
    return undefined;
  }

  if (connection.from.placementId === cablePlacement.id) {
    return connection.from.anchorKey;
  }

  if (connection.to.placementId === cablePlacement.id) {
    return connection.to.anchorKey;
  }

  return undefined;
}

export function isRecommendedDeviceTag(tag: string): boolean {
  return DEVICE_TAG_PATTERN.test(tag.trim().toUpperCase());
}

export function isRecommendedCableId(tag: string): boolean {
  return CABLE_ID_PATTERN.test(tag.trim().toUpperCase());
}

export function isRecommendedTerminalBlockId(tag: string): boolean {
  return TERMINAL_BLOCK_ID_PATTERN.test(tag.trim().toUpperCase());
}

export function getPlacementIdentifier(
  model: DrawingModel,
  placementId: string
): string {
  return getPlacementById(model, placementId)?.tag ?? placementId;
}

export function normalizeCableConductorKey(
  conductorKey: string | undefined
): string | undefined {
  const normalized = conductorKey
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return undefined;
  }

  const pairMatch = normalized.match(/(?:^|_)PR?(\d+)(?:_|$)/);
  const pairPrefix = pairMatch ? `P${pairMatch[1]}-` : "";

  if (/(?:^|_)(SHIELD|SHLD|DRAIN)(?:_|$)/.test(normalized)) {
    return `${pairPrefix}SHLD`;
  }

  if (/(?:^|_)(T1|WHITE|WHT)(?:_|$)/.test(normalized)) {
    return `${pairPrefix}WHT`;
  }

  if (/(?:^|_)(T2|BLACK|BLK)(?:_|$)/.test(normalized)) {
    return `${pairPrefix}BLK`;
  }

  return normalized.replaceAll("_", "-");
}

export function deriveWireId(
  model: DrawingModel,
  _symbols: ApprovedDrawingSymbol[],
  connection: DrawingConnection
): string | undefined {
  const cablePlacement = cablePlacementForConnection(model, connection);
  const cableId = cablePlacement?.tag.trim().toUpperCase();
  const conductorId = normalizeCableConductorKey(
    connection.conductorKey ??
      cableEndpointAnchor(model, connection, cablePlacement)
  );

  if (!cableId || !conductorId) {
    return undefined;
  }

  return `${cableId}-${conductorId}`;
}

export function getConnectionWireId(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  connection: DrawingConnection
): string | undefined {
  return connection.wireId?.trim() || deriveWireId(model, symbols, connection);
}

export function getConnectionCableId(
  model: DrawingModel,
  connection: DrawingConnection
): string | undefined {
  return cablePlacementForConnection(model, connection)?.tag;
}

export function buildCableScheduleRows(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): CableScheduleRow[] {
  return model.placements
    .filter((placement) => placement.role === "cable_assembly")
    .map((cablePlacement) => {
      const cableConnections = model.connections.filter(
        (connection) =>
          connection.cablePlacementId === cablePlacement.id ||
          connection.from.placementId === cablePlacement.id ||
          connection.to.placementId === cablePlacement.id
      );
      const endpointTags = uniqueSorted(
        cableConnections.flatMap((connection) => [
          connection.from.placementId === cablePlacement.id
            ? undefined
            : getPlacementIdentifier(model, connection.from.placementId),
          connection.to.placementId === cablePlacement.id
            ? undefined
            : getPlacementIdentifier(model, connection.to.placementId)
        ])
      );
      const symbol = getSymbolForPlacement(cablePlacement, symbols);

      return {
        cableId: cablePlacement.tag,
        cablePlacementId: cablePlacement.id,
        symbolName: symbol?.displayName ?? cablePlacement.symbolId,
        fromTag: endpointTags[0],
        toTag: endpointTags[1],
        wireIds: uniqueSorted(
          cableConnections.map((connection) =>
            getConnectionWireId(model, symbols, connection)
          )
        ),
        conductorKeys: uniqueSorted(
          cableConnections.map((connection) =>
            normalizeCableConductorKey(connection.conductorKey)
          )
        )
      };
    });
}

export function buildConnectionScheduleRows(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): ConnectionScheduleRow[] {
  return model.connections.map((connection) => {
    const fromTag = getPlacementIdentifier(model, connection.from.placementId);
    const toTag = getPlacementIdentifier(model, connection.to.placementId);

    return {
      transitionGroup: `${fromTag} ↔ ${toTag}`,
      wireId: getConnectionWireId(model, symbols, connection),
      fromTag,
      fromAnchor: connection.from.anchorKey,
      toTag,
      toAnchor: connection.to.anchorKey,
      cableId: getConnectionCableId(model, connection),
      conductorKey: normalizeCableConductorKey(connection.conductorKey)
    };
  });
}

export function getReadableConnectionName(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  connection: DrawingConnection
): string {
  return (
    connection.label?.trim() ||
    getConnectionWireId(model, symbols, connection) ||
    connection.conductorKey?.trim() ||
    `${getPlacementIdentifier(model, connection.from.placementId)}:${connection.from.anchorKey}`
  );
}
