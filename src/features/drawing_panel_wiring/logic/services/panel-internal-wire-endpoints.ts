import type { PanelTerminalSideRef } from "../../data/schema";
import type {
  PanelConnectivityGraph,
  PanelInternalWireEndpointCatalog,
  PanelInternalWireEndpointOption,
  PanelInternalWireEndpointPairState,
  PanelTerminalCatalog
} from "../../types";
import { buildPanelTerminalCatalog, getTerminalSideOccupancy } from "./panel-terminal-catalog";
import { validateInternalWireEndpoints } from "./internal-panel-wires";

function naturalCompare(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function endpointDisabledReason(
  option: Pick<PanelInternalWireEndpointOption, "terminal">,
  catalog: PanelTerminalCatalog
): string | undefined {
  const occupancy = getTerminalSideOccupancy(catalog, option.terminal);

  if (!occupancy) {
    return "Terminal occupancy is unavailable.";
  }
  if (occupancy.conductorStatus === "conflicting") {
    return "This terminal has conflicting conductor occupancy.";
  }
  if (occupancy.conductorStatus === "occupied") {
    return `${occupancy.conductorOccupants[0]?.label ?? "Another connection"} already occupies this terminal.`;
  }
  return undefined;
}

export function buildPanelInternalWireEndpointCatalog({
  graph,
  panelAssetId,
  detailedSheetId
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  detailedSheetId: string;
}): PanelInternalWireEndpointCatalog {
  const sheet = graph.sheetsById.get(detailedSheetId);
  const associatedAssetIds = graph.assetIdsByPanelAssetId.get(panelAssetId);
  const terminalCatalog = buildPanelTerminalCatalog({ graph, panelAssetId });

  if (
    !sheet ||
    sheet.panelDrawingContext?.kind !== "detailed_panel_wiring" ||
    sheet.panelDrawingContext.panelAssetId !== panelAssetId
  ) {
    return { panelAssetId, sheetId: detailedSheetId, equipment: [] };
  }

  const equipment = sheet.occurrences
    .filter(
      (occurrence) =>
        occurrence.occurrenceKind === "wiring" &&
        Boolean(occurrence.assetId) &&
        occurrence.containerAssetId === panelAssetId &&
        associatedAssetIds?.has(occurrence.assetId!)
    )
    .map((occurrence) => {
      const asset = graph.assetsById.get(occurrence.assetId!);
      const endpoints = occurrence.terminals
        .filter((terminal) => terminal.status === "resolved")
        .flatMap((terminal) =>
          terminal.anchors.flatMap((anchor) => {
            if (anchor.sideHint !== "internal" && anchor.sideHint !== "single") {
              return [];
            }
            const terminalRef: PanelTerminalSideRef = {
              assetId: occurrence.assetId!,
              terminalKey: terminal.terminalKey,
              side: anchor.sideHint
            };
            const option: PanelInternalWireEndpointOption = {
              id: `${occurrence.placementId}:${anchor.anchorKey}`,
              terminal: terminalRef,
              placementId: occurrence.placementId,
              anchorKey: anchor.anchorKey,
              assetTag: asset?.tag ?? occurrence.tag,
              assetTitle: asset?.title ?? occurrence.tag,
              terminalLabel: terminal.label,
              terminalFunction: terminal.function,
              physicalPosition: anchor.physicalPosition
            };

            return [
              {
                ...option,
                disabledReason: endpointDisabledReason(option, terminalCatalog)
              }
            ];
          })
        )
        .sort(
          (first, second) =>
            naturalCompare(first.terminal.terminalKey, second.terminal.terminalKey) ||
            naturalCompare(first.terminal.side, second.terminal.side) ||
            naturalCompare(first.anchorKey, second.anchorKey)
        );
      const enabledEndpoints = endpoints.filter((endpoint) => !endpoint.disabledReason);

      return {
        assetId: occurrence.assetId!,
        tag: asset?.tag ?? occurrence.tag,
        title: asset?.title ?? occurrence.tag,
        placementId: occurrence.placementId,
        endpoints,
        disabledReason:
          endpoints.length === 0
            ? "No resolved internal or single terminal anchors are available."
            : enabledEndpoints.length === 0
              ? "No free internal or single terminal sides are available."
              : undefined
      };
    })
    .sort(
      (first, second) =>
        naturalCompare(first.tag, second.tag) ||
        naturalCompare(first.assetId, second.assetId)
    );

  return { panelAssetId, sheetId: detailedSheetId, equipment };
}

export function getPanelInternalWireEndpointPairState({
  graph,
  panelAssetId,
  from,
  to
}: {
  graph: PanelConnectivityGraph;
  panelAssetId: string;
  from: PanelTerminalSideRef;
  to: PanelTerminalSideRef;
}): PanelInternalWireEndpointPairState {
  const result = validateInternalWireEndpoints({
    graph,
    panelAssetId,
    from,
    to
  });

  return result.valid
    ? { enabled: true }
    : {
        enabled: false,
        disabledReason: result.findings[0]?.message ?? "These terminals cannot be connected."
      };
}
