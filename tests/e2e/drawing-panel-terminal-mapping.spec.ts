import { expect, test, type Page } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

async function openPanelWorkQueue(page: Page) {
  await page.getByRole("button", { name: "Open sheet loader" }).click();
  await page
    .getByRole("dialog", { name: "Sheet Loader" })
    .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
    .getByRole("button", { name: "Load" })
    .click();
  return openDetailedPanelWorkflow(page, "advanced");
}

test("maps, persists, and resets an unresolved external termination", async ({
  page
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    let queue = await openPanelWorkQueue(page);

    await queue.getByRole("tab", { name: /External Terminations/ }).click();
    const unmappedRow = queue.getByRole("row", { name: /C-101-P2-BLK/ });
    await expect(unmappedRow).toContainText("Unmapped");
    await unmappedRow.getByRole("button", { name: "Map", exact: true }).click();

    let mappingDialog = page.getByRole("dialog", {
      name: "Map External Termination"
    });
    await expect(mappingDialog).toContainText("C-101-P2-BLK");
    await mappingDialog
      .getByRole("radio", { name: /Terminal 2\/ external/ })
      .check();
    await mappingDialog
      .getByRole("button", { name: "Apply mapping" })
      .click();
    await expect(mappingDialog).toContainText("Current mapping");
    await mappingDialog.getByRole("button", { name: "Done" }).click();
    await expect(unmappedRow).toContainText("Manual");

    await queue.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();

    queue = await openPanelWorkQueue(page);
    await queue.getByRole("tab", { name: /External Terminations/ }).click();
    const persistedRow = queue.getByRole("row", { name: /C-101-P2-BLK/ });
    await expect(persistedRow).toContainText("Manual");
    await persistedRow
      .getByRole("button", { name: "Change mapping" })
      .click();
    mappingDialog = page.getByRole("dialog", {
      name: "Map External Termination"
    });
    await mappingDialog
      .getByRole("button", { name: "Reset to automatic" })
      .click();
    await expect(mappingDialog).not.toContainText("Current mapping");
    await mappingDialog.getByRole("button", { name: "Done" }).click();
    await expect(persistedRow).toContainText("Unmapped");
    await expect(queue.getByText("C-101-P1-WHT", { exact: true })).toBeVisible();
    await expect(queue.getByText("C-101-P2-BLK", { exact: true })).toBeVisible();
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
