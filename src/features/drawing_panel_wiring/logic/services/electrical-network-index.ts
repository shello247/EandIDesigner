import type {
  PanelTerminalSideRef,
  PanelWiringSourceOccurrence,
  PanelWiringSourcePackage
} from "../../data/schema";
import type {
  PanelBondRecord,
  PanelBridgeRecord,
  PanelConductiveRelationship,
  PanelConnectivityFinding,
  PanelElectricalNet,
  PanelElectricalNode,
  PanelElectricalPath,
  PanelExternalTermination,
  PanelInternalWireRecord,
  PanelTerminalNode,
  PanelTerminalSideNode,
  PanelWiringSourceConnection
} from "../../types";
import {
  resolveOccurrenceTerminalByAnchor,
  sheetPlacementKey,
  terminalNodeId,
  terminalSideNodeId
} from "./terminal-resolution";

type NetworkSource = {
  source: PanelWiringSourcePackage;
  occurrencesByAssetId: ReadonlyMap<string, PanelWiringSourceOccurrence[]>;
  occurrencesBySheetPlacement: ReadonlyMap<string, PanelWiringSourceOccurrence>;
  panelAssetIdsByAssetId: ReadonlyMap<string, ReadonlySet<string>>;
  terminalsById: ReadonlyMap<string, PanelTerminalNode>;
  terminalSidesById: ReadonlyMap<string, PanelTerminalSideNode>;
  externalTerminationsById: ReadonlyMap<string, PanelExternalTermination>;
  internalWiresById: ReadonlyMap<string, PanelInternalWireRecord>;
  bridgesById: ReadonlyMap<string, PanelBridgeRecord>;
  bondsById: ReadonlyMap<string, PanelBondRecord>;
};

export type PanelElectricalNetworkIndex = {
  electricalNodesById: ReadonlyMap<string, PanelElectricalNode>;
  conductiveRelationshipsById: ReadonlyMap<
    string,
    PanelConductiveRelationship
  >;
  relationshipIdsByElectricalNodeId: ReadonlyMap<string, string[]>;
  electricalNetsById: ReadonlyMap<string, PanelElectricalNet>;
  electricalNetIdByNodeId: ReadonlyMap<string, string>;
  findings: PanelConnectivityFinding[];
};

function naturalCompare(first: string, second: string): number {
  return first.localeCompare(second, undefined, { numeric: true });
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(naturalCompare);
}

function panelReferenceNodeId(input: {
  panelAssetId: string;
  referenceKind: "shield" | "protective_earth" | "signal_ground";
  key?: string;
}): string {
  return [
    "panel_reference",
    encodeURIComponent(input.panelAssetId),
    input.referenceKind,
    encodeURIComponent(input.key ?? "default")
  ].join(":");
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function topologySignature(
  topology: PanelWiringSourceOccurrence["electricalTopology"]
): string {
  if (!topology) return "none";
  return JSON.stringify(
    topology.permanentContinuityGroups
      .map((group) => ({
        key: group.key,
        symbolId: group.symbolId,
        versionId: group.versionId,
        terminalKeys: uniqueSorted(group.terminalKeys)
      }))
      .sort((first, second) => naturalCompare(first.key, second.key))
  );
}

function connectionEndpointKey(
  sheetId: string,
  connectionId: string,
  endpointRole: "from" | "to"
): string {
  return `${encodeURIComponent(sheetId)}:${encodeURIComponent(connectionId)}:${endpointRole}`;
}

type EndpointNodeIndex = {
  externalNodeIdByConnectionEndpoint: ReadonlyMap<string, string>;
};

function buildEndpointNodeIndex(source: NetworkSource): EndpointNodeIndex {
  const externalNodeIdByConnectionEndpoint = new Map<string, string>();
  for (const termination of source.externalTerminationsById.values()) {
    if (termination.status !== "resolved" || !termination.target) continue;
    const key = connectionEndpointKey(
      termination.source.sheetId,
      termination.source.connectionId,
      termination.source.endpointRole
    );
    // The previous linear search returned the first resolved candidate.
    if (!externalNodeIdByConnectionEndpoint.has(key)) {
      externalNodeIdByConnectionEndpoint.set(
        key,
        terminalSideNodeId(termination.target)
      );
    }
  }

  return { externalNodeIdByConnectionEndpoint };
}

function resolveEndpointNodeId({
  source,
  endpointNodeIndex,
  sheetId,
  connection,
  endpointRole
}: {
  source: NetworkSource;
  endpointNodeIndex: EndpointNodeIndex;
  sheetId: string;
  connection: PanelWiringSourceConnection;
  endpointRole: "from" | "to";
}): string | undefined {
  const externalNodeId =
    endpointNodeIndex.externalNodeIdByConnectionEndpoint.get(
      connectionEndpointKey(sheetId, connection.id, endpointRole)
    );
  if (externalNodeId) return externalNodeId;

  const endpoint = connection[endpointRole];
  const occurrence = source.occurrencesBySheetPlacement.get(
    sheetPlacementKey(sheetId, endpoint.placementId)
  );
  if (!occurrence?.assetId) return undefined;
  const terminal = resolveOccurrenceTerminalByAnchor(
    occurrence,
    endpoint.anchorKey
  );
  if (!terminal) return undefined;
  const anchor = terminal.anchors.find(
    (candidate) => candidate.anchorKey === endpoint.anchorKey
  );
  const side =
    anchor?.sideHint ??
    (terminal.supportedSides.length === 1
      ? terminal.supportedSides[0]
      : undefined);
  if (!side) return undefined;
  const id = terminalSideNodeId({
    assetId: occurrence.assetId,
    terminalKey: terminal.terminalKey,
    side
  });
  return source.terminalSidesById.has(id) ? id : undefined;
}

function relationship(
  input: Omit<PanelConductiveRelationship, "nodeIds"> & {
    nodeIds: Iterable<string>;
  }
): PanelConductiveRelationship | undefined {
  const nodeIds = uniqueSorted(input.nodeIds);
  if (nodeIds.length < 2) return undefined;
  return { ...input, nodeIds };
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    const parent = this.parent.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(first: string, second: string): void {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot === secondRoot) return;
    const [parent, child] = [firstRoot, secondRoot].sort(naturalCompare);
    this.parent.set(child, parent);
  }
}

function addRelationship(
  relationships: Map<string, PanelConductiveRelationship>,
  candidate: PanelConductiveRelationship | undefined
): void {
  if (candidate) relationships.set(candidate.id, candidate);
}

function terminalAssetId(
  node: PanelElectricalNode | undefined
): string | undefined {
  return node?.kind === "terminal_side" ? node.terminal.assetId : undefined;
}

export function buildElectricalNetworkIndex(
  source: NetworkSource
): PanelElectricalNetworkIndex {
  const findings: PanelConnectivityFinding[] = [];
  const endpointNodeIndex = buildEndpointNodeIndex(source);
  const electricalNodesById = new Map<string, PanelElectricalNode>();
  for (const side of source.terminalSidesById.values()) {
    electricalNodesById.set(side.id, {
      id: side.id,
      kind: "terminal_side",
      terminal: side.ref
    });
  }

  const conductiveRelationshipsById = new Map<
    string,
    PanelConductiveRelationship
  >();

  for (const terminal of source.terminalsById.values()) {
    const nodeIds = terminal.supportedSides
      .map((side) => terminalSideNodeId({ ...terminal.ref, side }))
      .filter((id) => electricalNodesById.has(id));
    addRelationship(
      conductiveRelationshipsById,
      relationship({
        id: `terminal_body:${terminal.id}`,
        kind: "terminal_body",
        nodeIds,
        provenance: {
          label: `${terminal.label} terminal body`,
          assetId: terminal.ref.assetId
        }
      })
    );
  }

  for (const [assetId, occurrences] of source.occurrencesByAssetId) {
    const signatures = new Set(
      occurrences.map((occurrence) =>
        topologySignature(occurrence.electricalTopology)
      )
    );
    if (signatures.size > 1) {
      findings.push({
        id: `linked_internal_topology_mismatch:${assetId}`,
        severity: "error",
        code: "linked_internal_topology_mismatch",
        message:
          "Linked representations of this asset declare different permanent internal topology. Connectivity was excluded.",
        assetId
      });
      continue;
    }
    const topology = occurrences[0]?.electricalTopology;
    for (const group of topology?.permanentContinuityGroups ?? []) {
      const missingKeys = group.terminalKeys.filter((terminalKey) => {
        const terminal = source.terminalsById.get(
          terminalNodeId({ assetId, terminalKey })
        );
        return !terminal;
      });
      if (missingKeys.length > 0) {
        findings.push({
          id: `invalid_registry_topology:${assetId}:${group.key}`,
          severity: "error",
          code: "registry_topology_missing_terminal",
          message: `Permanent continuity group ${group.key} references unavailable terminal keys: ${missingKeys.join(", ")}.`,
          assetId
        });
        continue;
      }
      const nodeIds = group.terminalKeys.flatMap((terminalKey) => {
        const terminal = source.terminalsById.get(
          terminalNodeId({ assetId, terminalKey })
        );
        return terminal
          ? terminal.supportedSides.map((side) =>
              terminalSideNodeId({ assetId, terminalKey, side })
            )
          : [];
      });
      addRelationship(
        conductiveRelationshipsById,
        relationship({
          id: `registry_continuity:${encodeURIComponent(assetId)}:${encodeURIComponent(group.key)}`,
          kind: "registry_continuity",
          nodeIds,
          provenance: {
            label: group.label ?? `Permanent continuity ${group.key}`,
            assetId,
            symbolId: group.symbolId,
            versionId: group.versionId,
            continuityGroupKey: group.key,
            continuityGroupLabel: group.label
          }
        })
      );
    }
  }

  for (const sheet of source.source.sheets) {
    for (const connection of sheet.connections) {
      if (connection.panelConnectionId || connection.panelPatternId) continue;
      const fromNodeId = resolveEndpointNodeId({
        source,
        endpointNodeIndex,
        sheetId: sheet.id,
        connection,
        endpointRole: "from"
      });
      const toNodeId = resolveEndpointNodeId({
        source,
        endpointNodeIndex,
        sheetId: sheet.id,
        connection,
        endpointRole: "to"
      });
      if (!fromNodeId || !toNodeId) {
        const unresolvedEndpoint = !fromNodeId ? connection.from : connection.to;
        const unresolvedOccurrence = source.occurrencesBySheetPlacement.get(
          sheetPlacementKey(sheet.id, unresolvedEndpoint.placementId)
        );
        const panelAssetId = unresolvedOccurrence?.assetId
          ? uniqueSorted(
              source.panelAssetIdsByAssetId.get(unresolvedOccurrence.assetId) ?? []
            )[0]
          : undefined;
        findings.push({
          id: `unresolved_electrical_network_endpoint:${sheet.id}:${connection.id}`,
          severity: "warning",
          code: "unresolved_electrical_network_endpoint",
          message: `Connection ${connection.label ?? connection.id} could not be resolved into the electrical network.`,
          panelAssetId,
          assetId: unresolvedOccurrence?.assetId,
          source: {
            sheetId: sheet.id,
            connectionId: connection.id,
            endpointRole: !fromNodeId ? "from" : "to",
            placementId: !fromNodeId
              ? connection.from.placementId
              : connection.to.placementId,
            anchorKey: !fromNodeId
              ? connection.from.anchorKey
              : connection.to.anchorKey
          }
        });
        continue;
      }
      addRelationship(
        conductiveRelationshipsById,
        relationship({
          id: `drawing_connection:${encodeURIComponent(sheet.id)}:${encodeURIComponent(connection.id)}`,
          kind: "drawing_connection",
          nodeIds: [fromNodeId, toNodeId],
          provenance: {
            label: connection.label ?? connection.wireId ?? connection.id,
            sheetId: sheet.id,
            sheetNumber: sheet.sheetNumber,
            sheetName: sheet.name,
            connectionId: connection.id,
            wireId: connection.wireId,
            cableTag: connection.cableTag,
            conductorKey: connection.conductorKey
          }
        })
      );
    }
  }

  for (const wire of source.internalWiresById.values()) {
    addRelationship(
      conductiveRelationshipsById,
      relationship({
        id: `internal_wire:${encodeURIComponent(wire.id)}`,
        kind: "internal_wire",
        nodeIds: [terminalSideNodeId(wire.from), terminalSideNodeId(wire.to)],
        provenance: {
          label: wire.wireId,
          panelAssetId: wire.panelAssetId,
          wireId: wire.wireId,
          recordId: wire.id
        }
      })
    );
  }

  for (const bridge of source.bridgesById.values()) {
    const topology = bridge.definition?.topology;
    const isPermanent =
      topology === "terminal_jumper" ||
      topology === "bridge_bar" ||
      (!topology && (bridge.kind === "jumper" || bridge.kind === "bridge"));
    if (!isPermanent) continue;
    addRelationship(
      conductiveRelationshipsById,
      relationship({
        id: `bridge:${encodeURIComponent(bridge.id)}`,
        kind: "bridge",
        nodeIds: bridge.members.map(terminalSideNodeId),
        provenance: {
          label: bridge.label ?? bridge.patternCode ?? bridge.id,
          panelAssetId: bridge.panelAssetId,
          recordId: bridge.id,
          sheetId: bridge.createdOnSheetId
        }
      })
    );
  }

  for (const bond of source.bondsById.values()) {
    const nodeIds = bond.endpoints.map((endpoint) => {
      if (endpoint.kind === "terminal") {
        return terminalSideNodeId(endpoint.terminal);
      }
      const id = panelReferenceNodeId(endpoint);
      electricalNodesById.set(id, { id, ...endpoint });
      return id;
    });
    addRelationship(
      conductiveRelationshipsById,
      relationship({
        id: `bond:${encodeURIComponent(bond.id)}`,
        kind: "bond",
        nodeIds,
        provenance: {
          label: bond.label ?? bond.patternCode ?? bond.id,
          panelAssetId: bond.panelAssetId,
          recordId: bond.id,
          sheetId: bond.createdOnSheetId
        }
      })
    );
  }

  const relationshipIdsByElectricalNodeId = new Map<string, string[]>();
  const unionFind = new UnionFind();
  for (const nodeId of electricalNodesById.keys()) unionFind.add(nodeId);
  for (const candidate of conductiveRelationshipsById.values()) {
    const validNodeIds = candidate.nodeIds.filter((nodeId) =>
      electricalNodesById.has(nodeId)
    );
    if (validNodeIds.length !== candidate.nodeIds.length) {
      findings.push({
        id: `network_relationship_missing_node:${candidate.id}`,
        severity: "error",
        code: "network_relationship_missing_node",
        message: `${candidate.provenance.label} references an unavailable electrical node.`
      });
      conductiveRelationshipsById.delete(candidate.id);
      continue;
    }
    for (const nodeId of validNodeIds) {
      const relationshipIds =
        relationshipIdsByElectricalNodeId.get(nodeId) ?? [];
      relationshipIds.push(candidate.id);
      relationshipIdsByElectricalNodeId.set(nodeId, relationshipIds);
    }
    const first = validNodeIds[0];
    for (const nodeId of validNodeIds.slice(1)) unionFind.union(first, nodeId);
  }
  for (const [nodeId, relationshipIds] of relationshipIdsByElectricalNodeId) {
    relationshipIdsByElectricalNodeId.set(
      nodeId,
      uniqueSorted(relationshipIds)
    );
  }

  const nodeIdsByRoot = new Map<string, string[]>();
  for (const nodeId of electricalNodesById.keys()) {
    const root = unionFind.find(nodeId);
    nodeIdsByRoot.set(root, [...(nodeIdsByRoot.get(root) ?? []), nodeId]);
  }
  const electricalNetsById = new Map<string, PanelElectricalNet>();
  const electricalNetIdByNodeId = new Map<string, string>();
  for (const nodeIdsValue of nodeIdsByRoot.values()) {
    const nodeIds = uniqueSorted(nodeIdsValue);
    const relationshipIds = uniqueSorted(
      nodeIds.flatMap(
        (nodeId) => relationshipIdsByElectricalNodeId.get(nodeId) ?? []
      )
    );
    const terminalSideIds = nodeIds.filter(
      (nodeId) => electricalNodesById.get(nodeId)?.kind === "terminal_side"
    );
    const assetIds = uniqueSorted(
      nodeIds
        .map((nodeId) => terminalAssetId(electricalNodesById.get(nodeId)))
        .filter((assetId): assetId is string => Boolean(assetId))
    );
    const panelAssetIds = uniqueSorted(
      nodeIds.flatMap((nodeId) => {
        const node = electricalNodesById.get(nodeId);
        return node?.kind === "panel_reference" ? [node.panelAssetId] : [];
      })
    );
    const id = `net:${stableHash(nodeIds.join("|"))}`;
    const net = {
      id,
      nodeIds,
      relationshipIds,
      terminalSideIds,
      assetIds,
      panelAssetIds
    };
    electricalNetsById.set(id, net);
    for (const nodeId of nodeIds) electricalNetIdByNodeId.set(nodeId, id);
  }

  return {
    electricalNodesById,
    conductiveRelationshipsById,
    relationshipIdsByElectricalNodeId,
    electricalNetsById,
    electricalNetIdByNodeId,
    findings: findings.sort((first, second) => naturalCompare(first.id, second.id))
  };
}

export function traceElectricalPathInIndex({
  index,
  fromNodeId,
  toNodeId
}: {
  index: PanelElectricalNetworkIndex;
  fromNodeId: string;
  toNodeId: string;
}): PanelElectricalPath | undefined {
  const netId = index.electricalNetIdByNodeId.get(fromNodeId);
  if (!netId || index.electricalNetIdByNodeId.get(toNodeId) !== netId) {
    return undefined;
  }
  if (fromNodeId === toNodeId) {
    return { netId, fromNodeId, toNodeId, steps: [] };
  }
  const queue = [fromNodeId];
  const visited = new Set([fromNodeId]);
  const previous = new Map<
    string,
    { nodeId: string; relationshipId: string }
  >();
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const relationshipIds =
      index.relationshipIdsByElectricalNodeId.get(nodeId) ?? [];
    for (const relationshipId of relationshipIds) {
      const candidate = index.conductiveRelationshipsById.get(relationshipId);
      if (!candidate) continue;
      for (const nextNodeId of candidate.nodeIds) {
        if (visited.has(nextNodeId)) continue;
        visited.add(nextNodeId);
        previous.set(nextNodeId, { nodeId, relationshipId });
        if (nextNodeId === toNodeId) queue.length = 0;
        else queue.push(nextNodeId);
      }
    }
  }
  if (!previous.has(toNodeId)) return undefined;
  const steps: PanelElectricalPath["steps"] = [];
  let current = toNodeId;
  while (current !== fromNodeId) {
    const preceding = previous.get(current);
    if (!preceding) return undefined;
    const candidate = index.conductiveRelationshipsById.get(
      preceding.relationshipId
    );
    if (!candidate) return undefined;
    steps.push({
      fromNodeId: preceding.nodeId,
      toNodeId: current,
      relationship: candidate
    });
    current = preceding.nodeId;
  }
  steps.reverse();
  return { netId, fromNodeId, toNodeId, steps };
}

export function electricalNodeIdForTerminalSide(
  terminal: PanelTerminalSideRef
): string {
  return terminalSideNodeId(terminal);
}
