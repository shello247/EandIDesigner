import { traceElectricalPath } from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelConnectivityGraph,
  PanelElectricalPath,
  PanelTerminalSideNode
} from "@/features/drawing_panel_wiring/types";
import type {
  PanelAnalysisAffectedRecord,
  PanelAnalysisEvidence,
  PanelAnalysisLocation
} from "../../data/schema";

type CommunicationPathSource = {
  assetId: string;
  terminalKey: string;
  roleLabel: string;
};

export type PanelAnalysisIncompletePathEvidence = {
  assetIds: string[];
  affectedRecords: PanelAnalysisAffectedRecord[];
  evidence: PanelAnalysisEvidence[];
  locations: PanelAnalysisLocation[];
  stoppingTerminalLabel: string;
};

type TracedStoppingPoint = {
  path: PanelElectricalPath;
  stopNode: PanelTerminalSideNode;
};

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function boundedEvidence(value: string): string {
  if (value.length <= 950) return value;
  return `${value.slice(0, 460)} … ${value.slice(-460)}`;
}

function sheetLabel(
  graph: PanelConnectivityGraph,
  sheetId: string | undefined
): string | undefined {
  if (!sheetId) return undefined;
  const sheet = graph.sheetsById.get(sheetId);
  return sheet ? `Sheet ${sheet.sheetNumber} — ${sheet.name}` : undefined;
}

function cableTerminalLabel(terminalKey: string, fallbackLabel: string): string {
  const keyMatch = /^CORE0*(\d+)_([A-Z0-9]+)$/i.exec(terminalKey);
  if (keyMatch) {
    return `Core ${Number(keyMatch[1])} end ${keyMatch[2].toUpperCase()}`;
  }
  const labelMatch = /^0*(\d+)\s*([A-Z])$/i.exec(fallbackLabel);
  return labelMatch
    ? `Core ${Number(labelMatch[1])} end ${labelMatch[2].toUpperCase()}`
    : fallbackLabel;
}

function terminalSideLabel({
  graph,
  node,
  source
}: {
  graph: PanelConnectivityGraph;
  node: PanelTerminalSideNode;
  source: CommunicationPathSource;
}): string {
  const asset = graph.assetsById.get(node.ref.assetId);
  const terminal = graph.terminalsById.get(node.terminalId);
  const anchor = terminal?.anchors.find(
    (candidate) => candidate.sideHint === node.ref.side
  ) ?? (terminal?.anchors.length === 1 ? terminal.anchors[0] : undefined);
  const terminalLabel = anchor?.anchorKey ?? terminal?.label ?? node.ref.terminalKey;
  const assetLabel = asset?.tag ?? "Unknown asset";

  if (
    node.ref.assetId === source.assetId &&
    node.ref.terminalKey === source.terminalKey
  ) {
    return `${assetLabel} terminal ${terminalLabel} (${source.roleLabel})`;
  }
  if (asset?.type === "cable") {
    return `${assetLabel} ${cableTerminalLabel(node.ref.terminalKey, terminal?.label ?? terminalLabel)}`;
  }
  return node.ref.side === "single"
    ? `${assetLabel} terminal ${terminalLabel}`
    : `${assetLabel} ${terminalLabel} (${node.ref.side} side)`;
}

function selectStoppingPoint({
  graph,
  source
}: {
  graph: PanelConnectivityGraph;
  source: CommunicationPathSource;
}): TracedStoppingPoint | undefined {
  const sourceNodes = [...graph.terminalSidesById.values()]
    .filter(
      (node) =>
        node.ref.assetId === source.assetId &&
        node.ref.terminalKey === source.terminalKey
    )
    .sort((first, second) => first.id.localeCompare(second.id));
  const candidates: TracedStoppingPoint[] = [];

  for (const sourceNode of sourceNodes) {
    const netId = graph.electricalNetIdByNodeId.get(sourceNode.id);
    const net = netId ? graph.electricalNetsById.get(netId) : undefined;
    if (!net) continue;
    const terminalCandidates = net.terminalSideIds
      .flatMap((nodeId) => {
        const node = graph.terminalSidesById.get(nodeId);
        return node && node.ref.assetId !== source.assetId ? [node] : [];
      })
      .sort((first, second) => first.id.localeCompare(second.id));
    const leafCandidates = terminalCandidates.filter(
      (node) =>
        (graph.relationshipIdsByElectricalNodeId.get(node.id)?.length ?? 0) <= 1
    );
    const stoppingCandidates =
      leafCandidates.length > 0 ? leafCandidates : terminalCandidates;

    for (const stopNode of stoppingCandidates) {
      const path = traceElectricalPath(graph, {
        fromNodeId: sourceNode.id,
        toNodeId: stopNode.id
      });
      if (path) candidates.push({ path, stopNode });
    }
  }

  return candidates.sort(
    (first, second) =>
      second.path.steps.length - first.path.steps.length ||
      first.stopNode.id.localeCompare(second.stopNode.id)
  )[0];
}

function pathLocation(
  graph: PanelConnectivityGraph,
  path: PanelElectricalPath,
  stopNode: PanelTerminalSideNode
): PanelAnalysisLocation | undefined {
  for (const step of [...path.steps].reverse()) {
    const provenance = step.relationship.provenance;
    if (provenance.sheetId && provenance.connectionId) {
      const sheet = graph.sheetsById.get(provenance.sheetId);
      if (sheet) {
        return {
          sheetId: sheet.id,
          sheetNumber: sheet.sheetNumber,
          sheetName: sheet.name,
          objectKind: "connection",
          objectId: provenance.connectionId
        };
      }
    }
    if (step.relationship.kind === "internal_wire" && provenance.recordId) {
      const representedConnection = [
        ...graph.connectionsBySheetConnection.values()
      ].find(
        (connection) => connection.panelConnectionId === provenance.recordId
      );
      const sheet = representedConnection
        ? graph.sheetsById.get(representedConnection.sheetId)
        : undefined;
      if (representedConnection && sheet) {
        return {
          sheetId: sheet.id,
          sheetNumber: sheet.sheetNumber,
          sheetName: sheet.name,
          objectKind: "connection",
          objectId: representedConnection.id
        };
      }
    }
  }

  const occurrence = graph.occurrencesByAssetId
    .get(stopNode.ref.assetId)
    ?.find((candidate) => candidate.occurrenceKind === "wiring");
  const sheet = occurrence ? graph.sheetsById.get(occurrence.sheetId) : undefined;
  return occurrence && sheet
    ? {
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        objectKind: "placement",
        objectId: occurrence.placementId
      }
    : undefined;
}

function conductorEvidence(
  graph: PanelConnectivityGraph,
  path: PanelElectricalPath,
  source: CommunicationPathSource
): string[] {
  return path.steps.flatMap((step) => {
    if (
      step.relationship.kind !== "drawing_connection" &&
      step.relationship.kind !== "internal_wire"
    ) {
      return [];
    }
    const provenance = step.relationship.provenance;
    const fromNode = graph.terminalSidesById.get(step.fromNodeId);
    const toNode = graph.terminalSidesById.get(step.toNodeId);
    const endpoints =
      fromNode && toNode
        ? `${terminalSideLabel({ graph, node: fromNode, source })} → ${terminalSideLabel({ graph, node: toNode, source })}`
        : provenance.label;
    const identity = unique([
      provenance.wireId,
      provenance.cableTag ? `Cable ${provenance.cableTag}` : undefined,
      provenance.conductorKey
        ? cableTerminalLabel(provenance.conductorKey, provenance.conductorKey)
        : undefined
    ]).join(" · ");
    const location = sheetLabel(graph, provenance.sheetId);
    return [
      `${identity || "Unnumbered connection"}: ${endpoints}${location ? ` — ${location}` : ""}`
    ];
  });
}

function affectedPathRecords(
  graph: PanelConnectivityGraph,
  path: PanelElectricalPath,
  stopNode: PanelTerminalSideNode
): PanelAnalysisAffectedRecord[] {
  const records: PanelAnalysisAffectedRecord[] = [
    {
      kind: "terminal",
      id: `${stopNode.ref.assetId}:${stopNode.ref.terminalKey}:${stopNode.ref.side}`,
      label: graph.assetsById.get(stopNode.ref.assetId)?.tag,
      assetId: stopNode.ref.assetId,
      terminalKey: stopNode.ref.terminalKey,
      terminalSide: stopNode.ref.side
    }
  ];

  for (const step of path.steps) {
    const provenance = step.relationship.provenance;
    if (step.relationship.kind === "drawing_connection" && provenance.connectionId) {
      records.push({
        kind: "connection",
        id: provenance.connectionId,
        label: provenance.wireId ?? "Unnumbered connection"
      });
    } else if (
      step.relationship.kind === "internal_wire" &&
      provenance.recordId
    ) {
      records.push({
        kind: "internal_wire",
        id: provenance.recordId,
        label: provenance.wireId
      });
    }
  }

  return [...new Map(records.map((record) => [`${record.kind}:${record.id}`, record])).values()];
}

export function buildIncompleteCommunicationPathEvidence({
  graph,
  source
}: {
  graph: PanelConnectivityGraph;
  source: CommunicationPathSource;
}): PanelAnalysisIncompletePathEvidence {
  const traced = selectStoppingPoint({ graph, source });
  const sourceAsset = graph.assetsById.get(source.assetId);
  const sourceTerminal = [...graph.terminalSidesById.values()].find(
    (node) =>
      node.ref.assetId === source.assetId &&
      node.ref.terminalKey === source.terminalKey
  );
  const sourceLabel = sourceTerminal
    ? terminalSideLabel({ graph, node: sourceTerminal, source })
    : `${sourceAsset?.tag ?? "Unknown asset"} terminal ${source.terminalKey} (${source.roleLabel})`;

  if (!traced) {
    return {
      assetIds: [source.assetId],
      affectedRecords: [],
      evidence: [
        { label: "Traced path", value: sourceLabel },
        {
          label: "Stops at",
          value: `${sourceLabel} — no connected conductor leaves this terminal.`
        }
      ],
      locations: [],
      stoppingTerminalLabel: sourceLabel
    };
  }

  const nodes = [
    traced.path.fromNodeId,
    ...traced.path.steps.map((step) => step.toNodeId)
  ].flatMap((nodeId) => {
    const node = graph.terminalSidesById.get(nodeId);
    return node ? [terminalSideLabel({ graph, node, source })] : [];
  });
  const location = pathLocation(graph, traced.path, traced.stopNode);
  const stopLabel = terminalSideLabel({
    graph,
    node: traced.stopNode,
    source
  });
  const sheets = unique(
    traced.path.steps.map((step) =>
      sheetLabel(graph, step.relationship.provenance.sheetId)
    )
  );
  const conductors = conductorEvidence(graph, traced.path, source);
  const assetIds = unique(
    [traced.path.fromNodeId, ...traced.path.steps.map((step) => step.toNodeId)]
      .map((nodeId) => graph.terminalSidesById.get(nodeId)?.ref.assetId)
  );

  return {
    assetIds,
    affectedRecords: affectedPathRecords(graph, traced.path, traced.stopNode),
    evidence: [
      { label: "Traced path", value: boundedEvidence(nodes.join(" → ")) },
      ...(conductors.length > 0
        ? [{
            label: "Wires and conductors",
            value: boundedEvidence(conductors.join("; "))
          }]
        : []),
      ...(sheets.length > 0
        ? [{ label: "Sheets traversed", value: sheets.join(" → ") }]
        : []),
      {
        label: "Stops at",
        value: `${stopLabel}${location ? ` — Sheet ${location.sheetNumber}${location.sheetName ? ` — ${location.sheetName}` : ""}` : ""}`
      }
    ],
    locations: location ? [location] : [],
    stoppingTerminalLabel: stopLabel
  };
}
