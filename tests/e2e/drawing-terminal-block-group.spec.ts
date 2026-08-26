import { expect, test } from "@playwright/test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openPanelEngineeringWorkbench } from "./panel-workflow-helpers";

test("builds one structured terminal strip on a panel backplane", async ({
  page
}) => {
  const fixture = await createE2eTerminalBlockGroupPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page
      .getByRole("button", { name: "Expand Symbol Library" })
      .click();
    await page.getByRole("button", { name: /^Panel Layout/ }).click();

    await expect(
      page.getByRole("button", { name: "Terminal Block Single Scaled" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Terminal Strip", exact: true })
      .click();

    const dialog = page.getByRole("dialog", {
      name: "Terminal Strip Builder"
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Tag / ID")).toHaveValue("TB-101");
    await expect(dialog).toContainText("M01");
    await expect(dialog).toContainText("M07");
    await expect(dialog).toContainText("42 × 52.4 mm");

    await dialog.getByLabel("Name").fill("Modbus Terminal Strip");
    await dialog
      .getByLabel("Description", { exact: true })
      .fill("Field bus terminal group");
    await dialog
      .getByRole("button", { name: "Create terminal strip" })
      .click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-101 terminal strip placed"
    );
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expect(page.locator('[data-member-role="electrical"]')).toHaveCount(5);

    await page.getByRole("button", { name: "Asset Manager" }).click();
    const assetManager = page.getByRole("dialog", { name: "Asset Manager" });
    const terminalCategory = assetManager.getByRole("button", { name: "Terminal Blocks, 1 asset" });
    await expect(terminalCategory).toHaveAttribute("aria-expanded", /^(true|false)$/);
    if (await terminalCategory.getAttribute("aria-expanded") === "false") {
      await terminalCategory.click();
    }
    await expect(terminalCategory).toHaveAttribute("aria-expanded", "true");
    await expect(assetManager.getByRole("button", { name: /TB-101/ })).toBeVisible();
    await assetManager.getByRole("button", { name: /TB-101/ }).click();
    await assetManager.getByRole("button", { name: /^1 Identity/ }).click();
    await expect(assetManager).toContainText("Terminal strip members");
    await expect(assetManager).toContainText("M07");
    await expect(assetManager.getByLabel("General description")).toHaveValue(
      "Field bus terminal group"
    );
    await assetManager.getByRole("button", { name: "Close asset manager" }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);

    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await sheetLoader.getByRole("button", { name: "Expand Front Matter" }).click();
    await sheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const workflow = await openPanelEngineeringWorkbench(page);
    const equipment = workflow.getByRole("row", { name: /TB-101/ });
    await expect(equipment).toContainText("Available");
    await equipment.getByRole("button", { name: "Add", exact: true }).click();
    await expect(equipment).toContainText("Represented");
    await workflow.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
