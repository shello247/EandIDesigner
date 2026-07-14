import { expect, test } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("discovers, places, removes, and reloads an existing panel asset occurrence", async ({
  page
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await loader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const queue = await openDetailedPanelWorkflow(page, "advanced");
    const assetRow = queue.getByRole("row", { name: /TB-101/ });

    await expect(assetRow).toContainText("Available");
    await assetRow.getByRole("button", { name: "Place" }).click();
    await expect(assetRow).toContainText("Represented");

    await queue
      .getByRole("tab", { name: /External Terminations/ })
      .click();
    const automaticTerminationRow = queue.getByRole("row", {
      name: /C-101-P1-WHT/
    });
    await expect(automaticTerminationRow).toContainText("C-101-P1-WHT");
    await expect(automaticTerminationRow).toContainText(
      "Sheet 1 - JB001 Field Terminations"
    );

    await queue.getByRole("tab", { name: /Associated Assets/ }).click();
    await assetRow.getByRole("button", { name: "Remove representation" }).click();
    await expect(assetRow).toContainText("Available");
    await assetRow.getByRole("button", { name: "Place" }).click();
    await queue.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();
    const reloadedQueue = await openDetailedPanelWorkflow(page, "advanced");
    await expect(
      reloadedQueue.getByRole("row", { name: /TB-101/ })
    ).toContainText("Represented");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
