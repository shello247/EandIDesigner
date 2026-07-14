import {
  panelDeliverableRequestSchema,
  type PanelDeliverableRequest,
  type PanelReportKind
} from "../../data/schema";

const validReports = new Set<PanelReportKind>([
  "terminal_schedule",
  "internal_wire_schedule",
  "panel_asset_schedule",
  "bom"
]);

export function parsePanelDeliverableSearchParams(
  searchParams: URLSearchParams
): PanelDeliverableRequest {
  const reports = (searchParams.get("reports") ?? "terminal_schedule,internal_wire_schedule,panel_asset_schedule,bom")
    .split(",")
    .filter((item): item is PanelReportKind => validReports.has(item as PanelReportKind));
  const scope = searchParams.get("scope") === "all_panels"
    ? { kind: "all_panels" as const }
    : {
        kind: "active_panel" as const,
        panelAssetId: searchParams.get("panelAssetId") ?? ""
      };
  return panelDeliverableRequestSchema.parse({
    scope,
    reports,
    issueMode: searchParams.get("issueMode") ?? "draft",
    pdfComposition: searchParams.get("composition") ?? "schedules_only"
  });
}

export function panelDeliverableQueryString(request: PanelDeliverableRequest) {
  const params = new URLSearchParams({
    scope: request.scope.kind,
    reports: request.reports.join(","),
    issueMode: request.issueMode,
    composition: request.pdfComposition
  });
  if (request.scope.kind === "active_panel") {
    params.set("panelAssetId", request.scope.panelAssetId);
  }
  return params.toString();
}
