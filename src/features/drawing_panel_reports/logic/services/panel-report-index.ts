import type {
  PanelConnectivityGraph,
  PanelDrawingQualityFinding,
  PanelExternalTermination,
  PanelInternalWireRecord,
  PanelWiringSourceOccurrence,
  PanelWiringSourceSheet
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelPatternMembership,
  PanelWireRouteSchedule
} from "../../data/schema";
import { terminalId, terminalSideId } from "./panel-report-helpers";

type DetailedOccurrence = {
  sheet: PanelWiringSourceSheet;
  occurrence: PanelWiringSourceOccurrence;
};

export type PanelReportIndex = {
  graph: PanelConnectivityGraph;
  qualityFindings: PanelDrawingQualityFinding[];
  routesByInternalWireId: ReadonlyMap<string, PanelWireRouteSchedule[]>;
  patternMembershipsByTerminalId: ReadonlyMap<string, PanelPatternMembership[]>;
  externalTerminationsByTerminalId: ReadonlyMap<string, PanelExternalTermination[]>;
  detailedOccurrencesByPanelAsset: ReadonlyMap<string, DetailedOccurrence[]>;
  terminalCountByAssetId: ReadonlyMap<string, number>;
  conductorRelationshipIdsByPanelAsset: ReadonlyMap<string, ReadonlySet<string>>;
  internalWireByPanelWireId: ReadonlyMap<string, PanelInternalWireRecord>;
  findingsByAsset: ReadonlyMap<string, PanelDrawingQualityFinding[]>;
  findingsByTerminal: ReadonlyMap<string, PanelDrawingQualityFinding[]>;
  findingsByInternalWire: ReadonlyMap<string, PanelDrawingQualityFinding[]>;
  findingsByWireId: ReadonlyMap<string, PanelDrawingQualityFinding[]>;
  findingsByTerminalSide: ReadonlyMap<string, PanelDrawingQualityFinding[]>;
};

function appendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function appendNestedSet(
  map: Map<string, Set<string>>,
  key: string,
  value: string
): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function panelAssetKey(panelAssetId: string, assetId: string): string {
  return `${panelAssetId}:${assetId}`;
}

function panelTerminalKey(
  panelAssetId: string,
  terminal: { assetId: string; terminalKey: string }
): string {
  return `${panelAssetId}:${terminalId(terminal)}`;
}

function patternMembership(
  patternCode: string,
  topology: string,
  domain: PanelPatternMembership["domain"]
): PanelPatternMembership {
  return { patternId: patternCode, patternCode, topology, domain };
}

function uniqueFindings(
  findings: PanelDrawingQualityFinding[]
): PanelDrawingQualityFinding[] {
  return [...new Map(findings.map((finding) => [finding.id, finding])).values()];
}

export function buildPanelReportIndex({
  graph,
  qualityFindings = []
}: {
  graph: PanelConnectivityGraph;
  qualityFindings?: PanelDrawingQualityFinding[];
}): PanelReportIndex {
  const routesByInternalWireId = new Map<string, PanelWireRouteSchedule[]>();
  const patternMembershipsByTerminalId = new Map<
    string,
    PanelPatternMembership[]
  >();
  const externalTerminationsByTerminalId = new Map<
    string,
    PanelExternalTermination[]
  >();
  const detailedOccurrencesByPanelAsset = new Map<
    string,
    DetailedOccurrence[]
  >();
  const terminalCountByAssetId = new Map<string, number>();
  const conductorRelationshipIdsByPanelAsset = new Map<string, Set<string>>();
  const internalWireByPanelWireId = new Map<string, PanelInternalWireRecord>();
  const findingsByAsset = new Map<string, PanelDrawingQualityFinding[]>();
  const findingsByTerminal = new Map<string, PanelDrawingQualityFinding[]>();
  const findingsByInternalWire = new Map<string, PanelDrawingQualityFinding[]>();
  const findingsByWireId = new Map<string, PanelDrawingQualityFinding[]>();
  const findingsByTerminalSide = new Map<string, PanelDrawingQualityFinding[]>();

  for (const terminal of graph.terminalsById.values()) {
    terminalCountByAssetId.set(
      terminal.ref.assetId,
      (terminalCountByAssetId.get(terminal.ref.assetId) ?? 0) + 1
    );
  }

  for (const sheet of graph.source.sheets) {
    const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
    if (panelAssetId) {
      for (const occurrence of sheet.occurrences) {
        if (occurrence.assetId) {
          appendMapValue(
            detailedOccurrencesByPanelAsset,
            panelAssetKey(panelAssetId, occurrence.assetId),
            { sheet, occurrence }
          );
        }
      }
    }

    for (const connection of sheet.connections) {
      if (!connection.panelConnectionId) continue;
      appendMapValue(routesByInternalWireId, connection.panelConnectionId, {
        sheetId: sheet.id,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        connectionId: connection.id,
        routeMode:
          connection.routeMode ??
          (connection.routePointCount ? "manual" : "unrouted"),
        pointCount: connection.routePointCount ?? 0
      });
    }
  }

  for (const routes of routesByInternalWireId.values()) {
    routes.sort(
      (first, second) =>
        first.sheetNumber - second.sheetNumber ||
        first.connectionId.localeCompare(second.connectionId)
    );
  }

  for (const termination of graph.externalTerminationsById.values()) {
    if (!termination.target) continue;
    appendMapValue(
      externalTerminationsByTerminalId,
      panelTerminalKey(termination.panelAssetId, termination.target),
      termination
    );
    appendNestedSet(
      conductorRelationshipIdsByPanelAsset,
      panelAssetKey(termination.panelAssetId, termination.target.assetId),
      `external:${termination.id}`
    );
  }

  for (const wire of graph.internalWiresById.values()) {
    internalWireByPanelWireId.set(
      `${wire.panelAssetId}:${wire.wireId.toUpperCase()}`,
      wire
    );
    appendNestedSet(
      conductorRelationshipIdsByPanelAsset,
      panelAssetKey(wire.panelAssetId, wire.from.assetId),
      `wire:${wire.id}:from`
    );
    appendNestedSet(
      conductorRelationshipIdsByPanelAsset,
      panelAssetKey(wire.panelAssetId, wire.to.assetId),
      `wire:${wire.id}:to`
    );
  }

  for (const bridge of graph.bridgesById.values()) {
    const membership = patternMembership(
      bridge.patternCode ?? bridge.id,
      bridge.definition?.topology ?? "legacy",
      bridge.domain ?? "unknown"
    );
    for (const member of bridge.members) {
      appendMapValue(
        patternMembershipsByTerminalId,
        panelTerminalKey(bridge.panelAssetId, member),
        { ...membership, patternId: bridge.id }
      );
    }
  }

  for (const bond of graph.bondsById.values()) {
    const membership = patternMembership(
      bond.patternCode ?? bond.id,
      bond.kind,
      bond.kind
    );
    for (const endpoint of bond.endpoints) {
      if (endpoint.kind !== "terminal") continue;
      appendMapValue(
        patternMembershipsByTerminalId,
        panelTerminalKey(bond.panelAssetId, endpoint.terminal),
        { ...membership, patternId: bond.id }
      );
    }
  }

  for (const memberships of patternMembershipsByTerminalId.values()) {
    memberships.sort((first, second) =>
      first.patternCode.localeCompare(second.patternCode, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
  }

  for (const finding of qualityFindings) {
    if (finding.assetId) {
      appendMapValue(
        findingsByAsset,
        panelAssetKey(finding.panelAssetId, finding.assetId),
        finding
      );
    }
    if (finding.terminal) {
      appendMapValue(
        findingsByTerminal,
        panelTerminalKey(finding.panelAssetId, finding.terminal),
        finding
      );
      appendMapValue(
        findingsByTerminalSide,
        `${finding.panelAssetId}:${terminalSideId(finding.terminal)}`,
        finding
      );
    }
    if (finding.internalWireId) {
      appendMapValue(findingsByInternalWire, finding.internalWireId, finding);
    }
    if (finding.wireId) {
      appendMapValue(
        findingsByWireId,
        `${finding.panelAssetId}:${finding.wireId.toUpperCase()}`,
        finding
      );
    }
  }

  return {
    graph,
    qualityFindings,
    routesByInternalWireId,
    patternMembershipsByTerminalId,
    externalTerminationsByTerminalId,
    detailedOccurrencesByPanelAsset,
    terminalCountByAssetId,
    conductorRelationshipIdsByPanelAsset,
    internalWireByPanelWireId,
    findingsByAsset,
    findingsByTerminal,
    findingsByInternalWire,
    findingsByWireId,
    findingsByTerminalSide
  };
}

export function getPanelReportTerminalFindings(
  index: PanelReportIndex,
  panelAssetId: string,
  terminal: { assetId: string; terminalKey: string }
): PanelDrawingQualityFinding[] {
  const assetFindings =
    index.findingsByAsset.get(panelAssetKey(panelAssetId, terminal.assetId)) ?? [];
  const terminalFindings =
    index.findingsByTerminal.get(panelTerminalKey(panelAssetId, terminal)) ?? [];
  return uniqueFindings([
    ...assetFindings.filter((finding) => !finding.terminal),
    ...terminalFindings
  ]);
}

export function getPanelReportWireFindings(
  index: PanelReportIndex,
  wire: PanelInternalWireRecord
): PanelDrawingQualityFinding[] {
  return uniqueFindings([
    ...(index.findingsByInternalWire.get(wire.id) ?? []),
    ...(index.findingsByWireId.get(
      `${wire.panelAssetId}:${wire.wireId.toUpperCase()}`
    ) ?? []),
    ...(index.findingsByTerminalSide.get(
      `${wire.panelAssetId}:${terminalSideId(wire.from)}`
    ) ?? []),
    ...(index.findingsByTerminalSide.get(
      `${wire.panelAssetId}:${terminalSideId(wire.to)}`
    ) ?? [])
  ]);
}

export function getPanelReportAssetFindings(
  index: PanelReportIndex,
  panelAssetId: string,
  assetId: string
): PanelDrawingQualityFinding[] {
  return index.findingsByAsset.get(panelAssetKey(panelAssetId, assetId)) ?? [];
}

export function getPanelReportDetailedOccurrences(
  index: PanelReportIndex,
  panelAssetId: string,
  assetId: string
): DetailedOccurrence[] {
  return index.detailedOccurrencesByPanelAsset.get(
    panelAssetKey(panelAssetId, assetId)
  ) ?? [];
}

export function getPanelReportExternalTerminations(
  index: PanelReportIndex,
  panelAssetId: string,
  terminal: { assetId: string; terminalKey: string }
): PanelExternalTermination[] {
  return index.externalTerminationsByTerminalId.get(
    panelTerminalKey(panelAssetId, terminal)
  ) ?? [];
}

export function getPanelReportPatternMemberships(
  index: PanelReportIndex,
  panelAssetId: string,
  terminal: { assetId: string; terminalKey: string }
): PanelPatternMembership[] {
  return index.patternMembershipsByTerminalId.get(
    panelTerminalKey(panelAssetId, terminal)
  ) ?? [];
}

export function getPanelReportConductorRelationshipIds(
  index: PanelReportIndex,
  panelAssetId: string,
  assetId: string
): ReadonlySet<string> {
  return index.conductorRelationshipIdsByPanelAsset.get(
    panelAssetKey(panelAssetId, assetId)
  ) ?? new Set<string>();
}
