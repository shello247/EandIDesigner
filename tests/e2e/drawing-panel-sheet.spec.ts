import { expect, test } from "@playwright/test";
import {
  createE2eDetailedPanelDrawingPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";
import { loadSheetFromSheetLoader } from "./panel-workflow-helpers";

test("creates and reloads a Detailed Panel Drawing without duplicating its asset", async ({
  page
}) => {
  const drawingId = await createE2eDetailedPanelDrawingPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();

    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("button", { name: "Add Sheet" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Add Sheet" });

    await dialog
      .getByRole("button", {
        name: "Detailed Panel Electrical detail for one enclosure."
      })
      .click();
    await expect(dialog.getByLabel("Panel / enclosure")).toHaveValue(
      "asset_jb_001"
    );
    await dialog.getByRole("button", { name: "Add sheet", exact: true }).click();

    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "JB001 Detailed Panel Drawing"
    );
    await expect(
      page
        .getByRole("complementary", { name: "Symbol library" })
        .getByRole("heading", { name: "Detailed Panel Drawing" })
    ).toBeVisible();
    await expect(page.getByText("JB001", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save active sheet as template" })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await loadSheetFromSheetLoader(
      page,
      "JB001 Detailed Panel Drawing",
      /JB001 Detailed Panel Drawing Detailed Panel/
    );
    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "JB001 Detailed Panel Drawing"
    );
    await page.getByRole("button", { name: "Asset Manager" }).click();
    const manager = page.getByRole("dialog", { name: "Asset Manager" });
    await manager.getByLabel("Search drawing assets").fill("JB001");
    await expect(
      manager.getByRole("button", { name: "JB001 Field Junction Box 0" })
    ).toHaveCount(1);

    const pdfResponse = await page.request.get(`/drawings/${drawingId}/pdf`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
