import type {
  PanelAnalysisCategory,
  PanelAnalysisFinding,
  PanelAnalysisFindingGroup,
  PanelAnalysisSeverity
} from "../../data/schema";

export type PanelAnalysisFindingFilters = {
  panelAssetId?: string;
  severity?: PanelAnalysisSeverity;
  category?: PanelAnalysisCategory;
  sheetId?: string;
  assetId?: string;
  query?: string;
};

export type FilteredPanelAnalysisFindingGroup = {
  group: PanelAnalysisFindingGroup;
  findings: PanelAnalysisFinding[];
};

function searchableFindingText(finding: PanelAnalysisFinding): string {
  return [
    finding.title,
    finding.problem,
    finding.significance,
    finding.recommendedAction,
    finding.ruleCode,
    ...finding.evidence.flatMap((item) => [item.label, item.value]),
    ...finding.affectedRecords.flatMap((record) => [record.id, record.label ?? ""]),
    ...finding.locations.flatMap((location) => [
      location.sheetName ?? "",
      String(location.sheetNumber),
      location.objectId ?? ""
    ])
  ].join(" ").toLocaleLowerCase();
}

export function panelAnalysisFindingMatchesFilters(
  finding: PanelAnalysisFinding,
  filters: PanelAnalysisFindingFilters
): boolean {
  if (filters.panelAssetId && !finding.panelAssetIds.includes(filters.panelAssetId)) {
    return false;
  }
  if (filters.severity && finding.severity !== filters.severity) return false;
  if (filters.category && finding.category !== filters.category) return false;
  if (
    filters.sheetId &&
    !finding.locations.some((location) => location.sheetId === filters.sheetId)
  ) {
    return false;
  }
  if (filters.assetId && !finding.assetIds.includes(filters.assetId)) return false;
  const query = filters.query?.trim().toLocaleLowerCase();
  return !query || searchableFindingText(finding).includes(query);
}

export function filterPanelAnalysisFindingGroups({
  groups,
  findings,
  filters
}: {
  groups: readonly PanelAnalysisFindingGroup[];
  findings: readonly PanelAnalysisFinding[];
  filters: PanelAnalysisFindingFilters;
}): FilteredPanelAnalysisFindingGroup[] {
  const matchingById = new Map(
    findings
      .filter((finding) => panelAnalysisFindingMatchesFilters(finding, filters))
      .map((finding) => [finding.id, finding])
  );

  return groups.flatMap((group) => {
    const matching = group.findingIds.flatMap((findingId) => {
      const finding = matchingById.get(findingId);
      return finding ? [finding] : [];
    });
    return matching.length > 0 ? [{ group, findings: matching }] : [];
  });
}
