import {
  panelAnalysisFindingGroupSchema,
  type PanelAnalysisFinding,
  type PanelAnalysisFindingGroup,
  type PanelAnalysisSeverity
} from "../../data/schema";

const severityOrder: Record<PanelAnalysisSeverity, number> = {
  error: 0,
  warning: 1,
  data_gap: 2,
  information: 3
};

function locationKey(
  location: PanelAnalysisFinding["locations"][number]
): string {
  return [
    location.sheetId,
    location.objectKind,
    location.objectId ?? ""
  ].join(":");
}

export function groupPanelAnalysisFindings(
  findings: readonly PanelAnalysisFinding[]
): PanelAnalysisFindingGroup[] {
  const findingsByRootCause = new Map<string, PanelAnalysisFinding[]>();

  for (const finding of findings) {
    findingsByRootCause.set(finding.rootCauseKey, [
      ...(findingsByRootCause.get(finding.rootCauseKey) ?? []),
      finding
    ]);
  }

  return [...findingsByRootCause.entries()]
    .map(([rootCauseKey, relatedFindings]) => {
      const ordered = [...relatedFindings].sort(
        (first, second) =>
          severityOrder[first.severity] - severityOrder[second.severity] ||
          first.id.localeCompare(second.id, undefined, { numeric: true })
      );
      const primary = ordered[0];
      const locations = new Map(
        ordered.flatMap((finding) =>
          finding.locations.map((location) => [locationKey(location), location])
        )
      );

      return panelAnalysisFindingGroupSchema.parse({
        id: `panel-analysis-group:${rootCauseKey}`,
        rootCauseKey,
        title: primary.rootCauseTitle ?? primary.title,
        summary:
          ordered.length === 1
            ? primary.problem
            : ordered.every((finding) => finding.rootCauseSummaryItem)
              ? `${ordered.map((finding) => finding.rootCauseSummaryItem).join("; ")}.`
              : `${ordered.length} related findings originate from this engineering condition.`,
        severity: primary.severity,
        category: primary.category,
        findingIds: ordered.map((finding) => finding.id),
        locations: [...locations.values()].sort(
          (first, second) =>
            first.sheetNumber - second.sheetNumber ||
            (first.objectId ?? "").localeCompare(second.objectId ?? "")
        )
      });
    })
    .sort(
      (first, second) =>
        severityOrder[first.severity] - severityOrder[second.severity] ||
        (first.locations[0]?.sheetNumber ?? Number.MAX_SAFE_INTEGER) -
          (second.locations[0]?.sheetNumber ?? Number.MAX_SAFE_INTEGER) ||
        first.id.localeCompare(second.id, undefined, { numeric: true })
    );
}
