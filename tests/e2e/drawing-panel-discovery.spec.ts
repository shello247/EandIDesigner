import { expect, test } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

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

    await page
      .getByRole("button", { name: "Open Panel Work Queue" })
      .click();
    const queue = page.getByRole("dialog", { name: "Panel Work Queue" });
    const assetRow = queue.getByRole("row", { name: /TB-101/ });

    await expect(assetRow).toContainText("Available");
    await assetRow.getByRole("button", { name: "Place" }).click();
    await expect(assetRow).toContainText("Represented");

    await queue
      .getByRole("tab", { name: /External Terminations/ })
      .click();
    await expect(queue.getByText("C-101-P1-WHT", { exact: true })).toBeVisible();
    await expect(queue.getByText(/Sheet 1 - JB001 Field Terminations/)).toBeVisible();

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
    await page
      .getByRole("button", { name: "Open Panel Work Queue" })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Panel Work Queue" })
        .getByRole("row", { name: /TB-101/ })
    ).toContainText("Represented");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
