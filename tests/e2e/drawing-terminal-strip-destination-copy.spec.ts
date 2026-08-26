import { expect, test, type Page } from "@playwright/test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

async function activateSheet(page: Page, sheetName: string) {
  await page.getByRole("button", { name: "Open sheet loader" }).click();
  const loader = page.getByRole("dialog", { name: "Sheet Loader" });
  const sheetCell = loader.getByRole("cell", { name: sheetName, exact: true });
  if ((await sheetCell.count()) === 0) {
    await loader.getByRole("button", { name: /^Expand / }).first().click();
  }
  const row = sheetCell.locator("..");
  await row.getByRole("button", { name: "Load", exact: true }).click();
}

test("copies an existing terminal strip from the destination panel sheet", async ({
  page
}) => {
  test.setTimeout(60000);
  const fixture = await createE2eTerminalBlockGroupPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page
      .getByRole("button", { name: "Expand Symbol Library" })
      .click();
    await page.getByRole("button", { name: /^Panel Layout/ }).click();
    await page
      .getByRole("button", { name: "Terminal Strip", exact: true })
      .click();
    const builder = page.getByRole("dialog", {
      name: "Terminal Strip Builder"
    });
    await builder.getByLabel("Name").fill("JB001 field terminal strip");
    await builder
      .getByRole("button", { name: "Create terminal strip" })
      .click();
    await expect(builder).toHaveCount(0);

    await activateSheet(page, "PLC001 Panel Layout Drawing");
    await page.getByRole("button", { name: "Add to drawing" }).click();
    await page
      .getByRole("menuitem", { name: /Copy Existing Terminal Strip/ })
      .click();

    const copyDialog = page.getByRole("dialog", {
      name: "Copy existing terminal strip"
    });
    await expect(copyDialog).toContainText("PLC001 Panel Layout Drawing");
    await expect(copyDialog).toContainText("Mounted on: PLC001 Backplane");
    await copyDialog
      .getByPlaceholder("Search tag, name, panel, or sheet")
      .fill("JB001");
    await expect(copyDialog.getByRole("button", { name: /TB-101/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(copyDialog).toContainText(
      "TB-102 will be created from TB-101"
    );
    await copyDialog
      .getByRole("button", { name: "Copy terminal strip", exact: true })
      .click();

    await expect(copyDialog).toHaveCount(0);
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "TB-102 created from TB-101"
    );
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expect(page.locator('[data-connection-id]')).toHaveCount(0);

    await page.getByRole("button", { name: "Asset Manager" }).click();
    const assetManager = page.getByRole("dialog", { name: "Asset Manager" });
    const terminalCategory = assetManager.getByRole("button", { name: "Terminal Blocks, 2 assets" });
    await expect(terminalCategory).toHaveAttribute("aria-expanded", /^(true|false)$/);
    if (await terminalCategory.getAttribute("aria-expanded") === "false") {
      await terminalCategory.click();
    }
    await expect(terminalCategory).toHaveAttribute("aria-expanded", "true");
    await assetManager.getByRole("button", { name: /TB-102/ }).click();
    await assetManager.getByRole("button", { name: /^3 Sheet Associations/ }).click();
    await expect(assetManager).toContainText("PLC001 Panel Layout Drawing");
    await assetManager.getByRole("button", { name: /TB-101/ }).click();
    await assetManager.getByRole("button", { name: /^3 Sheet Associations/ }).click();
    await expect(assetManager).toContainText("JB001 Panel Layout Drawing");
    await assetManager.getByRole("button", { name: "Close asset manager" }).click();

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
