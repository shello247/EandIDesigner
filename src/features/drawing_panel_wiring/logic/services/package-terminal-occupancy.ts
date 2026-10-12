import type {
  PanelTerminalSideRef,
  PanelWiringSourceConnection,
  PanelWiringSourceOccurrence
} from "../../data/schema";
import type {
  ConnectionEndpointAvailability,
  PackageTerminalEndpointResolution,
  PackageTerminalOccupancyIndex,
  PanelConnectivityGraph,
  PanelTerminalSideOccupancy,
  TerminalConflictDelta,
  TerminalConflictFingerprint,
  TerminalSideOccupant
} from "../../types";
import {
  resolveOccurrenceTerminalByAnchor,
  sheetPlacementKey,
  sourceEndpointKey,
  terminalSideNodeId
} from "./terminal-resolution";

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function packageOccurrenceAnchorKey(
  sheetId: string,
  placementId: string,
  anchorKey: string
): string {
  return `${sheetPlacementKey(sheetId, placementId)}:${encodePart(anchorKey)}`;
}

export function connectionEndpointSourceKey(input: {
  sheetId: string;
  connectionId: string;
  endpointRole: "from" | "to";
  placementId: string;
  anchorKey: string;
}): string {
  return sourceEndpointKey(input);
}

function endpointResolution(
  occurrence: PanelWiringSourceOccurrence,
  anchorKey: string
): PackageTerminalEndpointResolution {
  const terminal = resolveOccurrenceTerminalByAnchor(occurrence, anchorKey);
  if (terminal && occurrence.assetId) {
    const anchor = terminal.anchors.find(
      (candidate) => candidate.anchorKey === anchorKey
    );
    const side = anchor?.sideHint;
    if (side && terminal.supportedSides.includes(side)) {
      return {
        kind: "terminal",
        terminal: {
          assetId: occurrence.assetId,
          terminalKey: terminal.terminalKey,
          side
        }
      };
    }
    return {
      kind: "unresolved_managed_terminal",
      reason: `Anchor ${anchorKey} does not identify a supported physical terminal side.`
    };
  }

  if (
    occurrence.assetId &&
    occurrence.terminalResolutionStatus !== "not_applicable" &&
    occurrence.terminalResolutionStatus !== "resolved"
  ) {
    return {
      kind: "unresolved_managed_terminal",
      reason:
        occurrence.terminalResolutionMessage ??
        `Terminal metadata for ${occurrence.tag} is not resolved.`
    };
  }

  if (
    occurrence.assetId &&
    occurrence.terminalResolutionStatus === "resolved" &&
    occurrence.terminals.length > 0 &&
    !occurrence.availableAnchorKeys?.includes(anchorKey)
  ) {
    return {
      kind: "unresolved_managed_terminal",
      reason: `Anchor ${anchorKey} is not declared by the resolved terminal symbol for ${occurrence.tag}.`
    };
  }

  return { kind: "graphical" };
}

function allowedPatternConductorCount(
  graph: PanelConnectivityGraph,
  ref: PanelTerminalSideRef,
  occupants: TerminalSideOccupant[]
): number {
  const ownerIds = new Set(
    occupants.flatMap((occupant) =>
      occupant.ownerPatternId ? [occupant.ownerPatternId] : []
    )
  );
  if (
    occupants.some((occupant) => occupant.kind !== "internal_wire") ||
    occupants.some((occupant) => !occupant.ownerPatternId) ||
    ownerIds.size !== 1
  ) {
    return 1;
  }

  const pattern = graph.bridgesById.get([...ownerIds][0]);
  const definition = pattern?.definition;
  if (!definition) return 1;

  const sideId = terminalSideNodeId(ref);
  if (definition.topology === "daisy_chain") {
    const memberIndex = definition.orderedMembers.findIndex(
      (member) => terminalSideNodeId(member) === sideId
    );
    return memberIndex > 0 && memberIndex < definition.orderedMembers.length - 1
      ? 2
      : 1;
  }
  if (
    (definition.topology === "distribution" ||
      definition.topology === "fused_distribution") &&
    terminalSideNodeId(definition.source) === sideId
  ) {
    return definition.branches.length;
  }
  return 1;
}

function appendOccupant(
  occupantsBySideId: Map<string, TerminalSideOccupant[]>,
  ref: PanelTerminalSideRef,
  occupant: TerminalSideOccupant
): void {
  const sideId = terminalSideNodeId(ref);
  const current = occupantsBySideId.get(sideId) ?? [];
  if (!current.some((candidate) => candidate.sourceKey === occupant.sourceKey)) {
    occupantsBySideId.set(sideId, [...current, occupant]);
  }
}

function externalOccupant(
  termination: PanelConnectivityGraph["externalTerminationsById"] extends ReadonlyMap<
    string,
    infer T
  >
    ? T
    : never
): TerminalSideOccupant | undefined {
  if (termination.status !== "resolved" || !termination.target) return undefined;
  const sourceKey = sourceEndpointKey(termination.source);
  return {
    id: termination.id,
    sourceKey,
    recordKind: "field_connection",
    kind: "external_termination",
    channel: "conductor",
    label:
      termination.wireId ??
      `${termination.sourceSheet.name}:${termination.source.anchorKey}`,
    wireId: termination.wireId,
    cableTag: termination.cableTag,
    conductorKey: termination.conductorKey,
    sourceSheet: termination.sourceSheet,
    sheetId: termination.source.sheetId,
    sheetNumber: termination.sourceSheet.number,
    sheetName: termination.sourceSheet.name,
    connectionId: termination.source.connectionId,
    endpointRole: termination.source.endpointRole,
    placementId: termination.source.placementId,
    anchorKey: termination.source.anchorKey
  };
}

function directConnectionOccupant(input: {
  sheet: PanelConnectivityGraph["source"]["sheets"][number];
  connection: PanelWiringSourceConnection;
  endpointRole: "from" | "to";
}): TerminalSideOccupant {
  const endpoint = input.connection[input.endpointRole];
  const sourceKey = connectionEndpointSourceKey({
    sheetId: input.sheet.id,
    connectionId: input.connection.id,
    endpointRole: input.endpointRole,
    placementId: endpoint.placementId,
    anchorKey: endpoint.anchorKey
  });
  return {
    id: `connection:${sourceKey}`,
    sourceKey,
    recordKind: "field_connection",
    kind: "external_termination",
    channel: "conductor",
    label: input.connection.wireId ?? input.connection.label ?? input.connection.id,
    wireId: input.connection.wireId,
    cableTag: input.connection.cableTag,
    conductorKey: input.connection.conductorKey,
    sourceSheet: {
      id: input.sheet.id,
      number: input.sheet.sheetNumber,
      name: input.sheet.name
    },
    sheetId: input.sheet.id,
    sheetNumber: input.sheet.sheetNumber,
    sheetName: input.sheet.name,
    connectionId: input.connection.id,
    endpointRole: input.endpointRole,
    placementId: endpoint.placementId,
    anchorKey: endpoint.anchorKey
  };
}

export function buildPackageTerminalOccupancyIndex(
  graph: PanelConnectivityGraph
): PackageTerminalOccupancyIndex {
  const endpointResolutionByOccurrenceAnchor = new Map<
    string,
    PackageTerminalEndpointResolution
  >();
  for (const occurrence of graph.occurrencesBySheetPlacement.values()) {
    const anchorKeys = new Set([
      ...(occurrence.availableAnchorKeys ?? []),
      ...occurrence.terminals.flatMap((terminal) =>
        terminal.anchors.map((anchor) => anchor.anchorKey)
      )
    ]);
    for (const anchorKey of anchorKeys) {
      endpointResolutionByOccurrenceAnchor.set(
        packageOccurrenceAnchorKey(
          occurrence.sheetId,
          occurrence.placementId,
          anchorKey
        ),
        endpointResolution(occurrence, anchorKey)
      );
    }
  }

  const occupantsBySideId = new Map<string, TerminalSideOccupant[]>();
  const externallyResolvedSourceKeys = new Set<string>();
  for (const termination of graph.externalTerminationsById.values()) {
    const occupant = externalOccupant(termination);
    if (!occupant || !termination.target) continue;
    externallyResolvedSourceKeys.add(occupant.sourceKey);
    appendOccupant(occupantsBySideId, termination.target, occupant);
  }

  const unresolvedManagedEndpoints: TerminalConflictDelta["unresolvedManagedEndpoints"] = [];
  for (const sheet of graph.source.sheets) {
    for (const connection of sheet.connections) {
      if (connection.panelConnectionId || connection.panelPatternId) continue;
      for (const endpointRole of ["from", "to"] as const) {
        const endpoint = connection[endpointRole];
        const sourceKey = connectionEndpointSourceKey({
          sheetId: sheet.id,
          connectionId: connection.id,
          endpointRole,
          placementId: endpoint.placementId,
          anchorKey: endpoint.anchorKey
        });
        if (externallyResolvedSourceKeys.has(sourceKey)) continue;

        const occurrence = graph.occurrencesBySheetPlacement.get(
          sheetPlacementKey(sheet.id, endpoint.placementId)
        );
        const resolution =
          endpointResolutionByOccurrenceAnchor.get(
            packageOccurrenceAnchorKey(
              sheet.id,
              endpoint.placementId,
              endpoint.anchorKey
            )
          ) ??
          (occurrence
            ? endpointResolution(occurrence, endpoint.anchorKey)
            : undefined);
        if (resolution?.kind === "terminal") {
          appendOccupant(
            occupantsBySideId,
            resolution.terminal,
            directConnectionOccupant({ sheet, connection, endpointRole })
          );
        } else if (resolution?.kind === "unresolved_managed_terminal") {
          unresolvedManagedEndpoints.push({
            sourceKey,
            sheetId: sheet.id,
            sheetNumber: sheet.sheetNumber,
            sheetName: sheet.name,
            connectionId: connection.id,
            endpointRole,
            placementId: endpoint.placementId,
            anchorKey: endpoint.anchorKey,
            reason: resolution.reason
          });
        }
      }
    }
  }

  for (const wire of graph.internalWiresById.values()) {
    for (const endpointRole of ["from", "to"] as const) {
      const endpoint = wire[endpointRole];
      appendOccupant(occupantsBySideId, endpoint, {
        id: `${wire.id}:${endpointRole}`,
        sourceKey: `internal-wire:${encodePart(wire.id)}:${endpointRole}`,
        recordKind: "internal_wire",
        kind: "internal_wire",
        channel: "conductor",
        label: wire.wireNumber
          ? String(wire.wireNumber).padStart(3, "0")
          : wire.wireId,
        wireNumber: wire.wireNumber,
        wireId: wire.wireId,
        ownerPatternId: wire.ownerPatternId
      });
    }
  }

  const occupancyBySideId = new Map<string, PanelTerminalSideOccupancy>();
  for (const sideNode of graph.terminalSidesById.values()) {
    const conductorOccupants = [
      ...(occupantsBySideId.get(sideNode.id) ?? [])
    ].sort((first, second) => first.sourceKey.localeCompare(second.sourceKey));
    const allowedConductors = allowedPatternConductorCount(
      graph,
      sideNode.ref,
      conductorOccupants
    );
    const conductorStatus =
      conductorOccupants.length === 0
        ? "available"
        : conductorOccupants.length <= allowedConductors
          ? "occupied"
          : "conflicting";
    occupancyBySideId.set(sideNode.id, {
      ref: sideNode.ref,
      status: conductorStatus,
      occupants: conductorOccupants,
      conductorStatus,
      conductorOccupants,
      structuralStatus: "available",
      structuralOccupants: []
    });
  }

  return {
    occupancyBySideId,
    conductorOccupantsBySideId: occupantsBySideId,
    endpointResolutionByOccurrenceAnchor,
    unresolvedManagedEndpoints: unresolvedManagedEndpoints.sort((a, b) =>
      a.sourceKey.localeCompare(b.sourceKey)
    )
  };
}

export function resolveConnectionEndpointAvailability(input: {
  index: PackageTerminalOccupancyIndex;
  sheetId: string;
  placementId: string;
  anchorKey: string;
  excludeSourceKey?: string;
}): ConnectionEndpointAvailability {
  const resolution = input.index.endpointResolutionByOccurrenceAnchor.get(
    packageOccurrenceAnchorKey(input.sheetId, input.placementId, input.anchorKey)
  );
  if (!resolution || resolution.kind === "graphical") {
    return { status: "graphical", enabled: true, occupants: [] };
  }
  if (resolution.kind === "unresolved_managed_terminal") {
    return {
      status: "unresolved",
      enabled: false,
      occupants: [],
      reason: resolution.reason
    };
  }

  const occupants = [
    ...(input.index.conductorOccupantsBySideId.get(
      terminalSideNodeId(resolution.terminal)
    ) ?? [])
  ].filter((occupant) => occupant.sourceKey !== input.excludeSourceKey);
  if (occupants.length === 0) {
    return {
      status: "available",
      enabled: true,
      terminal: resolution.terminal,
      occupants: []
    };
  }
  return {
    status: occupants.length === 1 ? "occupied" : "conflicting",
    enabled: false,
    terminal: resolution.terminal,
    occupants,
    reason:
      occupants.length === 1
        ? `${occupants[0].wireId ?? occupants[0].label} already occupies this terminal end on ${
            occupants[0].sheetNumber
              ? `Sheet ${occupants[0].sheetNumber} — ${occupants[0].sheetName ?? "Untitled"}`
              : occupants[0].sheetName ?? "another sheet"
          }.`
        : `This terminal end already has ${occupants.length} conductor landings.`
  };
}

export function buildTerminalConflictFingerprints(
  index: PackageTerminalOccupancyIndex
): ReadonlyMap<string, TerminalConflictFingerprint> {
  const conflicts = new Map<string, TerminalConflictFingerprint>();
  for (const [sideId, occupancy] of index.occupancyBySideId) {
    if (occupancy.conductorStatus !== "conflicting") continue;
    const occupants = (occupancy.conductorOccupants as TerminalSideOccupant[])
      .slice()
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
    conflicts.set(sideId, {
      sideId,
      terminal: occupancy.ref,
      occupantSourceKeys: occupants.map((occupant) => occupant.sourceKey),
      occupants
    });
  }
  return conflicts;
}

export function validateTerminalConflictDelta(input: {
  baseline: PackageTerminalOccupancyIndex;
  candidate: PackageTerminalOccupancyIndex;
}): TerminalConflictDelta {
  const baselineConflicts = buildTerminalConflictFingerprints(input.baseline);
  const candidateConflicts = buildTerminalConflictFingerprints(input.candidate);
  const worsened: TerminalConflictFingerprint[] = [];

  for (const [sideId, candidate] of candidateConflicts) {
    const baseline = baselineConflicts.get(sideId);
    const baselineSources = new Set(baseline?.occupantSourceKeys ?? []);
    if (
      !baseline ||
      candidate.occupantSourceKeys.length > baseline.occupantSourceKeys.length ||
      candidate.occupantSourceKeys.some((sourceKey) => !baselineSources.has(sourceKey))
    ) {
      worsened.push(candidate);
    }
  }

  const baselineUnresolved = new Set(
    input.baseline.unresolvedManagedEndpoints.map((endpoint) => endpoint.sourceKey)
  );
  const newUnresolved = input.candidate.unresolvedManagedEndpoints.filter(
    (endpoint) => !baselineUnresolved.has(endpoint.sourceKey)
  );
  return {
    ok: worsened.length === 0 && newUnresolved.length === 0,
    conflicts: worsened.sort((a, b) => a.sideId.localeCompare(b.sideId)),
    unresolvedManagedEndpoints: newUnresolved
  };
}
