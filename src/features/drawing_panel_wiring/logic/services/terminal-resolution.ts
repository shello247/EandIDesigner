import type {
  PanelSourceEndpointRef,
  PanelTerminalRef,
  PanelTerminalSideRef,
  PanelWiringSourceOccurrence,
  PanelWiringSourceTerminal
} from "../../data/schema";

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function sheetPlacementKey(sheetId: string, placementId: string): string {
  return `${encodePart(sheetId)}:${encodePart(placementId)}`;
}

export function sheetConnectionKey(
  sheetId: string,
  connectionId: string
): string {
  return `${encodePart(sheetId)}:${encodePart(connectionId)}`;
}

export function terminalNodeId(ref: PanelTerminalRef): string {
  return `terminal:${encodePart(ref.assetId)}:${encodePart(ref.terminalKey)}`;
}

export function terminalSideNodeId(ref: PanelTerminalSideRef): string {
  return `${terminalNodeId(ref)}:${ref.side}`;
}

export function sourceEndpointKey(source: PanelSourceEndpointRef): string {
  return [
    encodePart(source.sheetId),
    encodePart(source.connectionId),
    source.endpointRole,
    encodePart(source.placementId),
    encodePart(source.anchorKey)
  ].join(":");
}

export function externalTerminationId(
  panelAssetId: string,
  source: PanelSourceEndpointRef
): string {
  return `external:${encodePart(panelAssetId)}:${sourceEndpointKey(source)}`;
}

export function resolveOccurrenceTerminalByAnchor(
  occurrence: PanelWiringSourceOccurrence,
  anchorKey: string
): PanelWiringSourceTerminal | undefined {
  return occurrence.terminals.find((terminal) =>
    terminal.anchors.some((anchor) => anchor.anchorKey === anchorKey)
  );
}

export function terminalDefinitionSignature(
  terminal: PanelWiringSourceTerminal
): string {
  return JSON.stringify({
    label: terminal.label,
    function: terminal.function ?? "",
    supportedSides: [...terminal.supportedSides].sort(),
    anchors: terminal.anchors
      .map((anchor) => ({
        anchorKey: anchor.anchorKey,
        anchorKind: anchor.anchorKind,
        sideHint: anchor.sideHint ?? ""
      }))
      .sort((first, second) => first.anchorKey.localeCompare(second.anchorKey))
  });
}
