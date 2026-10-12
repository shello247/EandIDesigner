import type {
  PackagePanelDrawingQualityReport,
  PanelDrawingQualityFinding
} from "@/features/drawing_panel_wiring/api/contracts";
import type {
  PanelAnalysisCategory,
  PanelAnalysisFindingDraft
} from "../../api/public";

export type AdaptedPanelQualityFinding = PanelAnalysisFindingDraft & {
  category: PanelAnalysisCategory;
};

const categoryMap: Record<
  PanelDrawingQualityFinding["category"],
  PanelAnalysisCategory
> = {
  asset_identity: "structural_identity",
  panel_context: "structural_identity",
  terminal: "terminal_occupancy",
  external_termination: "external_termination",
  internal_wire: "internal_wiring",
  connection_pattern: "internal_wiring",
  route: "connectivity",
  linked_occurrence: "structural_identity"
};

const significanceByCode: Record<string, string> = {
  duplicate_terminal_conductor_occupancy:
    "Multiple conductor landings on a terminal side can create an unintended electrical junction and make the drawing unsafe to build.",
  duplicate_terminal_structural_occupancy:
    "Conflicting structural memberships make the intended terminal connectivity ambiguous.",
  missing_symbol:
    "The application cannot verify terminals or connectivity without the pinned approved symbol.",
  missing_metadata:
    "The application cannot verify terminal identities and allowed connections without approved terminal metadata.",
  ambiguous:
    "Ambiguous terminal metadata prevents a reliable correspondence between the graphic and the engineering record.",
  unresolved_external_termination:
    "The field connection cannot be proven to land on its intended panel terminal.",
  orphan_internal_wire_route:
    "The graphic route no longer corresponds to a canonical internal-wire record.",
  unrepresented_internal_wire:
    "The canonical internal wire exists, but engineers cannot see its route on a detailed drawing."
};

const actionByCode: Record<string, string> = {
  duplicate_terminal_conductor_occupancy:
    "Review the listed conductors and retain only the intended landing or document an approved multi-conductor termination method.",
  duplicate_terminal_structural_occupancy:
    "Correct the bridge, bond, or distribution memberships so the terminal has one intentional structural definition.",
  missing_symbol:
    "Restore the exact pinned approved symbol version before relying on this package.",
  missing_metadata:
    "Add or correct approved terminal metadata on a new symbol version, then re-run analysis.",
  ambiguous:
    "Correct the symbol terminal-to-anchor mapping on a new approved version.",
  unresolved_external_termination:
    "Correct the endpoint anchor or terminal mapping and verify the resolved landing.",
  orphan_internal_wire_route:
    "Remove the orphan route or restore its canonical internal-wire record.",
  unrepresented_internal_wire:
    "Restore a route for the canonical wire on the appropriate detailed sheet."
};

function rootCauseKey(finding: PanelDrawingQualityFinding): string {
  if (finding.sourceFindingIds.length > 0) {
    return `panel-quality-source:${[...finding.sourceFindingIds].sort().join("+")}`;
  }
  if (finding.terminal) {
    return `panel-quality-terminal:${finding.code}:${finding.terminal.assetId}:${finding.terminal.terminalKey}:${finding.terminal.side}`;
  }
  return `panel-quality:${finding.code}:${finding.assetId ?? finding.wireId ?? finding.internalWireId ?? finding.patternId ?? finding.id}`;
}

function affectedRecords(finding: PanelDrawingQualityFinding) {
  const records: AdaptedPanelQualityFinding["affectedRecords"] = [
    { kind: "panel", id: finding.panelAssetId }
  ];
  if (finding.assetId) {
    records.push({
      kind: "asset",
      id: finding.assetId,
      label: finding.assetTag
    });
  }
  if (finding.terminal) {
    records.push({
      kind: "terminal",
      id: `${finding.terminal.assetId}:${finding.terminal.terminalKey}:${finding.terminal.side}`,
      assetId: finding.terminal.assetId,
      terminalKey: finding.terminal.terminalKey,
      terminalSide: finding.terminal.side
    });
  }
  if (finding.internalWireId) {
    records.push({ kind: "internal_wire", id: finding.internalWireId });
  }
  if (finding.wireId) {
    records.push({ kind: "conductor", id: finding.wireId });
  }
  for (const location of finding.locations) {
    if (location.objectKind === "connection" && location.objectId) {
      records.push({ kind: "connection", id: location.objectId });
    }
  }
  return records;
}

function locations(finding: PanelDrawingQualityFinding) {
  return finding.locations.map((location) => ({
    sheetId: location.sheetId,
    sheetNumber: location.sheetNumber,
    sheetName: location.sheetName,
    objectKind:
      location.objectKind === "placement" ||
      location.objectKind === "connection"
        ? location.objectKind
        : ("panel_context" as const),
    objectId:
      location.objectKind === "placement" ||
      location.objectKind === "connection"
        ? location.objectId
        : undefined
  }));
}

function adaptFinding(
  finding: PanelDrawingQualityFinding
): AdaptedPanelQualityFinding {
  const title =
    finding.message.length > 240
      ? `${finding.message.slice(0, 237).trimEnd()}...`
      : finding.message;
  return {
    findingKey: `${finding.panelAssetId}:${finding.id}`,
    category: categoryMap[finding.category],
    severity:
      finding.severity === "blocking_error"
        ? "error"
        : finding.severity === "warning"
          ? "warning"
          : "information",
    evidenceLevel: "verified",
    title,
    problem: finding.message,
    significance:
      significanceByCode[finding.code] ??
      "This condition reduces confidence that the saved drawing package represents one consistent engineering record.",
    recommendedAction:
      actionByCode[finding.code] ??
      "Review the affected records in the drawing and correct the underlying engineering data.",
    rootCauseKey: rootCauseKey(finding),
    panelAssetIds: [finding.panelAssetId],
    assetIds: finding.assetId ? [finding.assetId] : [],
    affectedRecords: affectedRecords(finding),
    evidence: [
      { label: "Quality check", value: finding.code },
      { label: "Source finding", value: finding.id },
      ...(finding.sourceFindingIds.length > 0
        ? [
            {
              label: "Supporting findings",
              value: [...finding.sourceFindingIds].sort().join(", ")
            }
          ]
        : [])
    ],
    locations: locations(finding)
  };
}

export function adaptPanelQualityFindings(
  report: PackagePanelDrawingQualityReport
): AdaptedPanelQualityFinding[] {
  return report.reports
    .flatMap((panelReport) => panelReport.findings)
    .map(adaptFinding)
    .sort(
      (first, second) =>
        first.category.localeCompare(second.category) ||
        first.findingKey.localeCompare(second.findingKey, undefined, {
          numeric: true
        })
    );
}
