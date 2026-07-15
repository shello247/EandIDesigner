import type {
  PanelBondRecord,
  PanelBridgeRecord,
  PanelElectricalDomain,
  PanelTerminalSideRef
} from "../../data/schema";
import type {
  PanelConnectionPatternCatalogRow,
  PanelConnectionPatternRecord,
  PanelConnectivityGraph
} from "../../types";
import { getPanelPatternDisplayLabel } from "./panel-connection-patterns";
import { validatePanelConnectionPattern } from "./panel-pattern-validation";
import { terminalNodeId } from "./terminal-resolution";

function terminalLabel(
  graph: PanelConnectivityGraph,
  terminal: PanelTerminalSideRef
): string {
  const asset = graph.assetsById.get(terminal.assetId);
  const node = graph.terminalsById.get(terminalNodeId(terminal));
  return `${asset?.tag ?? terminal.assetId}:${node?.label ?? terminal.terminalKey}/${terminal.side}`;
}

function patternTopology(
  pattern: PanelConnectionPatternRecord
): PanelConnectionPatternCatalogRow["topology"] {
  if (pattern.recordType === "bond") {
    return pattern.record.kind;
  }
  return pattern.record.definition?.topology ?? "legacy";
}

function patternDomain(
  pattern: PanelConnectionPatternRecord
): PanelElectricalDomain {
  return pattern.recordType === "bond"
    ? pattern.record.kind
    : pattern.record.domain ?? "unknown";
}

function patternMembers(
  pattern: PanelConnectionPatternRecord
): PanelTerminalSideRef[] {
  if (pattern.recordType === "bridge") {
    return pattern.record.members;
  }
  return pattern.record.endpoints.flatMap((endpoint) =>
    endpoint.kind === "terminal" ? [endpoint.terminal] : []
  );
}

function routeOccurrences(
  graph: PanelConnectivityGraph,
  patternId: string
) {
  return graph.source.sheets.flatMap((sheet) =>
    sheet.connections
      .filter((connection) => connection.panelPatternId === patternId)
      .map((connection) => ({
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        connectionId: connection.id,
        segmentId: connection.panelPatternSegmentId
      }))
  );
}

function buildRow(
  graph: PanelConnectivityGraph,
  pattern: PanelConnectionPatternRecord
): PanelConnectionPatternCatalogRow {
  const occurrences = routeOccurrences(graph, pattern.record.id);
  const ownedWires = [...graph.internalWiresById.values()]
    .filter((wire) => wire.ownerPatternId === pattern.record.id)
    .sort((first, second) => first.wireId.localeCompare(second.wireId, undefined, { numeric: true }));
  const findings = [
    ...validatePanelConnectionPattern({ graph, candidate: pattern }),
    ...graph.findings.filter((finding) =>
      finding.id.includes(pattern.record.id) ||
      ownedWires.some((wire) => finding.id.includes(wire.id))
    )
  ];
  const uniqueFindings = new Map(findings.map((finding) => [finding.id, finding]));

  return {
    ...pattern,
    patternId: pattern.record.id,
    patternCode: pattern.record.patternCode ?? pattern.record.id,
    topology: patternTopology(pattern),
    displayLabel: getPanelPatternDisplayLabel(pattern),
    domain: patternDomain(pattern),
    memberLabels: patternMembers(pattern).map((member) => terminalLabel(graph, member)),
    ownedWireIds: ownedWires.map((wire) => wire.wireId),
    routeOccurrences: occurrences,
    represented: occurrences.length > 0,
    findings: [...uniqueFindings.values()].sort((first, second) => first.id.localeCompare(second.id))
  };
}

export function buildPanelConnectionPatternCatalog({
  graph,
  panelAssetId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
}): PanelConnectionPatternCatalogRow[] {
  const bridges = [...graph.bridgesById.values()]
    .filter((record): record is PanelBridgeRecord => record.panelAssetId === panelAssetId)
    .map((record): PanelConnectionPatternRecord => ({ recordType: "bridge", record }));
  const bonds = [...graph.bondsById.values()]
    .filter((record): record is PanelBondRecord => record.panelAssetId === panelAssetId)
    .map((record): PanelConnectionPatternRecord => ({ recordType: "bond", record }));
  return [...bridges, ...bonds]
    .map((pattern) => buildRow(graph, pattern))
    .sort((first, second) =>
      first.patternCode.localeCompare(second.patternCode, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
}
