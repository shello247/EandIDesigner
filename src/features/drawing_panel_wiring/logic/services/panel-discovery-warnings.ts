import type {
  ExternalTerminationCatalogRow,
  PanelAssociatedAssetCatalogRow,
  PanelConnectivityFinding,
  PanelDiscoveryBuildContext
} from "../../types";

export function detectPanelDiscoveryWarnings(
  context: PanelDiscoveryBuildContext,
  assets: readonly PanelAssociatedAssetCatalogRow[],
  terminations: readonly ExternalTerminationCatalogRow[]
): PanelConnectivityFinding[] {
  const findings = new Map<string, PanelConnectivityFinding>();

  context.graph.findings
    .filter(
      (finding) =>
        finding.panelAssetId === context.panelAssetId ||
        (finding.assetId
          ? context.graph.panelAssetIdsByAssetId
              .get(finding.assetId)
              ?.has(context.panelAssetId)
          : false)
    )
    .forEach((finding) => findings.set(finding.id, finding));

  for (const asset of assets) {
    const panelIds = context.graph.panelAssetIdsByAssetId.get(asset.assetId);

    if (panelIds && panelIds.size > 1) {
      findings.set(`asset_multiple_panels:${asset.assetId}`, {
        id: `asset_multiple_panels:${asset.assetId}`,
        severity: "warning",
        code: "asset_associated_with_multiple_panels",
        message: `${asset.tag} is associated with more than one panel context.`,
        panelAssetId: context.panelAssetId,
        assetId: asset.assetId
      });
    }

    if (["missing", "conflicting", "unsupported"].includes(asset.status)) {
      findings.set(`asset_discovery:${asset.status}:${asset.assetId}`, {
        id: `asset_discovery:${asset.status}:${asset.assetId}`,
        severity: asset.status === "conflicting" ? "error" : "warning",
        code: `panel_asset_${asset.status}`,
        message: asset.disabledReason ?? `${asset.tag} cannot be represented.`,
        panelAssetId: context.panelAssetId,
        assetId: asset.assetId
      });
    }
  }

  const detailedSheet = context.graph.sheetsById.get(context.detailedSheetId);
  const representationCounts = new Map<string, number>();

  detailedSheet?.occurrences.forEach((occurrence) => {
    if (occurrence.assetId) {
      representationCounts.set(
        occurrence.assetId,
        (representationCounts.get(occurrence.assetId) ?? 0) + 1
      );
    }
  });

  for (const [assetId, count] of representationCounts) {
    if (count > 1) {
      findings.set(`duplicate_panel_representation:${assetId}`, {
        id: `duplicate_panel_representation:${assetId}`,
        severity: "error",
        code: "duplicate_panel_asset_representation",
        message: "The Detailed Panel Drawing contains duplicate occurrences of one physical asset.",
        panelAssetId: context.panelAssetId,
        assetId
      });
    }
  }

  for (const termination of terminations) {
    if (["missing", "conflicting", "unsupported"].includes(termination.status)) {
      const id = `termination_discovery:${termination.status}:${termination.terminationId}`;
      findings.set(id, {
        id,
        severity: termination.status === "conflicting" ? "error" : "warning",
        code: `external_termination_${termination.status}`,
        message:
          termination.disabledReason ??
          "The external termination cannot be represented safely.",
        panelAssetId: context.panelAssetId,
        assetId: termination.targetAssetId,
        source: termination.source
      });
    }
  }

  return [...findings.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}
