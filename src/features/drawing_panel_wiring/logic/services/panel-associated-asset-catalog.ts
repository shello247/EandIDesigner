import type {
  PanelAssociatedAssetCatalogRow,
  PanelDiscoveryBuildContext,
  PanelDiscoveryStatus,
  PanelSourceOccurrenceRef,
  PanelWiringSourceAsset,
  PanelWiringSourceOccurrence
} from "../../types";

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
}): { status: PanelDiscoveryStatus; disabledReason?: string } {
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

  const electricalSource = sourceOccurrences.find(
    (occurrence) => occurrence.occurrenceKind !== "layout"
  );

  if (!electricalSource) {
    return {
      status: "unsupported",
      disabledReason: "No electrical drawing occurrence is available for this asset."
    };
  }

  if (electricalSource.terminalResolutionStatus === "missing_symbol") {
    return {
      status: "unsupported",
      disabledReason: "Needs a compatible approved or generated symbol."
    };
  }

  if (
    electricalSource.terminalResolutionStatus !== "resolved" ||
    electricalSource.terminals.length === 0
  ) {
    return {
      status: "unsupported",
      disabledReason:
        electricalSource.terminalResolutionMessage ??
        "Needs resolved electrical terminal metadata."
    };
  }

  return representedPlacementId
    ? { status: "represented" }
    : { status: "available" };
}

export function buildPanelAssociatedAssetCatalog(
  context: PanelDiscoveryBuildContext
): PanelAssociatedAssetCatalogRow[] {
  const associatedIds =
    context.graph.assetIdsByPanelAssetId.get(context.panelAssetId) ??
    new Set<string>();
  const rows: PanelAssociatedAssetCatalogRow[] = [];

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

    rows.push({
      assetId,
      tag: asset?.tag ?? fallback?.tag ?? assetId,
      title: asset?.title ?? fallback?.tag ?? "Missing asset",
      type:
        asset?.type ??
        (fallback?.role === "terminal_block" ? "terminal_block" : "other"),
      status: resolved.status,
      terminalCount,
      representedPlacementId,
      sourceOccurrences: sourceOccurrences
        .map((occurrence) => sourceOccurrenceRef(context, occurrence))
        .sort(
          (first, second) =>
            first.sheetNumber - second.sheetNumber ||
            first.placementId.localeCompare(second.placementId)
        ),
      disabledReason: resolved.disabledReason
    });
  }

  return rows.sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}
