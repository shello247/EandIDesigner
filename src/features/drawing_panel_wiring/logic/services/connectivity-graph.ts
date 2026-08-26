import {
  panelWiringSourcePackageSchema,
  type PanelTerminalRef,
  type PanelWiringSourceOccurrence,
  type PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelConnectivityFinding,
  PanelConnectivityGraph,
  PanelConnectivitySnapshot,
  PanelExternalTermination,
  PanelTerminalNode,
  PanelTerminalSideNode
} from "../../types";
import { discoverExternalTerminations } from "./external-termination-discovery";
import {
  buildPanelPatternValidationIndex,
  validatePanelConnectionPattern
} from "./panel-pattern-validation";
import {
  buildElectricalNetworkIndex,
  traceElectricalPathInIndex
} from "./electrical-network-index";
import {
  sheetConnectionKey,
  sheetPlacementKey,
  sourceEndpointKey,
  terminalDefinitionSignature,
  terminalNodeId,
  terminalSideNodeId
} from "./terminal-resolution";

function appendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function addNestedSet(
  map: Map<string, Set<string>>,
  key: string,
  value: string
): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function terminalOccurrenceRefKey(sheetId: string, placementId: string): string {
  return `${sheetId}:${placementId}`;
}

function addTerminalNodes(
  occurrences: PanelWiringSourceOccurrence[],
  terminalsById: Map<string, PanelTerminalNode>,
  findings: PanelConnectivityFinding[]
): void {
  const signaturesByTerminalId = new Map<string, string>();

  for (const occurrence of occurrences) {
    if (
      occurrence.assetId &&
      occurrence.occurrenceKind !== "layout" &&
      ["missing_symbol", "missing_metadata", "ambiguous"].includes(
        occurrence.terminalResolutionStatus
      )
    ) {
      findings.push({
        id: `terminal_resolution:${occurrence.sheetId}:${occurrence.placementId}`,
        severity: "warning",
        code: occurrence.terminalResolutionStatus,
        message:
          occurrence.terminalResolutionMessage ??
          `${occurrence.tag} terminal metadata could not be resolved.`,
        assetId: occurrence.assetId
      });
    }

    if (!occurrence.assetId) {
      continue;
    }

    for (const terminal of occurrence.terminals) {
      const ref = {
        assetId: occurrence.assetId,
        terminalKey: terminal.terminalKey
      };
      const id = terminalNodeId(ref);
      const signature = terminalDefinitionSignature(terminal);
      const existingSignature = signaturesByTerminalId.get(id);
      const existing = terminalsById.get(id);

      if (existingSignature && existingSignature !== signature) {
        findings.push({
          id: `terminal_mismatch:${id}:${occurrence.sheetId}:${occurrence.placementId}`,
          severity: "warning",
          code: "linked_terminal_configuration_mismatch",
          message: `${occurrence.tag}:${terminal.terminalKey} has inconsistent definitions across linked occurrences.`,
          assetId: occurrence.assetId
        });
      }

      if (!existing) {
        terminalsById.set(id, {
          id,
          ref,
          label: terminal.label,
          function: terminal.function,
          supportedSides: [...terminal.supportedSides].sort(),
          requiredSides: terminal.requiredSides
            ? [...terminal.requiredSides].sort()
            : undefined,
          allowedDomains: terminal.allowedDomains
            ? [...terminal.allowedDomains].sort()
            : undefined,
          anchors: [...terminal.anchors].sort((first, second) =>
            first.anchorKey.localeCompare(second.anchorKey)
          ),
          occurrenceRefs: [
            {
              sheetId: occurrence.sheetId,
              placementId: occurrence.placementId
            }
          ]
        });
        signaturesByTerminalId.set(id, signature);
        continue;
      }

      const occurrenceKey = terminalOccurrenceRefKey(
        occurrence.sheetId,
        occurrence.placementId
      );

      if (
        !existing.occurrenceRefs.some(
          (candidate) =>
            terminalOccurrenceRefKey(
              candidate.sheetId,
              candidate.placementId
            ) === occurrenceKey
        )
      ) {
        existing.occurrenceRefs.push({
          sheetId: occurrence.sheetId,
          placementId: occurrence.placementId
        });
      }
    }
  }
}

function addRecordFindings(
  source: PanelWiringSourcePackage,
  graph: Pick<
    PanelConnectivityGraph,
    | "panelAssetIds"
    | "panelAssetIdsByAssetId"
    | "terminalSidesById"
    | "connectionsBySheetConnection"
  >,
  findings: PanelConnectivityFinding[]
): void {
  const wireIds = new Map<string, string>();
  const wireNumbers = new Map<number, string>();
  const mappedSources = new Map<string, string>();

  const validateTerminalSide = ({
    recordId,
    panelAssetId,
    terminal,
    code
  }: {
    recordId: string;
    panelAssetId: string;
    terminal: Parameters<typeof terminalSideNodeId>[0];
    code: string;
  }) => {
    if (!graph.terminalSidesById.has(terminalSideNodeId(terminal))) {
      findings.push({
        id: `${code}:missing_terminal:${recordId}:${terminalSideNodeId(terminal)}`,
        severity: "error",
        code: `${code}_missing_terminal`,
        message: `${recordId} references a terminal side that is not available.`,
        panelAssetId,
        assetId: terminal.assetId,
        terminal
      });
    }

    if (!graph.panelAssetIdsByAssetId.get(terminal.assetId)?.has(panelAssetId)) {
      findings.push({
        id: `${code}:panel_mismatch:${recordId}:${terminal.assetId}`,
        severity: "error",
        code: `${code}_panel_mismatch`,
        message: `${recordId} references an asset outside its panel context.`,
        panelAssetId,
        assetId: terminal.assetId,
        terminal
      });
    }
  };

  for (const sheet of source.sheets) {
    const context = sheet.panelDrawingContext;

    if (context && !graph.panelAssetIds.has(context.panelAssetId)) {
      findings.push({
        id: `missing_panel_context:${sheet.id}`,
        severity: "error",
        code: "missing_panel_context_asset",
        message: `${sheet.name} references a panel asset that is not available.`,
        panelAssetId: context.panelAssetId
      });
    }
  }

  for (const wire of source.panelWiring?.internalWires ?? []) {
    if (!wire.wireNumber) {
      findings.push({
        id: `legacy_internal_wire_identity:${wire.id}`,
        severity: "warning",
        code: "legacy_internal_wire_identity",
        message: `${wire.wireId} uses a legacy wire identity. Review the package upgrade before assigning a Wire #.`,
        panelAssetId: wire.panelAssetId
      });
    } else {
      const duplicateNumberId = wireNumbers.get(wire.wireNumber);
      if (duplicateNumberId) {
        findings.push({
          id: `duplicate_internal_wire_number:${wire.wireNumber}:${wire.id}`,
          severity: "error",
          code: "duplicate_internal_wire_number",
          message: `Wire # ${String(wire.wireNumber).padStart(3, "0")} is already used by internal wire ${duplicateNumberId}.`,
          panelAssetId: wire.panelAssetId
        });
      } else {
        wireNumbers.set(wire.wireNumber, wire.id);
      }
      if (!wire.specification) {
        findings.push({
          id: `missing_wire_catalog_snapshot:${wire.id}`,
          severity: "warning",
          code: "missing_wire_catalog_snapshot",
          message: `${wire.wireId} has no Wire Catalog snapshot. Select an approved specification before issue.`,
          panelAssetId: wire.panelAssetId
        });
      }
    }
    const normalizedWireId = wire.wireId.trim().toUpperCase();
    const duplicateId = wireIds.get(normalizedWireId);

    if (duplicateId) {
      findings.push({
        id: `duplicate_internal_wire:${normalizedWireId}:${wire.id}`,
        severity: "error",
        code: "duplicate_internal_wire_id",
        message: `${wire.wireId} is already used by internal wire ${duplicateId}.`,
        panelAssetId: wire.panelAssetId
      });
    } else {
      wireIds.set(normalizedWireId, wire.id);
    }

    for (const endpoint of [wire.from, wire.to]) {
      validateTerminalSide({
        recordId: wire.id,
        panelAssetId: wire.panelAssetId,
        terminal: endpoint,
        code: "internal_wire"
      });
    }

    if (
      wire.ownerPatternId &&
      !source.panelWiring?.bridges.some(
        (bridge) => bridge.id === wire.ownerPatternId
      )
    ) {
      findings.push({
        id: `orphan_pattern_wire:${wire.id}`,
        severity: "error",
        code: "orphan_pattern_wire",
        message: `${wire.wireId} references a connection pattern that no longer exists.`,
        panelAssetId: wire.panelAssetId
      });
    }
  }

  for (const bridge of source.panelWiring?.bridges ?? []) {
    bridge.members.forEach((terminal) =>
      validateTerminalSide({
        recordId: bridge.id,
        panelAssetId: bridge.panelAssetId,
        terminal,
        code: "bridge"
      })
    );
  }

  for (const bond of source.panelWiring?.bonds ?? []) {
    for (const endpoint of bond.endpoints) {
      if (endpoint.kind === "terminal") {
        validateTerminalSide({
          recordId: bond.id,
          panelAssetId: bond.panelAssetId,
          terminal: endpoint.terminal,
          code: "bond"
        });
      } else if (
        endpoint.panelAssetId !== bond.panelAssetId ||
        !graph.panelAssetIds.has(endpoint.panelAssetId)
      ) {
        findings.push({
          id: `bond:panel_reference:${bond.id}:${endpoint.panelAssetId}`,
          severity: "error",
          code: "bond_panel_reference_mismatch",
          message: `${bond.id} references an unavailable or different panel.`,
          panelAssetId: bond.panelAssetId
        });
      }
    }
  }

  for (const mapping of source.panelWiring?.terminalMappings ?? []) {
    const sourceKey = `${mapping.panelAssetId}:${sourceEndpointKey(mapping.source)}`;
    const duplicateMappingId = mappedSources.get(sourceKey);
    const connection = graph.connectionsBySheetConnection.get(
      sheetConnectionKey(mapping.source.sheetId, mapping.source.connectionId)
    );

    if (duplicateMappingId) {
      findings.push({
        id: `duplicate_terminal_mapping:${mapping.id}`,
        severity: "error",
        code: "duplicate_terminal_mapping",
        message: `${mapping.id} duplicates source mapping ${duplicateMappingId}.`,
        panelAssetId: mapping.panelAssetId,
        source: mapping.source
      });
    } else {
      mappedSources.set(sourceKey, mapping.id);
    }

    if (
      !connection ||
      connection[mapping.source.endpointRole].placementId !==
        mapping.source.placementId ||
      connection[mapping.source.endpointRole].anchorKey !==
        mapping.source.anchorKey
    ) {
      findings.push({
        id: `stale_terminal_mapping:${mapping.id}`,
        severity: "error",
        code: "stale_terminal_mapping_source",
        message: `${mapping.id} references a missing or changed source endpoint.`,
        panelAssetId: mapping.panelAssetId,
        source: mapping.source
      });
    }

    validateTerminalSide({
      recordId: mapping.id,
      panelAssetId: mapping.panelAssetId,
      terminal: mapping.target,
      code: "terminal_mapping"
    });
  }
}

export function buildPackageConnectivityGraphFromValidatedSource(
  source: PanelWiringSourcePackage
): PanelConnectivityGraph {
  const findings: PanelConnectivityFinding[] = [];
  const assetsById = new Map(source.assets.map((asset) => [asset.id, asset]));
  const sheetsById = new Map(source.sheets.map((sheet) => [sheet.id, sheet]));
  const occurrences = source.sheets.flatMap((sheet) => sheet.occurrences);
  const occurrencesByAssetId = new Map<string, PanelWiringSourceOccurrence[]>();
  const occurrencesBySheetPlacement = new Map<
    string,
    PanelWiringSourceOccurrence
  >();
  const connectionsBySheetConnection = new Map(
    source.sheets.flatMap((sheet) =>
      sheet.connections.map((connection) => [
        sheetConnectionKey(sheet.id, connection.id),
        connection
      ] as const)
    )
  );
  const panelAssetIds = new Set(
    source.assets
      .filter((asset) => ["panel", "junction_box"].includes(asset.type))
      .map((asset) => asset.id)
  );

  for (const occurrence of occurrences) {
    occurrencesBySheetPlacement.set(
      sheetPlacementKey(occurrence.sheetId, occurrence.placementId),
      occurrence
    );

    if (occurrence.assetId) {
      appendMapValue(occurrencesByAssetId, occurrence.assetId, occurrence);
    }

    if (occurrence.role === "enclosure" && occurrence.assetId) {
      panelAssetIds.add(occurrence.assetId);
    }
  }

  const assetIdsByPanelAssetId = new Map<string, Set<string>>();
  const panelAssetIdsByAssetId = new Map<string, Set<string>>();

  for (const panelAssetId of panelAssetIds) {
    addNestedSet(assetIdsByPanelAssetId, panelAssetId, panelAssetId);
    addNestedSet(panelAssetIdsByAssetId, panelAssetId, panelAssetId);
  }

  for (const occurrence of occurrences) {
    if (
      occurrence.assetId &&
      occurrence.containerAssetId &&
      panelAssetIds.has(occurrence.containerAssetId) &&
      occurrence.assetId !== occurrence.containerAssetId
    ) {
      addNestedSet(
        assetIdsByPanelAssetId,
        occurrence.containerAssetId,
        occurrence.assetId
      );
      addNestedSet(
        panelAssetIdsByAssetId,
        occurrence.assetId,
        occurrence.containerAssetId
      );
    }
  }

  const terminalsById = new Map<string, PanelTerminalNode>();
  addTerminalNodes(occurrences, terminalsById, findings);

  const terminalSidesById = new Map<string, PanelTerminalSideNode>();

  for (const terminal of terminalsById.values()) {
    for (const side of terminal.supportedSides) {
      const ref = { ...terminal.ref, side };
      const id = terminalSideNodeId(ref);
      terminalSidesById.set(id, {
        id,
        ref,
        terminalId: terminal.id
      });
    }
  }

  const discovery = discoverExternalTerminations({
    source,
    occurrencesBySheetPlacement,
    panelAssetIdsByAssetId,
    terminalsById,
    terminalSideIds: new Set(terminalSidesById.keys())
  });
  findings.push(...discovery.findings);

  const externalTerminationsById = new Map(
    discovery.terminations.map((termination) => [termination.id, termination])
  );
  const externalTerminationIdsByPanelAssetId = new Map<string, string[]>();

  for (const termination of discovery.terminations) {
    appendMapValue(
      externalTerminationIdsByPanelAssetId,
      termination.panelAssetId,
      termination.id
    );
  }

  const internalWiresById = new Map(
    (source.panelWiring?.internalWires ?? []).map((wire) => [wire.id, wire])
  );
  const bridgesById = new Map(
    (source.panelWiring?.bridges ?? []).map((bridge) => [bridge.id, bridge])
  );
  const bondsById = new Map(
    (source.panelWiring?.bonds ?? []).map((bond) => [bond.id, bond])
  );
  const graph: PanelConnectivityGraph = {
    source,
    assetsById,
    sheetsById,
    occurrencesByAssetId,
    occurrencesBySheetPlacement,
    connectionsBySheetConnection,
    panelAssetIds,
    assetIdsByPanelAssetId,
    panelAssetIdsByAssetId,
    terminalsById,
    terminalSidesById,
    externalTerminationsById,
    externalTerminationIdsByPanelAssetId,
    internalWiresById,
    bridgesById,
    bondsById,
    electricalNodesById: new Map(),
    conductiveRelationshipsById: new Map(),
    relationshipIdsByElectricalNodeId: new Map(),
    electricalNetsById: new Map(),
    electricalNetIdByNodeId: new Map(),
    findings
  };

  addRecordFindings(source, graph, findings);
  const patternValidationIndex = buildPanelPatternValidationIndex(graph);
  for (const bridge of graph.bridgesById.values()) {
    findings.push(
      ...validatePanelConnectionPattern({
        graph,
        candidate: { recordType: "bridge", record: bridge },
        index: patternValidationIndex
      })
    );
  }
  for (const bond of graph.bondsById.values()) {
    findings.push(
      ...validatePanelConnectionPattern({
        graph,
        candidate: { recordType: "bond", record: bond },
        index: patternValidationIndex
      })
    );
  }
  const networkIndex = buildElectricalNetworkIndex(graph);
  graph.electricalNodesById = networkIndex.electricalNodesById;
  graph.conductiveRelationshipsById =
    networkIndex.conductiveRelationshipsById;
  graph.relationshipIdsByElectricalNodeId =
    networkIndex.relationshipIdsByElectricalNodeId;
  graph.electricalNetsById = networkIndex.electricalNetsById;
  graph.electricalNetIdByNodeId = networkIndex.electricalNetIdByNodeId;
  findings.push(...networkIndex.findings);
  const uniqueFindings = new Map(findings.map((finding) => [finding.id, finding]));
  graph.findings.splice(0, graph.findings.length, ...uniqueFindings.values());
  graph.findings.sort((first, second) => first.id.localeCompare(second.id));

  return graph;
}

export function buildPackageConnectivityGraph(
  input: PanelWiringSourcePackage
): PanelConnectivityGraph {
  return buildPackageConnectivityGraphFromValidatedSource(
    panelWiringSourcePackageSchema.parse(input)
  );
}

export function getTerminalByRef(
  graph: PanelConnectivityGraph,
  ref: PanelTerminalRef
): PanelTerminalNode | undefined {
  return graph.terminalsById.get(terminalNodeId(ref));
}

export function getExternalTerminationProvenance(
  graph: PanelConnectivityGraph,
  terminationId: string
): PanelExternalTermination | undefined {
  return graph.externalTerminationsById.get(terminationId);
}

function belongsToPanel(
  graph: PanelConnectivityGraph,
  assetId: string,
  panelAssetId: string
): boolean {
  return graph.assetIdsByPanelAssetId.get(panelAssetId)?.has(assetId) ?? false;
}

export function getPanelConnectivitySnapshot(
  graph: PanelConnectivityGraph,
  panelAssetId?: string
): PanelConnectivitySnapshot {
  const assetIds = panelAssetId
    ? graph.assetIdsByPanelAssetId.get(panelAssetId) ?? new Set<string>()
    : new Set(graph.assetsById.keys());
  const assets = [...assetIds]
    .map((assetId) => graph.assetsById.get(assetId))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .sort((first, second) =>
      first.tag.localeCompare(second.tag, undefined, { numeric: true })
    );
  const occurrences = [...assetIds]
    .flatMap((assetId) => graph.occurrencesByAssetId.get(assetId) ?? [])
    .sort((first, second) =>
      `${first.sheetId}:${first.placementId}`.localeCompare(
        `${second.sheetId}:${second.placementId}`
      )
    );
  const terminals = [...graph.terminalsById.values()]
    .filter(
      (terminal) =>
        !panelAssetId || belongsToPanel(graph, terminal.ref.assetId, panelAssetId)
    )
    .sort((first, second) => first.id.localeCompare(second.id));
  const terminalIds = new Set(terminals.map((terminal) => terminal.id));
  const terminalSides = [...graph.terminalSidesById.values()]
    .filter((side) => terminalIds.has(side.terminalId))
    .sort((first, second) => first.id.localeCompare(second.id));
  const externalTerminations = (
    panelAssetId
      ? (graph.externalTerminationIdsByPanelAssetId.get(panelAssetId) ?? []).map(
          (id) => graph.externalTerminationsById.get(id)
        )
      : [...graph.externalTerminationsById.values()]
  )
    .filter(
      (termination): termination is PanelExternalTermination =>
        Boolean(termination)
    )
    .sort((first, second) => first.id.localeCompare(second.id));
  const filterByPanel = <T extends { panelAssetId: string }>(records: T[]) =>
    records
      .filter((record) => !panelAssetId || record.panelAssetId === panelAssetId)
      .sort((first, second) =>
        ("id" in first ? String(first.id) : "").localeCompare(
          "id" in second ? String(second.id) : ""
        )
      );

  return {
    panelAssetId,
    assets,
    occurrences,
    terminals,
    terminalSides,
    externalTerminations,
    internalWires: filterByPanel([...graph.internalWiresById.values()]),
    bridges: filterByPanel([...graph.bridgesById.values()]),
    bonds: filterByPanel([...graph.bondsById.values()]),
    electricalNets: [...graph.electricalNetsById.values()]
      .filter(
        (net) =>
          !panelAssetId ||
          net.assetIds.some((assetId) => belongsToPanel(graph, assetId, panelAssetId)) ||
          net.panelAssetIds.includes(panelAssetId)
      )
      .sort((first, second) => first.id.localeCompare(second.id)),
    conductiveRelationships: [...graph.conductiveRelationshipsById.values()]
      .filter(
        (relationship) =>
          !panelAssetId ||
          relationship.nodeIds.some((nodeId) => {
            const node = graph.electricalNodesById.get(nodeId);
            return node?.kind === "panel_reference"
              ? node.panelAssetId === panelAssetId
              : Boolean(
                  node?.kind === "terminal_side" &&
                    belongsToPanel(
                      graph,
                      node.terminal.assetId,
                      panelAssetId
                    )
                );
          })
      )
      .sort((first, second) => first.id.localeCompare(second.id)),
    findings: graph.findings.filter(
      (finding) =>
        !panelAssetId ||
        finding.panelAssetId === panelAssetId ||
        Boolean(
          finding.assetId && belongsToPanel(graph, finding.assetId, panelAssetId)
        )
    )
  };
}

export function getElectricalNetForTerminalSide(
  graph: PanelConnectivityGraph,
  terminal: Parameters<typeof terminalSideNodeId>[0]
) {
  const netId = graph.electricalNetIdByNodeId.get(terminalSideNodeId(terminal));
  return netId ? graph.electricalNetsById.get(netId) : undefined;
}

export function listElectricalNetsForAsset(
  graph: PanelConnectivityGraph,
  assetId: string
) {
  return [...graph.electricalNetsById.values()]
    .filter((net) => net.assetIds.includes(assetId))
    .sort((first, second) => first.id.localeCompare(second.id));
}

export function listElectricalNetworkConnections(
  graph: PanelConnectivityGraph,
  netId: string
) {
  const net = graph.electricalNetsById.get(netId);
  if (!net) return [];
  return net.relationshipIds
    .map((relationshipId) =>
      graph.conductiveRelationshipsById.get(relationshipId)
    )
    .filter(
      (relationship): relationship is NonNullable<typeof relationship> =>
        Boolean(relationship)
    );
}

export function traceElectricalPath(
  graph: PanelConnectivityGraph,
  input: { fromNodeId: string; toNodeId: string }
) {
  return traceElectricalPathInIndex({ index: graph, ...input });
}
