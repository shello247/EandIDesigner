import type {
  PanelConnectivityFinding,
  PanelConnectivityGraph,
  PanelExternalTermination,
  PanelTerminalNode,
  PanelTerminalCatalog,
  PanelTerminalCatalogRow,
  PanelTerminalOccupant,
  PanelTerminalSideNode,
  PanelTerminalSideOccupancy
} from "../../types";
import type {
  PanelBondRecord,
  PanelBridgeRecord,
  PanelInternalWireRecord,
  PanelTerminalSideRef
} from "../../data/schema";
import {
  terminalNodeId,
  terminalSideNodeId
} from "./terminal-resolution";

export type PanelTerminalCatalogBuildIndex = {
  externalTerminationsByPanelAssetId: ReadonlyMap<
    string,
    PanelExternalTermination[]
  >;
  internalWiresByPanelAssetId: ReadonlyMap<string, PanelInternalWireRecord[]>;
  bridgesByPanelAssetId: ReadonlyMap<string, PanelBridgeRecord[]>;
  bondsByPanelAssetId: ReadonlyMap<string, PanelBondRecord[]>;
  terminalsByAssetId: ReadonlyMap<string, PanelTerminalNode[]>;
  terminalSidesByAssetId: ReadonlyMap<string, PanelTerminalSideNode[]>;
  findingsByTerminalId: ReadonlyMap<string, PanelConnectivityFinding[]>;
  assetFindingsByAssetId: ReadonlyMap<string, PanelConnectivityFinding[]>;
};

function appendIndexValue<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function buildPanelTerminalCatalogIndex(
  graph: PanelConnectivityGraph
): PanelTerminalCatalogBuildIndex {
  const externalTerminationsByPanelAssetId = new Map<
    string,
    PanelExternalTermination[]
  >();
  const internalWiresByPanelAssetId = new Map<
    string,
    PanelInternalWireRecord[]
  >();
  const bridgesByPanelAssetId = new Map<string, PanelBridgeRecord[]>();
  const bondsByPanelAssetId = new Map<string, PanelBondRecord[]>();
  const terminalsByAssetId = new Map<string, PanelTerminalNode[]>();
  const terminalSidesByAssetId = new Map<string, PanelTerminalSideNode[]>();
  const findingsByTerminalId = new Map<string, PanelConnectivityFinding[]>();
  const assetFindingsByAssetId = new Map<string, PanelConnectivityFinding[]>();

  for (const termination of graph.externalTerminationsById.values()) {
    appendIndexValue(
      externalTerminationsByPanelAssetId,
      termination.panelAssetId,
      termination
    );
  }
  for (const wire of graph.internalWiresById.values()) {
    appendIndexValue(internalWiresByPanelAssetId, wire.panelAssetId, wire);
  }
  for (const bridge of graph.bridgesById.values()) {
    appendIndexValue(bridgesByPanelAssetId, bridge.panelAssetId, bridge);
  }
  for (const bond of graph.bondsById.values()) {
    appendIndexValue(bondsByPanelAssetId, bond.panelAssetId, bond);
  }
  for (const terminal of graph.terminalsById.values()) {
    appendIndexValue(terminalsByAssetId, terminal.ref.assetId, terminal);
  }
  for (const side of graph.terminalSidesById.values()) {
    appendIndexValue(terminalSidesByAssetId, side.ref.assetId, side);
  }
  for (const finding of graph.findings) {
    if (finding.terminal) {
      appendIndexValue(
        findingsByTerminalId,
        terminalNodeId(finding.terminal),
        finding
      );
    } else if (finding.assetId) {
      appendIndexValue(assetFindingsByAssetId, finding.assetId, finding);
    }
  }

  return {
    externalTerminationsByPanelAssetId,
    internalWiresByPanelAssetId,
    bridgesByPanelAssetId,
    bondsByPanelAssetId,
    terminalsByAssetId,
    terminalSidesByAssetId,
    findingsByTerminalId,
    assetFindingsByAssetId
  };
}

function channelStatus(
  count: number
): PanelTerminalSideOccupancy["conductorStatus"] {
  return count === 0 ? "available" : count === 1 ? "occupied" : "conflicting";
}

function allowedPatternConductorCount(
  graph: PanelConnectivityGraph,
  ref: PanelTerminalSideRef,
  occupants: PanelTerminalOccupant[]
): number {
  const ownerIds = new Set(
    occupants.flatMap((occupant) =>
      occupant.ownerPatternId ? [occupant.ownerPatternId] : []
    )
  );
  if (
    occupants.some((occupant) => occupant.kind !== "internal_wire") ||
    ownerIds.size !== 1 ||
    occupants.some((occupant) => !occupant.ownerPatternId)
  ) {
    return 1;
  }
  const pattern = graph.bridgesById.get([...ownerIds][0]);
  const definition = pattern?.definition;
  if (!definition) return 1;
  const sideId = terminalSideNodeId(ref);
  if (definition.topology === "daisy_chain") {
    const index = definition.orderedMembers.findIndex(
      (member) => terminalSideNodeId(member) === sideId
    );
    return index > 0 && index < definition.orderedMembers.length - 1 ? 2 : 1;
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
  occupantsBySideId: Map<string, PanelTerminalOccupant[]>,
  ref: PanelTerminalSideRef,
  occupant: PanelTerminalOccupant
): void {
  const sideId = terminalSideNodeId(ref);
  const current = occupantsBySideId.get(sideId) ?? [];

  if (!current.some((candidate) => candidate.id === occupant.id)) {
    occupantsBySideId.set(sideId, [...current, occupant]);
  }
}

export function buildPanelTerminalCatalog({
  graph,
  panelAssetId,
  index = buildPanelTerminalCatalogIndex(graph)
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  index?: PanelTerminalCatalogBuildIndex;
}): PanelTerminalCatalog {
  const associatedAssetIds =
    graph.assetIdsByPanelAssetId.get(panelAssetId) ?? new Set<string>();
  const occupantsBySideId = new Map<string, PanelTerminalOccupant[]>();

  for (const termination of
    index.externalTerminationsByPanelAssetId.get(panelAssetId) ?? []) {
    if (
      termination.panelAssetId !== panelAssetId ||
      termination.status !== "resolved" ||
      !termination.target
    ) {
      continue;
    }

    appendOccupant(occupantsBySideId, termination.target, {
      id: termination.id,
      kind: "external_termination",
      label:
        termination.wireId ??
        `${termination.sourceSheet.name}:${termination.source.anchorKey}`,
      wireId: termination.wireId,
      cableTag: termination.cableTag,
      conductorKey: termination.conductorKey,
      sourceSheet: termination.sourceSheet,
      channel: "conductor"
    });
  }

  for (const wire of index.internalWiresByPanelAssetId.get(panelAssetId) ?? []) {

    (["from", "to"] as const).forEach((endpointRole) => {
      const endpoint = wire[endpointRole];
      appendOccupant(occupantsBySideId, endpoint, {
        id: `${wire.id}:${endpointRole}`,
        kind: "internal_wire",
        label: wire.wireNumber
          ? String(wire.wireNumber).padStart(3, "0")
          : wire.wireId,
        wireNumber: wire.wireNumber,
        wireId: wire.wireId,
        channel: "conductor",
        ownerPatternId: wire.ownerPatternId
      });
    });
  }

  for (const bridge of index.bridgesByPanelAssetId.get(panelAssetId) ?? []) {

    bridge.members.forEach((member, index) =>
      appendOccupant(occupantsBySideId, member, {
        id: `${bridge.id}:${index}`,
        kind: "bridge",
        label: `${bridge.kind} ${bridge.patternCode ?? bridge.id}`,
        channel: "structural",
        ownerPatternId: bridge.id
      })
    );
  }

  for (const bond of index.bondsByPanelAssetId.get(panelAssetId) ?? []) {

    bond.endpoints.forEach((endpoint, index) => {
      if (endpoint.kind === "terminal") {
        appendOccupant(occupantsBySideId, endpoint.terminal, {
          id: `${bond.id}:${index}`,
          kind: "bond",
          label: `${bond.kind} ${bond.patternCode ?? bond.id}`,
          channel: "structural",
          ownerPatternId: bond.id
        });
      }
    });
  }

  const occupancyBySideId = new Map<string, PanelTerminalSideOccupancy>();
  const findings: PanelConnectivityFinding[] = [];

  const relevantSideNodes = [...associatedAssetIds].flatMap(
    (assetId) => index.terminalSidesByAssetId.get(assetId) ?? []
  );
  for (const sideNode of relevantSideNodes) {

    const occupants = [...(occupantsBySideId.get(sideNode.id) ?? [])].sort(
      (first, second) => first.id.localeCompare(second.id)
    );
    const conductorOccupants = occupants.filter(
      (occupant) => occupant.channel === "conductor"
    );
    const structuralOccupants = occupants.filter(
      (occupant) => occupant.channel === "structural"
    );
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
    const structuralStatus = channelStatus(structuralOccupants.length);
    const occupancy: PanelTerminalSideOccupancy = {
      ref: sideNode.ref,
      status:
        conductorStatus === "conflicting" || structuralStatus === "conflicting"
          ? "conflicting"
          : occupants.length === 0
          ? "available"
          : "occupied",
      occupants,
      conductorStatus,
      conductorOccupants,
      structuralStatus,
      structuralOccupants
    };
    occupancyBySideId.set(sideNode.id, occupancy);

    if (conductorStatus === "conflicting") {
      findings.push({
        id: `duplicate_terminal_conductor_occupancy:${sideNode.id}`,
        severity: "error",
        code: "duplicate_terminal_conductor_occupancy",
        message: `${sideNode.ref.terminalKey}:${sideNode.ref.side} has ${conductorOccupants.length} incompatible conductor occupants.`,
        panelAssetId,
        assetId: sideNode.ref.assetId,
        terminal: sideNode.ref
      });
    }
    if (structuralStatus === "conflicting") {
      findings.push({
        id: `duplicate_terminal_structural_occupancy:${sideNode.id}`,
        severity: "error",
        code: "duplicate_terminal_structural_occupancy",
        message: `${sideNode.ref.terminalKey}:${sideNode.ref.side} has ${structuralOccupants.length} structural memberships.`,
        panelAssetId,
        assetId: sideNode.ref.assetId,
        terminal: sideNode.ref
      });
    }
  }

  const occupancyFindingsByTerminalId = new Map<
    string,
    PanelConnectivityFinding[]
  >();
  findings.forEach((finding) => {
    if (finding.terminal) {
      appendIndexValue(
        occupancyFindingsByTerminalId,
        terminalNodeId(finding.terminal),
        finding
      );
    }
  });
  const rows = [...associatedAssetIds]
    .flatMap((assetId) => index.terminalsByAssetId.get(assetId) ?? [])
    .flatMap((terminal): PanelTerminalCatalogRow[] => {
      const asset = graph.assetsById.get(terminal.ref.assetId);

      if (!asset) {
        return [];
      }

      const row: PanelTerminalCatalogRow = {
        terminalId: terminal.id,
        terminal: terminal.ref,
        assetTag: asset.tag,
        assetTitle: asset.title,
        assetType: asset.type,
        label: terminal.label,
        function: terminal.function,
        supportedSides: terminal.supportedSides,
        requiredSides: terminal.requiredSides,
        allowedDomains: terminal.allowedDomains,
        occupancy: {},
        findings: []
      };

      terminal.supportedSides.forEach((side) => {
        const ref = { ...terminal.ref, side };
        const occupancy = occupancyBySideId.get(terminalSideNodeId(ref));
        if (occupancy) {
          row.occupancy[side] = occupancy;
        }
      });

      row.findings = [
        ...(index.findingsByTerminalId.get(row.terminalId) ?? []),
        ...(index.assetFindingsByAssetId.get(row.terminal.assetId) ?? []),
        ...(occupancyFindingsByTerminalId.get(row.terminalId) ?? [])
      ];
      return [row];
    })
    .sort(
      (first, second) =>
        first.assetTag.localeCompare(second.assetTag, undefined, {
          numeric: true,
          sensitivity: "base"
        }) ||
        first.label.localeCompare(second.label, undefined, {
          numeric: true,
          sensitivity: "base"
        })
    );

  return {
    panelAssetId,
    rowsByTerminalId: new Map(rows.map((row) => [row.terminalId, row])),
    occupancyBySideId,
    findings: [...findings].sort((first, second) =>
      first.id.localeCompare(second.id)
    )
  };
}

export function getTerminalSideOccupancy(
  catalog: PanelTerminalCatalog,
  ref: PanelTerminalSideRef
): PanelTerminalSideOccupancy | undefined {
  return catalog.occupancyBySideId.get(terminalSideNodeId(ref));
}

export function validatePanelTerminalMappings({
  graph,
  panelAssetId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
}): PanelConnectivityFinding[] {
  const catalog = buildPanelTerminalCatalog({ graph, panelAssetId });
  const relevantGraphFindings = graph.findings.filter(
    (finding) =>
      finding.panelAssetId === panelAssetId &&
      (finding.code.includes("terminal") ||
        finding.code.includes("mapping") ||
        finding.code === "linked_terminal_configuration_mismatch")
  );
  const findings = new Map(
    [...relevantGraphFindings, ...catalog.findings].map((finding) => [
      finding.id,
      finding
    ])
  );

  return [...findings.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}
