import { expect, test } from "@playwright/test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("builds one asset-backed terminal group on a panel backplane", async ({
  page
}) => {
  const fixture = await createE2eTerminalBlockGroupPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: /^Panel Layout/ }).click();

    await expect(
      page.getByRole("button", { name: "Terminal Block Single Scaled" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Terminal Block Group", exact: true })
      .click();

    const dialog = page.getByRole("dialog", {
      name: "Add Terminal Block Group"
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Group tag")).toHaveValue("TB-101");
    await expect(dialog).toContainText("1 - 5");
    await expect(dialog).toContainText("26 x 50 mm");

    await dialog.getByLabel("Group name").fill("Modbus Terminal Strip");
    await dialog
      .getByLabel("Description")
      .fill("Field bus terminal group");
    await dialog.getByLabel("Terminal count").fill("6");
    await expect(dialog).toContainText("31.2 x 50 mm");
    await dialog.getByRole("button", { name: "Create group" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-101 terminal block group added"
    );
    await expect(page.locator('[data-generated-terminal-block="true"]')).toHaveCount(
      1
    );
    await expect(page.locator('[data-terminal-module="true"]')).toHaveCount(6);

    await page.getByRole("button", { name: "Asset Manager" }).click();
    const assetManager = page.getByRole("dialog", { name: "Asset Manager" });
    await expect(assetManager.getByRole("button", { name: /TB-101/ })).toBeVisible();
    await assetManager.getByRole("button", { name: /TB-101/ }).click();
    await expect(assetManager).toContainText("6 terminals / range 1 - 6");
    await expect(assetManager.getByLabel("Description")).toHaveValue(
      "Field bus terminal group"
    );
    await assetManager.getByRole("button", { name: "Close asset manager" }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator('[data-terminal-module="true"]')).toHaveCount(6);

    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const workflow = await openDetailedPanelWorkflow(page);
    const equipment = workflow.getByRole("button", { name: /TB-101/ });
    await expect(equipment).toContainText("Not added");
    await equipment.click();
    await expect(workflow).toContainText("Add TB-101 to drawing");
    await workflow
      .getByRole("button", { name: "Add to drawing", exact: true })
      .click();
    await expect(equipment).toContainText("Ready");
    await workflow.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator('[data-terminal-module="true"]')).toHaveCount(6);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator('[data-terminal-module="true"]')).toHaveCount(6);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
