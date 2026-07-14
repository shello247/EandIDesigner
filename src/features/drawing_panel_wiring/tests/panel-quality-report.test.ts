import { describe, expect, it } from "vitest";
import type { PanelDrawingQualityReport } from "../data/schema";
import {
  canApprovePanelDrawing,
  getPanelFindingNavigationTarget,
  groupPanelDrawingFindings
} from "../logic/services/panel-quality-grouping";

const report: PanelDrawingQualityReport = {
  panelAssetId: "panel_1",
  panelTag: "JB001",
  status: "blocked",
  counts: { blockingErrors: 1, warnings: 1, information: 0 },
  canApprove: false,
  findings: [
    {
      id: "finding_error",
      code: "broken_route_endpoint",
      severity: "blocking_error",
      category: "route",
      message: "Route endpoint is missing.",
      panelAssetId: "panel_1",
      locations: [
        {
          sheetId: "sheet_2",
          sheetNumber: 2,
          sheetName: "Panel detail",
          objectKind: "connection",
          objectId: "connection_1"
        }
      ],
      sourceFindingIds: []
    },
    {
      id: "finding_warning",
      code: "terminal_capacity_unverified",
      severity: "warning",
      category: "terminal",
      message: "Capacity is not verified.",
      panelAssetId: "panel_1",
      locations: [],
      sourceFindingIds: []
    }
  ]
};

describe("panel quality reports", () => {
  it("groups findings and resolves deterministic sheet navigation", () => {
    expect(groupPanelDrawingFindings(report).map((group) => group.count)).toEqual([
      1,
      1
    ]);
    expect(getPanelFindingNavigationTarget(report.findings[0])).toEqual({
      kind: "sheet_object",
      location: report.findings[0].locations[0]
    });
  });

  it("blocks approval only when blocking findings exist", () => {
    expect(canApprovePanelDrawing(report)).toBe(false);
    expect(
      canApprovePanelDrawing({
        ...report,
        status: "review_required",
        counts: { blockingErrors: 0, warnings: 1, information: 0 },
        canApprove: true,
        findings: report.findings.slice(1)
      })
    ).toBe(true);
  });
});
