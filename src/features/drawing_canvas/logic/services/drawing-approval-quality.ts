import { reviewPackagePanelDrawings } from "@/features/drawing_panel_wiring/api/public";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";

export function buildDrawingApprovalDecision(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
) {
  const quality = reviewPackagePanelDrawings(
    createPanelWiringSource(model, symbols)
  );
  return {
    quality,
    status: quality.canApprove
      ? ("approved" as const)
      : ("needs_review" as const)
  };
}
