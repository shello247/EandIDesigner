import type { DrawingEndpoint } from "../../data/schema";
import {
  getTerminalSideOccupancy,
  type PanelTerminalCatalog,
  type PanelTerminalOccupant,
  type PanelTerminalSideRef
} from "@/features/drawing_panel_wiring/api/public";

export type DrawingAnchorAvailabilityStatus =
  | "available"
  | "occupied"
  | "conflicting"
  | "unresolved"
  | "incompatible";

export type DrawingAnchorAvailabilityOccupant = {
  label: string;
  wireId?: string;
  cableTag?: string;
  conductorKey?: string;
  sourceSheet?: string;
};

export type DrawingAnchorAvailability = {
  status: DrawingAnchorAvailabilityStatus;
  enabled: boolean;
  reason?: string;
  occupants: DrawingAnchorAvailabilityOccupant[];
};

export type DrawingAnchorTerminalMapping = {
  terminal: PanelTerminalSideRef;
};

export type DrawingTerminalAvailabilitySummary = {
  available: number;
  occupied: number;
  conflicting: number;
  unresolved: number;
  terminals: DrawingTerminalAvailabilityItem[];
};

export type DrawingTerminalAvailabilityItem = {
  id: string;
  terminalKey: string;
  terminalLabel: string;
  side?: PanelTerminalSideRef["side"];
  status: DrawingAnchorAvailabilityStatus;
  reason?: string;
  occupants: DrawingAnchorAvailabilityOccupant[];
};

type DrawingAnchorAvailabilityChannel = "conductor" | "structural";

function occupantProjection(
  occupant: PanelTerminalOccupant
): DrawingAnchorAvailabilityOccupant {
  return {
    label: occupant.label,
    wireId: occupant.wireId,
    cableTag: occupant.cableTag,
    conductorKey: occupant.conductorKey,
    sourceSheet: occupant.sourceSheet?.name
  };
}

function occupiedReason(
  occupants: DrawingAnchorAvailabilityOccupant[]
): string {
  const occupant = occupants[0];
  if (!occupant) return "This terminal side is occupied.";

  return `${occupant.wireId ?? occupant.label} already occupies this terminal side.`;
}

export function drawingTerminalSideKey(ref: PanelTerminalSideRef): string {
  return `${ref.assetId}:${ref.terminalKey}:${ref.side}`;
}

export function resolveDrawingAnchorAvailability({
  endpoint,
  terminalMappings,
  terminalCatalog,
  channel = "conductor",
  incompatibleReason
}: {
  endpoint: DrawingEndpoint;
  terminalMappings: ReadonlyMap<string, DrawingAnchorTerminalMapping>;
  terminalCatalog?: PanelTerminalCatalog;
  channel?: DrawingAnchorAvailabilityChannel;
  incompatibleReason?: string;
}): DrawingAnchorAvailability {
  const mapping = terminalMappings.get(
    `${endpoint.placementId}:${endpoint.anchorKey}`
  );

  if (!mapping || !terminalCatalog) {
    return {
      status: "unresolved",
      enabled: false,
      reason: "This anchor does not resolve to one authoritative terminal side.",
      occupants: []
    };
  }

  const occupancy = getTerminalSideOccupancy(
    terminalCatalog,
    mapping.terminal
  );
  if (!occupancy) {
    return {
      status: "unresolved",
      enabled: false,
      reason: "Terminal occupancy is unavailable for this anchor.",
      occupants: []
    };
  }

  const status =
    channel === "structural"
      ? occupancy.structuralStatus
      : occupancy.conductorStatus;
  const occupants = (
    channel === "structural"
      ? occupancy.structuralOccupants
      : occupancy.conductorOccupants
  ).map(occupantProjection);

  if (incompatibleReason) {
    return {
      status: "incompatible",
      enabled: false,
      reason: incompatibleReason,
      occupants
    };
  }

  if (status === "conflicting") {
    return {
      status: "conflicting",
      enabled: false,
      reason: `This terminal side has conflicting ${channel} occupancy.`,
      occupants
    };
  }

  if (status === "occupied") {
    return {
      status: "occupied",
      enabled: false,
      reason: occupiedReason(occupants),
      occupants
    };
  }

  return {
    status: "available",
    enabled: true,
    occupants: []
  };
}

export function summarizeDrawingTerminalAvailability(
  entries: Array<{
    canonicalTerminalSideKey?: string;
    fallbackKey: string;
    terminal?: PanelTerminalSideRef;
    terminalLabel?: string;
    availability: DrawingAnchorAvailability;
  }>
): DrawingTerminalAvailabilitySummary | undefined {
  if (entries.length === 0) return undefined;

  const uniqueEntries = new Map<
    string,
    (typeof entries)[number]
  >();
  for (const entry of entries) {
    const key = entry.canonicalTerminalSideKey ?? `unresolved:${entry.fallbackKey}`;
    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, entry);
    }
  }

  const summary: DrawingTerminalAvailabilitySummary = {
    available: 0,
    occupied: 0,
    conflicting: 0,
    unresolved: 0,
    terminals: []
  };

  uniqueEntries.forEach((entry, id) => {
    const { availability, terminal } = entry;
    if (availability.status === "available") summary.available += 1;
    else if (availability.status === "occupied") summary.occupied += 1;
    else if (availability.status === "conflicting") summary.conflicting += 1;
    else summary.unresolved += 1;

    summary.terminals.push({
      id,
      terminalKey: terminal?.terminalKey ?? entry.fallbackKey,
      terminalLabel:
        entry.terminalLabel ?? terminal?.terminalKey ?? entry.fallbackKey,
      side: terminal?.side,
      status: availability.status,
      reason: availability.reason,
      occupants: availability.occupants
    });
  });

  return summary;
}

export function getDrawingAnchorAvailabilityLabel(
  availability: DrawingAnchorAvailability
): string {
  if (availability.status === "available") return "Available";
  if (availability.status === "conflicting") return "Conflicting occupancy";
  if (
    availability.status === "unresolved" ||
    availability.status === "incompatible"
  ) {
    return `Unavailable — ${availability.reason ?? "This terminal cannot be used."}`;
  }

  const occupant = availability.occupants[0];
  return `Occupied by ${occupant?.wireId ?? occupant?.label ?? "another connection"}`;
}
