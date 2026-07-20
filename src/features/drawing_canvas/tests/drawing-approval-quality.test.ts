import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema
} from "../data/schema";
import { buildDrawingApprovalDecision } from "../logic/services/drawing-approval-quality";

describe("drawing approval quality", () => {
  it("preserves approval for legacy packages without Detailed Panel contexts", () => {
    const decision = buildDrawingApprovalDecision(createDefaultDrawingModel(), []);

    expect(decision.status).toBe("approved");
    expect(decision.quality.reports).toEqual([]);
  });

  it("keeps a package in review when its panel context references a missing asset", () => {
    const base = createDefaultDrawingModel();
    const model = drawingPackageModelSchema.parse({
      ...base,
      sheets: [
        {
          ...createDefaultDrawingSheet({
            id: "sheet_blocked_panel",
            name: "Blocked Panel"
          }),
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: "missing_panel_asset"
          }
        }
      ]
    });
    const decision = buildDrawingApprovalDecision(model, []);

    expect(decision.status).toBe("needs_review");
    expect(decision.quality.counts.blockingErrors).toBeGreaterThan(0);
    expect(decision.quality.firstBlockingFinding?.panelAssetId).toBe(
      "missing_panel_asset"
    );
  });
});
