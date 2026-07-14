import type {
  PanelDrawingQualityFinding,
  PanelDrawingQualityReport
} from "../../data/schema";
import type {
  GroupedPanelDrawingFindings,
  PanelFindingNavigationTarget
} from "../../types";

const SEVERITIES: PanelDrawingQualityFinding["severity"][] = [
  "blocking_error",
  "warning",
  "information"
];

export function groupPanelDrawingFindings(
  report: PanelDrawingQualityReport
): GroupedPanelDrawingFindings[] {
  return SEVERITIES.map((severity) => {
    const findings = report.findings.filter(
      (finding) => finding.severity === severity
    );
    return { severity, count: findings.length, findings };
  }).filter((group) => group.count > 0);
}

export function getPanelFindingNavigationTarget(
  finding: PanelDrawingQualityFinding
): PanelFindingNavigationTarget | undefined {
  const primary = [...finding.locations].sort(
    (first, second) =>
      first.sheetNumber - second.sheetNumber ||
      (first.objectId ?? "").localeCompare(second.objectId ?? "")
  )[0];

  if (primary?.objectKind === "placement" || primary?.objectKind === "connection") {
    return { kind: "sheet_object", location: primary };
  }
  if (primary?.objectKind === "panel_context") {
    return { kind: "panel_context", location: primary };
  }
  if (finding.category === "external_termination") {
    return {
      kind: "work_queue",
      panelAssetId: finding.panelAssetId,
      tab: finding.terminal ? "terminal-map" : "terminations",
      objectId: primary?.objectId
    };
  }
  if (finding.category === "internal_wire") {
    return {
      kind: "work_queue",
      panelAssetId: finding.panelAssetId,
      tab: "internal-wires",
      objectId: finding.internalWireId
    };
  }
  if (finding.category === "connection_pattern") {
    return {
      kind: "work_queue",
      panelAssetId: finding.panelAssetId,
      tab: "patterns",
      objectId: finding.patternId
    };
  }
  return primary ? { kind: "sheet_object", location: primary } : undefined;
}

export function canApprovePanelDrawing(
  report: PanelDrawingQualityReport
): boolean {
  return report.counts.blockingErrors === 0;
}
