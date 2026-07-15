import type {
  PanelConnectivityGraph,
  PanelDrawingQualityFinding
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelReportTraceRef,
  PanelWireScheduleRow
} from "../../data/schema";
import {
  buildPanelReportIndex,
  getPanelReportWireFindings,
  type PanelReportIndex
} from "./panel-report-index";
import {
  findingRefs,
  naturalCompare,
  terminalDisplayLabel
} from "./panel-report-helpers";

function patternCode(graph: PanelConnectivityGraph, patternId?: string) {
  if (!patternId) return undefined;
  const pattern = graph.bridgesById.get(patternId) ?? graph.bondsById.get(patternId);
  return pattern?.patternCode ?? patternId;
}

export function buildPanelWireSchedule({
  graph,
  panelAssetId,
  qualityFindings = [],
  index
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  qualityFindings?: PanelDrawingQualityFinding[];
  index?: PanelReportIndex;
}): PanelWireScheduleRow[] {
  const panel = graph.assetsById.get(panelAssetId);
  if (!panel) return [];
  const reportIndex = index ?? buildPanelReportIndex({ graph, qualityFindings });

  return [...graph.internalWiresById.values()]
    .filter((wire) => wire.panelAssetId === panelAssetId)
    .map((wire): PanelWireScheduleRow => {
      const routes = reportIndex.routesByInternalWireId.get(wire.id) ?? [];
      const traces: PanelReportTraceRef[] = routes.map((route) => ({
        kind: "sheet_object",
        sheet: {
          sheetId: route.sheetId,
          sheetNumber: route.sheetNumber,
          sheetName: route.sheetName,
          objectId: route.connectionId
        },
        objectKind: "connection",
        label: "Open internal route"
      }));
      traces.push({
        kind: "work_queue",
        panelAssetId,
        tab: "internal-wires",
        objectId: wire.id,
        label: "Open Internal Wires"
      });
      return {
        id: `wire-schedule:${wire.id}`,
        panelAssetId,
        panelTag: panel.tag,
        wireId: wire.wireId,
        from: wire.from,
        fromLabel: terminalDisplayLabel(graph, wire.from),
        to: wire.to,
        toLabel: terminalDisplayLabel(graph, wire.to),
        domain: wire.domain ?? "unknown",
        color: wire.attributes?.color,
        size: wire.attributes?.size,
        wireType: wire.attributes?.wireType,
        description: wire.attributes?.description,
        origin: wire.origin,
        ownerPatternId: wire.ownerPatternId,
        ownerPatternCode: patternCode(graph, wire.ownerPatternId),
        routes,
        represented: routes.length > 0,
        findings: findingRefs(
          getPanelReportWireFindings(reportIndex, wire),
          () => true
        ),
        traces
      };
    })
    .sort((first, second) => naturalCompare(first.wireId, second.wireId));
}
