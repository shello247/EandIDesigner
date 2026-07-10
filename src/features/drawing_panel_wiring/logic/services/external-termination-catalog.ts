import type {
  ExternalTerminationCatalogRow,
  PanelAssociatedAssetCatalogRow,
  PanelDiscoveryBuildContext,
  PanelDiscoveryStatus,
  PanelExternalTermination
} from "../../types";

function terminationStatus(
  termination: PanelExternalTermination,
  targetAsset: PanelAssociatedAssetCatalogRow | undefined
): { status: PanelDiscoveryStatus; disabledReason?: string } {
  if (termination.status === "unresolved") {
    return termination.unresolvedCode === "missing_terminal_side"
      ? {
          status: "missing",
          disabledReason:
            termination.unresolvedReason ?? "The mapped terminal side is missing."
        }
      : {
          status: "unsupported",
          disabledReason:
            termination.unresolvedReason ??
            "The source anchor cannot be resolved to terminal metadata."
        };
  }

  if (!termination.target || !targetAsset) {
    return {
      status: "missing",
      disabledReason: "The target panel asset is missing from the associated inventory."
    };
  }

  if (["missing", "conflicting", "unsupported"].includes(targetAsset.status)) {
    return {
      status: targetAsset.status,
      disabledReason: targetAsset.disabledReason
    };
  }

  return targetAsset.representedPlacementId
    ? { status: "represented" }
    : { status: "available" };
}

export function buildExternalTerminationCatalog(
  context: PanelDiscoveryBuildContext,
  associatedAssets: readonly PanelAssociatedAssetCatalogRow[]
): ExternalTerminationCatalogRow[] {
  const assetsById = new Map(
    associatedAssets.map((asset) => [asset.assetId, asset])
  );
  const terminationIds =
    context.graph.externalTerminationIdsByPanelAssetId.get(
      context.panelAssetId
    ) ?? [];

  return terminationIds
    .flatMap((terminationId): ExternalTerminationCatalogRow[] => {
      const termination =
        context.graph.externalTerminationsById.get(terminationId);

      if (!termination) {
        return [];
      }

      const targetAssetId = termination.target?.assetId;
      const targetAsset = targetAssetId
        ? assetsById.get(targetAssetId)
        : undefined;
      const resolved = terminationStatus(termination, targetAsset);

      return [{
        terminationId: termination.id,
        panelAssetId: termination.panelAssetId,
        status: resolved.status,
        target: termination.target,
        targetAssetId,
        targetAssetTag: targetAsset?.tag,
        representedPlacementId: targetAsset?.representedPlacementId,
        wireId: termination.wireId,
        cableAssetId: termination.cableAssetId,
        cablePlacementId: termination.cablePlacementId,
        cableTag: termination.cableTag,
        conductorKey: termination.conductorKey,
        source: termination.source,
        sourceSheet: termination.sourceSheet,
        disabledReason: resolved.disabledReason
      } satisfies ExternalTerminationCatalogRow];
    })
    .sort(
      (first, second) =>
        first.sourceSheet.number - second.sourceSheet.number ||
        (first.wireId ?? "").localeCompare(second.wireId ?? "", undefined, {
          numeric: true
        }) ||
        first.terminationId.localeCompare(second.terminationId)
    );
}
