import type {
  PanelConnectivityGraph,
  PanelDrawingQualityFinding,
  PanelTerminalSideRef
} from "@/features/drawing_panel_wiring/api/public";
import type {
  PanelReportFindingRef,
  PanelReportSheetRef
} from "../../data/schema";

export function naturalCompare(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function terminalId(ref: Pick<PanelTerminalSideRef, "assetId" | "terminalKey">) {
  return `terminal:${encodeURIComponent(ref.assetId)}:${encodeURIComponent(ref.terminalKey)}`;
}

export function terminalSideId(ref: PanelTerminalSideRef) {
  return `${terminalId(ref)}:${ref.side}`;
}

export function terminalDisplayLabel(
  graph: PanelConnectivityGraph,
  ref: PanelTerminalSideRef
): string {
  const asset = graph.assetsById.get(ref.assetId);
  const terminal = graph.terminalsById.get(terminalId(ref));
  return `${asset?.tag ?? ref.assetId}:${terminal?.label ?? ref.terminalKey}/${ref.side}`;
}

export function sheetRef(
  graph: PanelConnectivityGraph,
  sheetId: string,
  objectId?: string
): PanelReportSheetRef | undefined {
  const sheet = graph.sheetsById.get(sheetId);
  return sheet
    ? {
        sheetId,
        sheetNumber: sheet.sheetNumber,
        sheetName: sheet.name,
        objectId
      }
    : undefined;
}

export function uniqueSheetRefs(refs: Array<PanelReportSheetRef | undefined>) {
  const unique = new Map<string, PanelReportSheetRef>();
  refs.forEach((ref) => {
    if (ref) unique.set(`${ref.sheetId}:${ref.objectId ?? ""}`, ref);
  });
  return [...unique.values()].sort(
    (first, second) =>
      first.sheetNumber - second.sheetNumber ||
      naturalCompare(first.objectId ?? "", second.objectId ?? "")
  );
}

export function findingRefs(
  findings: PanelDrawingQualityFinding[],
  predicate: (finding: PanelDrawingQualityFinding) => boolean
): PanelReportFindingRef[] {
  return findings
    .filter(predicate)
    .map((finding) => ({
      id: finding.id,
      code: finding.code,
      severity: finding.severity,
      message: finding.message
    }))
    .sort((first, second) => naturalCompare(first.id, second.id));
}
