import { expect, test, type Page } from "@playwright/test";
import {
  createE2eTerminalBlockGroupPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openPanelEngineeringWorkbench } from "./panel-workflow-helpers";

async function expectNoGenericPanelAssignment(page: Page) {
  await expect(page.getByRole("button", {
    name: /^Location \/ Enclosure/,
    includeHidden: true
  })).toHaveCount(0);
  await expect(page.getByRole("combobox", {
    name: "Contained in panel",
    includeHidden: true
  })).toHaveCount(0);
}

async function loadDetailSheet(page: Page) {
  await page.getByRole("button", { name: "Open sheet loader" }).click();
  const loader = page.getByRole("dialog", { name: "Sheet Loader" });
  await loader.getByRole("button", { name: "Expand Front Matter" }).click();
  await loader.getByRole("row", {
    name: /JB001 Detailed Panel Drawing Detailed Panel/
  }).getByRole("button", { name: "Load", exact: true }).click();
}

test("retains panel ownership from layout through detailed wiring and reload", async ({ page }) => {
  const fixture = await createE2eTerminalBlockGroupPackage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: "Expand Symbol Library" }).click();
    await page.getByRole("button", { name: /^Panel Layout/ }).click();
    await page.getByRole("button", { name: "Terminal Strip", exact: true }).click();

    const builder = page.getByRole("dialog", { name: "Terminal Strip Builder" });
    await expect(builder.getByLabel("Tag / ID")).toHaveValue("TB-101");
    await expect(builder).toContainText("JB001");
    await builder.getByRole("button", { name: "Create terminal strip" }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("TB-101 terminal strip placed");
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expectNoGenericPanelAssignment(page);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await loadDetailSheet(page);

    const workbench = await openPanelEngineeringWorkbench(page);
    const equipment = workbench.getByRole("row", { name: /TB-101/ });
    await expect(equipment).toContainText("Available");
    await equipment.getByRole("button", { name: "Add", exact: true }).click();
    await expect(equipment).toContainText("Represented");
    await workbench.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expectNoGenericPanelAssignment(page);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await loadDetailSheet(page);
    const reloadedWorkbench = await openPanelEngineeringWorkbench(page);
    await expect(reloadedWorkbench.getByRole("row", { name: /TB-101/ })).toContainText("Represented");
    await reloadedWorkbench.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expectNoGenericPanelAssignment(page);
    expect(pageErrors).toEqual([]);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
