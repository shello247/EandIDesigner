import { expect, test } from "./drawing-test";
import {
  createE2eSectionedDrawingPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("keeps explicit sheet creation while hiding retired reuse actions", async ({
  page
}) => {
  const drawingId = await createE2eSectionedDrawingPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
    await page.getByRole("button", { name: "Open sheet loader" }).click();

    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(loader).toBeVisible();
    const loaderBox = await loader.boundingBox();
    const viewport = page.viewportSize();
    if (!loaderBox || !viewport) {
      throw new Error("Expected Sheet Loader and viewport geometry.");
    }
    expect(loaderBox.y).toBeLessThan(viewport.height * 0.15);
    expect(loaderBox.x + loaderBox.width / 2).toBeCloseTo(
      viewport.width / 2,
      0
    );
    const closeButton = loader.getByRole("button", {
      name: "Close sheet loader"
    });
    await expect(closeButton).toHaveCSS("width", "40px");
    await expect(closeButton).toHaveCSS("height", "40px");
    await expect(closeButton.locator("svg")).toHaveCSS("width", "22px");
    await expect(closeButton.locator("svg")).toHaveCSS("height", "22px");
    await expect(
      loader.getByRole("button", { name: "Add from Template" })
    ).toHaveCount(0);
    await loader
      .getByPlaceholder(
        "Search by section, sheet number, name, type, or description"
      )
      .fill("Field Loop 1");

    const row = loader.getByRole("row").filter({ hasText: "Field Loop 1" });
    await row
      .getByRole("button", { name: "Actions for Field Loop 1" })
      .click();
    await expect(
      loader.getByRole("menuitem", { name: "Duplicate" })
    ).toHaveCount(0);
    await expect(
      loader.getByRole("menuitem", { name: "Save as template" })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await loader.getByRole("button", { name: "Add Sheet" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Sheet" });
    await addDialog.getByLabel("Sheet name").fill("Explicit Wiring Sheet");
    await addDialog
      .getByRole("button", { name: "Add sheet", exact: true })
      .click();

    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "Explicit Wiring Sheet"
    );
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const reopenedLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await reopenedLoader
      .getByPlaceholder(
        "Search by section, sheet number, name, type, or description"
      )
      .fill("Explicit Wiring Sheet");
    await expect(
      reopenedLoader.getByText("Explicit Wiring Sheet", { exact: true })
    ).toBeVisible();
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
