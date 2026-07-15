import type { PanelDrawingQualityReport, PanelTerminalSide } from "../../data/schema";
import type {
  ExternalTerminationMappingRow,
  PanelAssetWorkflowRow,
  PanelConnectionPatternCatalogRow,
  PanelDiscoveryIndex,
  PanelGuidedWorkflowAction,
  PanelGuidedWorkflowSnapshot,
  PanelGuidedWorkflowStep,
  PanelInternalWireCatalogRow,
  PanelTerminalCatalogRow,
  PanelWorkflowFilteredRecords
} from "../../types";

function naturalTagCompare(
  first: { tag: string },
  second: { tag: string }
): number {
  return first.tag.localeCompare(second.tag, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function terminationTargetsAsset(
  row: ExternalTerminationMappingRow,
  assetId: string,
  sourcePlacementIds: ReadonlySet<string>
): boolean {
  return (
    row.effectiveTarget?.assetId === assetId ||
    row.target?.assetId === assetId ||
    row.inferredTarget?.assetId === assetId ||
    row.targetAssetId === assetId ||
    sourcePlacementIds.has(`${row.source.sheetId}:${row.source.placementId}`)
  );
}

function patternTargetsAsset(
  row: PanelConnectionPatternCatalogRow,
  assetId: string
): boolean {
  if (row.recordType === "bridge") {
    return row.record.members.some((member) => member.assetId === assetId);
  }

  return row.record.endpoints.some(
    (endpoint) =>
      endpoint.kind === "terminal" && endpoint.terminal.assetId === assetId
  );
}

export function filterPanelWorkflowRecordsByAsset({
  index,
  internalWires,
  connectionPatterns,
  assetId
}: {
  index: PanelDiscoveryIndex;
  internalWires: readonly PanelInternalWireCatalogRow[];
  connectionPatterns: readonly PanelConnectionPatternCatalogRow[];
  assetId: string;
}): PanelWorkflowFilteredRecords {
  const asset = index.assetsById.get(assetId);
  const sourcePlacementIds = new Set(
    asset?.sourceOccurrences.map(
      (source) => `${source.sheetId}:${source.placementId}`
    ) ?? []
  );

  return {
    asset,
    terminations: [...index.mappingRowsByTerminationId.values()].filter((row) =>
      terminationTargetsAsset(row, assetId, sourcePlacementIds)
    ),
    terminals: [...index.terminalCatalog.rowsByTerminalId.values()].filter(
      (row) => row.terminal.assetId === assetId
    ),
    internalWires: internalWires.filter(
      (row) =>
        row.wire.from.assetId === assetId || row.wire.to.assetId === assetId
    ),
    connectionPatterns: connectionPatterns.filter((row) =>
      patternTargetsAsset(row, assetId)
    )
  };
}

function requiredConnectionSides(row: PanelTerminalCatalogRow): Set<PanelTerminalSide> {
  const required = new Set(row.requiredSides ?? []);
  const externalOccupancy = row.occupancy.external;

  if (
    row.supportedSides.includes("external") &&
    row.supportedSides.includes("internal") &&
    (externalOccupancy?.conductorOccupants.length ?? 0) > 0
  ) {
    required.add("internal");
  }

  return required;
}

function assetWorkflowRow({
  index,
  assetId,
  internalWires,
  connectionPatterns,
  qualityReport
}: {
  index: PanelDiscoveryIndex;
  assetId: string;
  internalWires: readonly PanelInternalWireCatalogRow[];
  connectionPatterns: readonly PanelConnectionPatternCatalogRow[];
  qualityReport?: PanelDrawingQualityReport;
}): PanelAssetWorkflowRow {
  const records = filterPanelWorkflowRecordsByAsset({
    index,
    internalWires,
    connectionPatterns,
    assetId
  });
  const asset = records.asset!;
  const unresolvedMappings = records.terminations.filter(
    (row) =>
      row.mappingMode === "unmapped" ||
      row.mappingMode === "conflicting" ||
      !row.effectiveTarget ||
      ["missing", "conflicting", "unsupported"].includes(row.status)
  );
  const requiredSides = records.terminals.flatMap((terminal) =>
    [...requiredConnectionSides(terminal)].map((side) => ({ terminal, side }))
  );
  const missingRequiredSides = requiredSides.filter(({ terminal, side }) => {
    const occupancy = terminal.occupancy[side];
    return !occupancy || occupancy.status === "available";
  });
  const conflictingTerminal = records.terminals
    .flatMap((terminal) => terminal.findings)
    .find((finding) => finding.severity === "error");
  const qualityBlocker = qualityReport?.findings.find(
    (finding) =>
      finding.assetId === assetId &&
      finding.severity === "blocking_error" &&
      finding.code !== "required_terminal_unconnected"
  );
  const blockingReason =
    asset.status === "missing" ||
    asset.status === "conflicting" ||
    asset.status === "unsupported"
      ? asset.disabledReason ?? "This asset is not ready for Detailed Panel work."
      : conflictingTerminal?.message ?? qualityBlocker?.message;

  let status: PanelAssetWorkflowRow["status"];
  if (blockingReason) {
    status = "blocked";
  } else if (!asset.representedPlacementId) {
    status = "not_placed";
  } else if (unresolvedMappings.length > 0) {
    status = "needs_mapping";
  } else if (missingRequiredSides.length > 0) {
    status = "needs_internal_wiring";
  } else {
    status = "ready";
  }

  return {
    assetId: asset.assetId,
    tag: asset.tag,
    title: asset.title,
    status,
    representedPlacementId: asset.representedPlacementId,
    terminationCount: records.terminations.length,
    unresolvedMappingCount: unresolvedMappings.length,
    requiredConnectionCount: requiredSides.length,
    missingRequiredConnectionCount: missingRequiredSides.length,
    blockingReason
  };
}

function workflowSteps(
  focused: PanelAssetWorkflowRow | undefined,
  qualityReport: PanelDrawingQualityReport | undefined
): PanelGuidedWorkflowStep[] {
  const blocked = focused?.status === "blocked";
  const represented = Boolean(focused?.representedPlacementId);
  const wiringComplete = Boolean(
    represented && focused?.missingRequiredConnectionCount === 0
  );

  return [
    {
      id: "place-representation",
      label: "Add Equipment",
      description: "Choose equipment and add the existing physical asset to this sheet.",
      status: blocked ? "blocked" : represented ? "complete" : focused ? "needs_action" : "blocked"
    },
    {
      id: "review-terminations",
      label: "Review Terminals",
      description: "Review field wiring provenance and resolve each conductor to its terminal side.",
      status: blocked
        ? "blocked"
        : !represented
          ? "blocked"
          : focused?.unresolvedMappingCount
            ? "needs_action"
            : "complete",
      count: focused?.terminationCount ?? 0
    },
    {
      id: "create-internal-wiring",
      label: "Internal Wiring",
      description: "Connect required internal or single-sided terminals.",
      status: blocked
        ? "blocked"
        : !represented
          ? "blocked"
          : wiringComplete
            ? "complete"
            : "needs_action",
      count: focused?.missingRequiredConnectionCount ?? 0
    },
    {
      id: "engineering-review",
      label: "Review",
      description: "Run deterministic panel connectivity quality control.",
      status: qualityReport
        ? qualityReport.counts.blockingErrors > 0
          ? "needs_action"
          : "complete"
        : "ready",
      count: qualityReport?.counts.blockingErrors
    },
    {
      id: "deliverables",
      label: "Deliverables",
      description: "Generate draft or issued schedules and drawing output.",
      status: qualityReport?.counts.blockingErrors ? "blocked" : "ready"
    }
  ];
}

export function getNextPanelWorkflowAction(
  assets: readonly PanelAssetWorkflowRow[],
  focusAssetId: string | undefined,
  qualityReport?: PanelDrawingQualityReport
): PanelGuidedWorkflowAction {
  if (assets.length === 0) return { kind: "none" };
  const focused = assets.find((asset) => asset.assetId === focusAssetId);

  if (!focused) {
    const first = assets.find((asset) => asset.status !== "ready") ?? assets[0];
    return { kind: "select_asset", assetId: first.assetId };
  }
  if (focused.status === "blocked") {
    return { kind: "open_step", stepId: "place-representation" };
  }
  if (focused.status === "not_placed") {
    return { kind: "open_step", stepId: "place-representation" };
  }
  if (focused.status === "needs_mapping") {
    return { kind: "open_step", stepId: "review-terminations" };
  }
  if (focused.status === "needs_internal_wiring") {
    return { kind: "open_step", stepId: "create-internal-wiring" };
  }

  const nextAsset = assets.find(
    (asset) => asset.assetId !== focused.assetId && asset.status !== "ready"
  );
  if (nextAsset) {
    return { kind: "next_asset", assetId: nextAsset.assetId };
  }
  if (!qualityReport || qualityReport.counts.blockingErrors > 0) {
    return { kind: "open_step", stepId: "engineering-review" };
  }
  return { kind: "open_step", stepId: "deliverables" };
}

export function buildPanelGuidedWorkflowSnapshot({
  index,
  internalWires,
  connectionPatterns,
  persistedFocusAssetId,
  qualityReport
}: {
  index: PanelDiscoveryIndex;
  internalWires: readonly PanelInternalWireCatalogRow[];
  connectionPatterns: readonly PanelConnectionPatternCatalogRow[];
  persistedFocusAssetId?: string;
  qualityReport?: PanelDrawingQualityReport;
}): PanelGuidedWorkflowSnapshot {
  const assets = [...index.assetsById.keys()]
    .map((assetId) =>
      assetWorkflowRow({
        index,
        assetId,
        internalWires,
        connectionPatterns,
        qualityReport
      })
    )
    .sort(naturalTagCompare);
  const persistedFocus = assets.find(
    (asset) => asset.assetId === persistedFocusAssetId
  );
  const fallbackFocus =
    assets.find((asset) => asset.status !== "ready") ?? assets[0];
  const focusAssetId = persistedFocus?.assetId ?? fallbackFocus?.assetId;
  const focused = assets.find((asset) => asset.assetId === focusAssetId);
  const readyAssetCount = assets.filter((asset) => asset.status === "ready").length;

  return {
    panelAssetId: index.panelAssetId,
    detailedSheetId: index.detailedSheetId,
    persistedFocusAssetId,
    focusAssetId,
    staleFocusAssetId:
      persistedFocusAssetId && !persistedFocus
        ? persistedFocusAssetId
        : undefined,
    assets,
    steps: workflowSteps(focused, qualityReport),
    nextAction: getNextPanelWorkflowAction(
      assets,
      focusAssetId,
      qualityReport
    ),
    readyAssetCount,
    totalAssetCount: assets.length,
    allAssetsReady: assets.length > 0 && readyAssetCount === assets.length
  };
}
