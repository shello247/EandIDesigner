import type {
  PanelConnectivityGraph,
  PanelExternalTerminationDisplayRow
} from "../../types";

function compareDisplayRows(
  first: PanelExternalTerminationDisplayRow,
  second: PanelExternalTerminationDisplayRow
): number {
  return (
    first.placementId.localeCompare(second.placementId) ||
    first.target.terminalKey.localeCompare(
      second.target.terminalKey,
      undefined,
      { numeric: true }
    ) ||
    (first.wireId ?? "").localeCompare(second.wireId ?? "", undefined, {
      numeric: true
    }) ||
    first.terminationId.localeCompare(second.terminationId)
  );
}

export function buildPanelExternalTerminationDisplayRows({
  graph,
  detailedSheetId
}: {
  graph: PanelConnectivityGraph;
  detailedSheetId: string;
}): PanelExternalTerminationDisplayRow[] {
  const sheet = graph.sheetsById.get(detailedSheetId);
  const panelAssetId = sheet?.panelDrawingContext?.panelAssetId;

  if (!sheet || !panelAssetId) {
    return [];
  }

  const occurrenceByAssetId = new Map(
    sheet.occurrences
      .filter(
        (occurrence) =>
          occurrence.assetId && occurrence.occurrenceKind !== "layout"
      )
      .sort((first, second) =>
        first.placementId.localeCompare(second.placementId)
      )
      .map((occurrence) => [occurrence.assetId!, occurrence])
  );
  const terminationIds =
    graph.externalTerminationIdsByPanelAssetId.get(panelAssetId) ?? [];

  return terminationIds
    .flatMap((terminationId): PanelExternalTerminationDisplayRow[] => {
      const termination = graph.externalTerminationsById.get(terminationId);
      const target = termination?.target;

      if (!termination || termination.status !== "resolved" || !target) {
        return [];
      }

      const occurrence = occurrenceByAssetId.get(target.assetId);
      const terminal = occurrence?.terminals.find(
        (candidate) => candidate.terminalKey === target.terminalKey
      );
      const anchor =
        terminal?.anchors.find(
          (candidate) => candidate.sideHint === target.side
        ) ??
        (terminal?.supportedSides.length === 1 &&
        terminal.supportedSides[0] === target.side &&
        terminal.anchors.length === 1
          ? terminal.anchors[0]
          : undefined);

      if (!occurrence || !anchor) {
        return [];
      }

      return [
        {
          terminationId: termination.id,
          panelAssetId,
          detailedSheetId,
          placementId: occurrence.placementId,
          anchorKey: anchor.anchorKey,
          physicalPosition: anchor.physicalPosition,
          target,
          wireId: termination.wireId,
          cableTag: termination.cableTag,
          conductorKey: termination.conductorKey,
          source: termination.source,
          sourceSheet: termination.sourceSheet
        }
      ];
    })
    .sort(compareDisplayRows);
}

export function buildPanelExternalTerminationDisplayIndex(
  graph: PanelConnectivityGraph
): ReadonlyMap<string, PanelExternalTerminationDisplayRow[]> {
  return new Map(
    [...graph.sheetsById.values()]
      .filter((sheet) => Boolean(sheet.panelDrawingContext))
      .sort((first, second) => first.sheetNumber - second.sheetNumber)
      .map((sheet) => [
        sheet.id,
        buildPanelExternalTerminationDisplayRows({
          graph,
          detailedSheetId: sheet.id
        })
      ])
  );
}
