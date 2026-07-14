import {
  buildPanelTerminalCatalog,
  type PanelConnectivityGraph,
  type PanelDrawingQualityFinding,
  type PanelTerminalCatalogRow,
  type PanelTerminalOccupant,
  type PanelTerminalSide,
  type PanelTerminalSideRef
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelReportTraceRef,
  PanelTerminalOccupantSchedule,
  PanelTerminalScheduleRow,
  PanelTerminalSideSchedule
} from "../../data/schema";
import {
  buildPanelReportIndex,
  getPanelReportDetailedOccurrences,
  getPanelReportExternalTerminations,
  getPanelReportPatternMemberships,
  getPanelReportTerminalFindings,
  type PanelReportIndex
} from "./panel-report-index";
import {
  findingRefs,
  naturalCompare,
  sheetRef,
  terminalDisplayLabel,
  terminalId,
  terminalSideId,
  uniqueSheetRefs
} from "./panel-report-helpers";

function enrichOccupant({
  graph,
  index,
  panelAssetId,
  sideRef,
  occupant
}: {
  graph: PanelConnectivityGraph;
  index: PanelReportIndex;
  panelAssetId: string;
  sideRef: PanelTerminalSideRef;
  occupant: PanelTerminalOccupant;
}): PanelTerminalOccupantSchedule {
  const base: PanelTerminalOccupantSchedule = {
    id: occupant.id,
    kind: occupant.kind,
    channel: occupant.channel,
    label: occupant.label,
    wireId: occupant.wireId,
    cableTag: occupant.cableTag,
    conductorKey: occupant.conductorKey,
    ownerPatternId: occupant.ownerPatternId
  };

  if (occupant.kind === "external_termination") {
    const termination = graph.externalTerminationsById.get(occupant.id);
    if (termination) {
      base.connectedAssetId = termination.sourceAssetId;
      base.connectedAssetTag = termination.sourceAssetTag;
      base.sourceSheet = sheetRef(
        graph,
        termination.sourceSheet.id,
        termination.source.connectionId
      );
    }
  }

  if (occupant.kind === "internal_wire") {
    const occupantRecordId = occupant.id.replace(/:(from|to)$/, "");
    const wire =
      graph.internalWiresById.get(occupantRecordId) ??
      (occupant.wireId
        ? index.internalWireByPanelWireId.get(
            `${panelAssetId}:${occupant.wireId.toUpperCase()}`
          )
        : undefined);
    if (wire) {
      const other =
        terminalSideId(wire.from) === terminalSideId(sideRef) ? wire.to : wire.from;
      base.connectedAssetId = other.assetId;
      base.connectedAssetTag = graph.assetsById.get(other.assetId)?.tag;
      base.connectedTerminal = other;
      base.connectedTerminalLabel = terminalDisplayLabel(graph, other);
    }
  }

  if (occupant.ownerPatternId) {
    const pattern =
      graph.bridgesById.get(occupant.ownerPatternId) ??
      graph.bondsById.get(occupant.ownerPatternId);
    base.ownerPatternCode = pattern?.patternCode ?? occupant.ownerPatternId;
  }

  return base;
}

function sideSchedule({
  graph,
  index,
  panelAssetId,
  row,
  side
}: {
  graph: PanelConnectivityGraph;
  index: PanelReportIndex;
  panelAssetId: string;
  row: PanelTerminalCatalogRow;
  side: PanelTerminalSide;
}): PanelTerminalSideSchedule {
  if (!row.supportedSides.includes(side)) {
    return { side, status: "not_applicable", occupants: [] };
  }
  const occupancy = row.occupancy[side];
  const ref: PanelTerminalSideRef = { ...row.terminal, side };
  return {
    side,
    status: occupancy?.status ?? "available",
    occupants: (occupancy?.occupants ?? []).map((occupant) =>
      enrichOccupant({ graph, index, panelAssetId, sideRef: ref, occupant })
    )
  };
}

export function buildPanelTerminalSchedule({
  graph,
  panelAssetId,
  qualityFindings = [],
  index
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  qualityFindings?: PanelDrawingQualityFinding[];
  index?: PanelReportIndex;
}): PanelTerminalScheduleRow[] {
  const panel = graph.assetsById.get(panelAssetId);
  if (!panel) return [];
  const reportIndex = index ?? buildPanelReportIndex({ graph, qualityFindings });
  const catalog = buildPanelTerminalCatalog({ graph, panelAssetId });

  return [...catalog.rowsByTerminalId.values()]
    .map((row): PanelTerminalScheduleRow => {
      const external = sideSchedule({ graph, index: reportIndex, panelAssetId, row, side: "external" });
      const internal = sideSchedule({ graph, index: reportIndex, panelAssetId, row, side: "internal" });
      const single = sideSchedule({ graph, index: reportIndex, panelAssetId, row, side: "single" });
      const externalTerminations = getPanelReportExternalTerminations(
        reportIndex,
        panelAssetId,
        row.terminal
      );
      const traces: PanelReportTraceRef[] = [];
      const representedOccurrence = getPanelReportDetailedOccurrences(
        reportIndex,
        panelAssetId,
        row.terminal.assetId
      )[0];
      if (representedOccurrence) {
        traces.push({
          kind: "sheet_object",
          sheet: {
            sheetId: representedOccurrence.sheet.id,
            sheetNumber: representedOccurrence.sheet.sheetNumber,
            sheetName: representedOccurrence.sheet.name,
            objectId: representedOccurrence.occurrence.placementId
          },
          objectKind: "placement",
          label: "Open panel occurrence"
        });
      }
      externalTerminations.forEach((termination) => {
        traces.push({
          kind: "sheet_object",
          sheet: {
            sheetId: termination.sourceSheet.id,
            sheetNumber: termination.sourceSheet.number,
            sheetName: termination.sourceSheet.name,
            objectId: termination.source.connectionId
          },
          objectKind: "connection",
          label: "Open field source"
        });
      });
      traces.push({
        kind: "work_queue",
        panelAssetId,
        tab: "terminal-map",
        objectId: terminalId(row.terminal),
        label: "Open Terminal Map"
      });

      const occupants = [...external.occupants, ...internal.occupants, ...single.occupants];
      return {
        id: `schedule:${panelAssetId}:${terminalId(row.terminal)}`,
        panelAssetId,
        panelTag: panel.tag,
        assetId: row.terminal.assetId,
        assetTag: row.assetTag,
        assetTitle: row.assetTitle,
        assetType: row.assetType,
        terminalKey: row.terminal.terminalKey,
        terminalLabel: row.label,
        function: row.function,
        external,
        internal,
        single,
        patterns: getPanelReportPatternMemberships(
          reportIndex,
          panelAssetId,
          row.terminal
        ),
        sourceSheets: uniqueSheetRefs(occupants.map((occupant) => occupant.sourceSheet)),
        findings: findingRefs(
          getPanelReportTerminalFindings(
            reportIndex,
            panelAssetId,
            row.terminal
          ),
          () => true
        ),
        traces
      };
    })
    .sort(
      (first, second) =>
        naturalCompare(first.assetTag, second.assetTag) ||
        naturalCompare(first.terminalLabel, second.terminalLabel) ||
        naturalCompare(first.terminalKey, second.terminalKey)
    );
}
