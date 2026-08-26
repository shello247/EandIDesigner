import { expect, test, type Page } from "@playwright/test";
import {
  addE2eCablePlacementToDrawing,
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

test("adds a schematic panel reference and represents its terminal strip", async ({
  page
}) => {
  test.setTimeout(60000);
  const fixture = await createE2eTerminalBlockGroupPackage();
  const cable = await addE2eCablePlacementToDrawing({
    drawingId: fixture.drawingId,
    sheetName: "Terminal Strip Reuse Drawing"
  });

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

    await activateSheet(page, "Terminal Strip Reuse Drawing");
    await page.getByRole("button", { name: "Add to drawing" }).click();
    await page
      .getByRole("menuitem", { name: /Panel \/ enclosure/ })
      .click();

    const addPanel = page.getByRole("dialog", { name: "Add Panel" });
    await addPanel
      .getByText("Reference existing", { exact: true })
      .click();
    await addPanel.getByRole("radio", { name: /JB001/ }).check();
    await expect(addPanel).toContainText(
      "Add a compact schematic connection view linked to its backplane."
    );
    await expect(addPanel).toContainText("Linked backplane:");
    await addPanel.getByRole("button", { name: "Place panel" }).click();

    await expect(addPanel).toHaveCount(0);
    await expect(page.locator('[data-panel-connection-view="true"]')).toHaveCount(
      1
    );
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "JB001 schematic connection reference added."
    );
    await expect(
      page.getByRole("button", {
        name: /^Panel Connection Reference/
      })
    ).toBeVisible();
    const associatedAssetsToggle = page.getByRole("button", {
      name: "Expand Associated Panel Assets"
    });
    await expect(associatedAssetsToggle).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.getByRole("button", { name: /TB-101/ })).toHaveCount(0);
    await associatedAssetsToggle.click();
    await expect(page.getByRole("button", { name: /TB-101/ })).toBeVisible();

    await page.getByRole("button", { name: /TB-101/ }).click();
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expect(
      page.getByRole("button", { name: /^Location \/ Enclosure/ })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page
      .locator('[data-anchor-hotspot$=":M02.left"]')
      .first()
      .click();
    await page
      .locator(
        `[data-anchor-hotspot="${cable.placementId}:CH1_T1"]`
      )
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Connection added."
    );
    await expect(page.getByTestId("canvas-connection-hit")).toHaveCount(1);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await activateSheet(page, "Terminal Strip Reuse Drawing");
    await expect(page.locator('[data-panel-connection-view="true"]')).toHaveCount(
      1
    );
    await expect(page.locator("[data-terminal-strip-member]")).toHaveCount(7);
    await expect(page.getByTestId("canvas-connection-hit")).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
    await deleteE2eSymbol(fixture.endBracketSymbolId);
  }
});
