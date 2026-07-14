import { describe, expect, it } from "vitest";
import { buildPanelScheduleCsv } from "../logic/services/panel-schedule-export";
import { buildPanelScheduleWorkbook } from "../logic/services/panel-xlsx-export";
import { renderPanelScheduleForPrint } from "../logic/services/panel-schedule-print-renderer";
import { validatePanelDeliverableRequest } from "../logic/services/panel-deliverable-validation";
import { createPanelReportBundle } from "./fixtures";

describe("panel schedule export", () => {
  it("writes deterministic UTF-8 CSV with stable metadata columns", () => {
    const csv = buildPanelScheduleCsv(createPanelReportBundle(), "terminal_schedule");
    expect(csv.startsWith("\uFEFFIssue Status,Drawing,QC Status,Panel")).toBe(true);
    expect(csv).toContain("DRAFT,DRW-REPORTS,BLOCKED,ENC-001");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("creates the selected workbook sheets without duplicate report tabs", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const bytes = await buildPanelScheduleWorkbook(createPanelReportBundle(), [
      "terminal_schedule",
      "internal_wire_schedule",
      "panel_asset_schedule",
      "bom",
      "bom"
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Manifest",
      "Terminal Schedule",
      "Internal Wires",
      "Panel Assets",
      "BOM Summary",
      "BOM Assemblies"
    ]);
    expect(workbook.getWorksheet("Terminal Schedule")?.rowCount).toBe(21);
  }, 20_000);

  it("renders only selected A3 schedule sections with a draft watermark", () => {
    const pages = renderPanelScheduleForPrint(createPanelReportBundle(), [
      "terminal_schedule",
      "internal_wire_schedule"
    ]);
    expect(pages).toHaveLength(2);
    expect(pages[0].svg).toContain("DRAFT - NOT FOR ISSUE");
    expect(pages[0].svg).toContain('data-panel-schedule="terminal_schedule"');
    expect(pages[1].svg).toContain('data-panel-schedule="internal_wire_schedule"');
  });

  it("allows blocked drafts but requires approved package-wide clean QC for issuance", () => {
    const bundle = createPanelReportBundle();
    const quality = {
      reports: [],
      counts: bundle.manifest.qcCounts,
      canApprove: false
    };
    const draft = {
      scope: { kind: "active_panel" as const, panelAssetId: bundle.panels[0].panelAssetId },
      reports: ["terminal_schedule" as const],
      issueMode: "draft" as const,
      pdfComposition: "schedules_only" as const
    };
    expect(() =>
      validatePanelDeliverableRequest({
        request: draft,
        drawingStatus: "needs_review",
        quality,
        availablePanelIds: new Set([bundle.panels[0].panelAssetId])
      })
    ).not.toThrow();
    expect(() =>
      validatePanelDeliverableRequest({
        request: { ...draft, issueMode: "issued" },
        drawingStatus: "approved",
        quality,
        availablePanelIds: new Set([bundle.panels[0].panelAssetId])
      })
    ).toThrow("panel QC");
  });
});
