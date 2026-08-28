import { expect, test } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing,
} from "./drawing-fixtures";
import {
  loadSheetFromSheetLoader,
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test("discovers, places, removes, and reloads an existing panel asset occurrence", async ({
  page,
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await loadSheetFromSheetLoader(
      page,
      "JB001 Detailed Panel Drawing",
      /JB001 Detailed Panel Drawing Detailed Panel/
    );

    const queue = await openPanelEngineeringWorkbench(page);
    const assetRow = queue.getByRole("row", { name: /TB-101/ });

    await expect(assetRow).toContainText("Available");
    await assetRow.getByRole("button", { name: "Add", exact: true }).click();
    await expect(assetRow).toContainText("Represented");

    await selectPanelEngineeringView(queue, "External Terminations");
    const automaticTerminationRow = queue.getByRole("row", {
      name: /C-101-P1-WHT/,
    });
    await expect(automaticTerminationRow).toContainText("C-101-P1-WHT");
    await expect(automaticTerminationRow).toContainText(
      "Sheet 1 - JB001 Field Terminations",
    );

    await selectPanelEngineeringView(queue, "Equipment");
    await assetRow.getByRole("button", { name: "Remove" }).click();
    await expect(assetRow).toContainText("Available");
    await assetRow.getByRole("button", { name: "Add", exact: true }).click();
    await queue.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved.",
    );
    await page.reload();
    await loadSheetFromSheetLoader(
      page,
      "JB001 Detailed Panel Drawing",
      /JB001 Detailed Panel Drawing Detailed Panel/
    );
    const reloadedQueue = await openPanelEngineeringWorkbench(page);
    await expect(
      reloadedQueue.getByRole("row", { name: /TB-101/ }),
    ).toContainText("Represented");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
