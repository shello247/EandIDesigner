import type { PackagePanelDrawingQualityReport } from "@/features/drawing_panel_wiring/api/public";
import {
  panelDeliverableRequestSchema,
  type PanelDeliverableRequest
} from "../../data/schema";

export function validatePanelDeliverableRequest({
  request,
  drawingStatus,
  quality,
  availablePanelIds
}: {
  request: PanelDeliverableRequest;
  drawingStatus: "draft" | "needs_review" | "approved" | "archived";
  quality: PackagePanelDrawingQualityReport;
  availablePanelIds: ReadonlySet<string>;
}): PanelDeliverableRequest {
  const parsed = panelDeliverableRequestSchema.parse(request);
  if (
    parsed.scope.kind === "active_panel" &&
    !availablePanelIds.has(parsed.scope.panelAssetId)
  ) {
    throw new Error("The selected panel is not referenced by a Detailed Panel Drawing.");
  }
  if (parsed.issueMode === "issued") {
    if (drawingStatus !== "approved") {
      throw new Error("Issued deliverables require an approved drawing.");
    }
    const blockers = quality.counts.blockingErrors;
    if (blockers > 0) {
      throw new Error(`Issued deliverables are blocked by ${blockers} panel QC finding${blockers === 1 ? "" : "s"}.`);
    }
  }
  return { ...parsed, reports: [...new Set(parsed.reports)] };
}
