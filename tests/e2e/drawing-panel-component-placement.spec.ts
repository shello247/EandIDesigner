import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("references and reloads panel equipment defined before Detailed Panel wiring", async ({
  page
}) => {
  const fixture = await createE2ePanelComponentPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const queue = await openDetailedPanelWorkflow(page, "advanced");
    const breakerRow = queue.getByRole("row", { name: /MCB-101/ });
    await expect(breakerRow).toContainText("Available");
    await breakerRow.getByRole("button", { name: "Place" }).click();

    await expect(page.getByTestId("drawing-toast")).toContainText(
      "MCB-101 placed"
    );
    await expect(breakerRow).toContainText("Represented");
    await queue.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Panel Component", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Terminals (2)")).toBeVisible();
    await expect(
      page.getByText(
        "Physical dimensions are missing; physical panel-layout placement is unavailable.",
        { exact: true }
      )
    ).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();
    await page.getByRole("button", { name: "Asset Manager" }).click();
    const manager = page.getByRole("dialog", { name: "Asset Manager" });
    await expect(manager).toContainText("MCB-101");
    await expect(manager.getByRole("button", { name: /^MCB-101 / })).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
