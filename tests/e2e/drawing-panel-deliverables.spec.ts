import { expect, test } from "@playwright/test";
import {
  createE2ePanelQualityPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("reviews, traces, and exports deterministic panel deliverables", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("menuitem", { name: /Panel Deliverables/ })
      .click();
    let dialog = page.getByRole("dialog", {
      name: "Panel Engineering Deliverables"
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("TB-101");
    await expect(dialog).toContainText("C-101-P1-WHT");
    await expect(
      dialog.getByText("Save drawing before exporting", { exact: true })
    ).toHaveCount(0);

    const csvDownload = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "CSV" }).click();
    await expect((await csvDownload).suggestedFilename()).toMatch(
      /^DRAFT_.*terminal_schedule\.csv$/
    );

    await dialog.getByRole("button", { name: "Panel Assets" }).click();
    await expect(dialog).toContainText("Field Junction Box");
    await expect(dialog).not.toContainText("Field Cable 101");

    await dialog.getByLabel("Issue status").selectOption("issued");
    await expect(dialog).toContainText(
      "Issued output requires Approved status and zero blocking panel QC findings."
    );
    await expect(dialog.getByRole("button", { name: "XLSX" })).toBeDisabled();

    await dialog.getByLabel("Issue status").selectOption("draft");
    await dialog.getByRole("button", { name: "Terminal Schedule" }).click();
    await dialog.getByRole("button", { name: "Open field source" }).first().click();
    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "JB001 Field Terminations"
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: /Panel Deliverables/ })
    ).toBeVisible();
    await page.getByRole("button", { name: "Preview", exact: true }).click();

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("menuitem", { name: /Panel Deliverables/ })
      .click();
    dialog = page.getByRole("dialog", {
      name: "Panel Engineering Deliverables"
    });
    const workbookDownload = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "XLSX" }).click();
    await expect((await workbookDownload).suggestedFilename()).toMatch(
      /^DRAFT_.*panel_deliverables\.xlsx$/
    );

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
