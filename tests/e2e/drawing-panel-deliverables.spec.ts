import { expect, test } from "@playwright/test";
import {
  createE2ePanelQualityPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";
import { loadSheetFromSheetLoader } from "./panel-workflow-helpers";

test("reviews, traces, and exports deterministic panel deliverables", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await loadSheetFromSheetLoader(
      page,
      "JB001 Detailed Panel Drawing",
      /JB001 Detailed Panel Drawing Detailed Panel/
    );

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Panel Deliverables/ })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Preview", exact: true }).click();

    const exportBase = {
      scope: "active_panel",
      panelAssetId: "asset_jb_001",
      issueMode: "draft",
      composition: "schedules_only"
    };
    const terminalCsvQuery = new URLSearchParams({
      ...exportBase,
      report: "terminal_schedule"
    });
    const terminalCsvResponse = await page.request.get(
      `/drawings/${drawingId}/deliverables/csv?${terminalCsvQuery}`
    );
    expect(terminalCsvResponse.ok()).toBe(true);
    expect(terminalCsvResponse.headers()["content-type"]).toContain("text/csv");
    expect(terminalCsvResponse.headers()["content-disposition"]).toMatch(
      /DRAFT_.*terminal_schedule\.csv/
    );
    const terminalCsv = await terminalCsvResponse.text();
    expect(terminalCsv).toContain("TB-101");
    expect(terminalCsv).toContain("C-101-P1-WHT");

    const assetCsvQuery = new URLSearchParams({
      ...exportBase,
      report: "panel_asset_schedule"
    });
    const assetCsvResponse = await page.request.get(
      `/drawings/${drawingId}/deliverables/csv?${assetCsvQuery}`
    );
    expect(assetCsvResponse.ok()).toBe(true);
    const assetCsv = await assetCsvResponse.text();
    expect(assetCsv).toContain("Field Junction Box");
    expect(assetCsv).not.toContain("Field Cable 101");

    const issuedQuery = new URLSearchParams({
      ...exportBase,
      report: "terminal_schedule",
      issueMode: "issued"
    });
    expect(
      (
        await page.request.get(
          `/drawings/${drawingId}/deliverables/csv?${issuedQuery}`
        )
      ).status()
    ).toBe(400);

    const workbookQuery = new URLSearchParams({
      ...exportBase,
      reports: "terminal_schedule,panel_asset_schedule"
    });
    const workbookResponse = await page.request.get(
      `/drawings/${drawingId}/deliverables/xlsx?${workbookQuery}`
    );
    expect(workbookResponse.ok()).toBe(true);
    expect(workbookResponse.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(workbookResponse.headers()["content-disposition"]).toMatch(
      /DRAFT_.*panel_deliverables\.xlsx/
    );
    expect((await workbookResponse.body()).byteLength).toBeGreaterThan(1000);
    const scheduleQuery = new URLSearchParams({
      scope: "active_panel",
      panelAssetId: "asset_jb_001",
      reports: "terminal_schedule",
      issueMode: "draft",
      composition: "schedules_only"
    });
    const printResponse = await page.request.get(
      `/drawings/${drawingId}/print?${scheduleQuery}`
    );
    expect(printResponse.ok()).toBe(true);
    expect(await printResponse.text()).toContain(
      'data-panel-schedule="terminal_schedule"'
    );
    const pdfResponse = await page.request.get(
      `/drawings/${drawingId}/pdf?${scheduleQuery}`
    );
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
