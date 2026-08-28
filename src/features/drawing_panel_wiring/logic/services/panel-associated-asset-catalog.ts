import type {
  PanelAssociatedAssetCatalogRow,
  PanelDiscoveryBuildContext,
  PanelDiscoveryStatus,
  PanelTerminalCatalog,
  PanelSourceOccurrenceRef,
  PanelWiringSourceAsset,
  PanelWiringSourceOccurrence
} from "../../types";
import { derivePanelEquipmentSequence } from "./panel-equipment-sequence";
import { buildPanelTerminalCatalog } from "./panel-terminal-catalog";

const EXCLUDED_ASSET_TYPES = new Set(["cable", "panel", "junction_box"]);

function occurrenceSignature(occurrence: PanelWiringSourceOccurrence): string {
  const terminals = occurrence.terminals
    .map((terminal) =>
      [
        terminal.terminalKey,
        terminal.status,
        [...terminal.supportedSides].sort().join(","),
        terminal.anchors
          .map((anchor) => `${anchor.anchorKey}:${anchor.anchorKind}`)
          .sort()
          .join(",")
      ].join("|")
    )
    .sort()
    .join(";");

  return [
    occurrence.tag.trim().toUpperCase(),
    occurrence.role,
    occurrence.symbolId,
    occurrence.versionId,
    occurrence.terminalResolutionStatus,
    terminals
  ].join("::");
}

function sourceOccurrenceRef(
  context: PanelDiscoveryBuildContext,
  occurrence: PanelWiringSourceOccurrence
): PanelSourceOccurrenceRef {
  const sheet = context.graph.sheetsById.get(occurrence.sheetId);

  return {
    sheetId: occurrence.sheetId,
    sheetName: sheet?.name ?? occurrence.sheetId,
    sheetNumber: sheet?.sheetNumber ?? 0,
    placementId: occurrence.placementId,
    occurrenceKind: occurrence.occurrenceKind,
    role: occurrence.role,
    symbolId: occurrence.symbolId,
    versionId: occurrence.versionId
  };
}

function representationSourcePriority(
  occurrence: PanelWiringSourceOccurrence
): number {
  if (occurrence.occurrenceKind === "wiring") {
    return 0;
  }

  if (occurrence.occurrenceKind === "layout") {
    return 1;
  }

  return 2;
}

function compareRepresentationSources(
  first: PanelWiringSourceOccurrence,
  second: PanelWiringSourceOccurrence
): number {
  return (
    representationSourcePriority(first) -
      representationSourcePriority(second) ||
    first.sheetId.localeCompare(second.sheetId) ||
    first.placementId.localeCompare(second.placementId)
  );
}

function resolveStatus({
  representedPlacementId,
  asset,
  sourceOccurrences,
  hasConflict
}: {
  representedPlacementId?: string;
  asset?: PanelWiringSourceAsset;
  sourceOccurrences: PanelWiringSourceOccurrence[];
  hasConflict: boolean;
}): {
  status: PanelDiscoveryStatus;
  representationSource?: PanelWiringSourceOccurrence;
  disabledReason?: string;
} {
  if (hasConflict) {
    return {
      status: "conflicting",
      disabledReason: "Linked occurrences disagree on symbol or terminal configuration."
    };
  }

  if (!asset) {
    return {
      status: "missing",
      disabledReason: "The physical asset record is missing from this drawing package."
    };
  }

  const orderedSources = [...sourceOccurrences].sort(
    compareRepresentationSources
  );
  const representationSource = orderedSources.find(
    (occurrence) =>
      occurrence.terminalResolutionStatus === "resolved" &&
      occurrence.terminals.length > 0
  );

  if (!representationSource) {
    const diagnosticSource = orderedSources.find(
      (occurrence) =>
        occurrence.terminalResolutionStatus !== "not_applicable"
    );

    return {
      status: "unsupported",
      disabledReason:
        diagnosticSource?.terminalResolutionMessage ??
        (diagnosticSource?.terminalResolutionStatus === "missing_symbol"
          ? "Needs a compatible approved or generated symbol."
          : "Needs resolved electrical terminal metadata.")
    };
  }

  return representedPlacementId
    ? { status: "represented", representationSource }
    : { status: "available", representationSource };
}

export function buildPanelAssociatedAssetCatalog(
  context: PanelDiscoveryBuildContext,
  terminalCatalog: PanelTerminalCatalog = buildPanelTerminalCatalog({
    graph: context.graph,
    panelAssetId: context.panelAssetId
  })
): PanelAssociatedAssetCatalogRow[] {
  const associatedIds =
    context.graph.assetIdsByPanelAssetId.get(context.panelAssetId) ??
    new Set<string>();
  const rows: PanelAssociatedAssetCatalogRow[] = [];
  const panelSequenceIndex = derivePanelEquipmentSequence(context);

  for (const assetId of associatedIds) {
    if (assetId === context.panelAssetId) {
      continue;
    }

    const asset = context.graph.assetsById.get(assetId);

    if (asset && EXCLUDED_ASSET_TYPES.has(asset.type)) {
      continue;
    }

    const occurrences = [
      ...(context.graph.occurrencesByAssetId.get(assetId) ?? [])
    ];
    const sourceOccurrences = occurrences.filter(
      (occurrence) => occurrence.sheetId !== context.detailedSheetId
    );
    const fallback = sourceOccurrences[0] ?? occurrences[0];
    const signatures = new Set(sourceOccurrences.map(occurrenceSignature));
    const findingConflict = context.graph.findings.some(
      (finding) =>
        finding.assetId === assetId &&
        [
          "linked_terminal_configuration_mismatch",
          "duplicate_asset_identity"
        ].includes(finding.code)
    );
    const representedPlacementId =
      context.representedPlacementIdsByAssetId.get(assetId);
    const resolved = resolveStatus({
      representedPlacementId,
      asset,
      sourceOccurrences,
      hasConflict: signatures.size > 1 || findingConflict
    });
    const terminalCount = [...context.graph.terminalsById.values()].filter(
      (terminal) => terminal.ref.assetId === assetId
    ).length;
    let usedTerminalSides = 0;
    let unusedTerminalSides = 0;

    for (const terminal of terminalCatalog.rowsByTerminalId.values()) {
      if (terminal.terminal.assetId !== assetId) {
        continue;
      }

      for (const side of terminal.supportedSides) {
        const occupancy = terminal.occupancy[side];
        if (!occupancy) {
          continue;
        }

        if (occupancy.conductorStatus === "available") {
          unusedTerminalSides += 1;
        } else {
          usedTerminalSides += 1;
        }
      }
    }
    const duplicatePanelLayout =
      panelSequenceIndex.duplicateLayoutAssetIds.has(assetId);

    rows.push({
      assetId,
      tag: asset?.tag ?? fallback?.tag ?? assetId,
      title: asset?.title ?? fallback?.tag ?? "Missing asset",
      type:
        asset?.type ??
        (fallback?.role === "terminal_block" ? "terminal_block" : "other"),
      status: resolved.status,
      terminalCount,
      terminalUsage: {
        used: usedTerminalSides,
        unused: unusedTerminalSides,
        total: usedTerminalSides + unusedTerminalSides
      },
      representedPlacementId,
      representationSource: resolved.representationSource
        ? sourceOccurrenceRef(context, resolved.representationSource)
        : undefined,
      sourceOccurrences: sourceOccurrences
        .map((occurrence) => sourceOccurrenceRef(context, occurrence))
        .sort(
          (first, second) =>
            first.sheetNumber - second.sheetNumber ||
            first.placementId.localeCompare(second.placementId)
        ),
      panelSequence: panelSequenceIndex.sequenceByAssetId.get(assetId),
      panelSequenceWarning: duplicatePanelLayout
        ? "Multiple physical panel-layout occurrences were found. The earliest occurrence determines this position."
        : undefined,
      disabledReason: resolved.disabledReason
    });
  }

  return rows.sort((first, second) => {
    if (first.panelSequence && second.panelSequence) {
      return first.panelSequence.position - second.panelSequence.position;
    }

    if (first.panelSequence) return -1;
    if (second.panelSequence) return 1;

    return first.tag.localeCompare(second.tag, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });
}
