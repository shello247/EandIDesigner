import type { PanelReportTraceRef } from "../../data/schema";

export function getPanelReportNavigationTarget(
  traces: PanelReportTraceRef[],
  preferredKind?: PanelReportTraceRef["kind"]
): PanelReportTraceRef | undefined {
  return (
    (preferredKind ? traces.find((trace) => trace.kind === preferredKind) : undefined) ??
    traces[0]
  );
}
