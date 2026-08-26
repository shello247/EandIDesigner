import { expect, test } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing,
} from "./drawing-fixtures";
import {
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test("selects and adds panel equipment without a guided workflow", async ({
  page,
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await sheetLoader
      .getByRole("button", { name: "Expand Front Matter" })
      .click();
    await sheetLoader
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const workbench = await openPanelEngineeringWorkbench(page);
    await expect(
      workbench.getByRole("button", { name: "Guided", exact: true }),
    ).toHaveCount(0);
    await expect(
      workbench.getByRole("button", {
        name: "Advanced Workbench",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      workbench.getByLabel("Filter panel engineering workbench by status"),
    ).toHaveCount(0);
    await expect(
      workbench.getByText("All statuses", { exact: true }),
    ).toHaveCount(0);
    await expect(
      workbench.getByLabel(/More panel engineering options/),
    ).toBeVisible();

    const equipmentRow = workbench.getByRole("row", { name: /TB-101/ });
    await expect(
      workbench.getByRole("columnheader", { name: "Terminal use" }),
    ).toBeVisible();
    await expect(
      workbench.getByRole("columnheader", { name: "Source sheets" }),
    ).toHaveCount(0);
    await expect(
      workbench.getByRole("columnheader", { name: "Representation" }),
    ).toHaveCount(0);
    await expect(equipmentRow).toContainText("used");
    await expect(equipmentRow).toContainText("unused");
    await expect(equipmentRow).toContainText("1");
    await expect(equipmentRow).toContainText("Row 1 · Column 1");
    await workbench.getByPlaceholder(/Search tags, wires/).fill("position 1");
    await expect(equipmentRow).toBeVisible();
    await workbench.getByPlaceholder(/Search tags, wires/).fill("");

    await workbench.getByLabel("Select TB-101").check();
    await expect(workbench).toContainText("1 selected");
    await workbench
      .getByRole("button", { name: "Add selected to sheet" })
      .click();
    await expect(workbench.getByRole("row", { name: /TB-101/ })).toContainText(
      "Represented",
    );
    await expect(workbench).toContainText("0 selected");

    await selectPanelEngineeringView(workbench, "Connection Patterns");
    await workbench.getByLabel(/More panel engineering options/).click();
    await expect(
      workbench.getByRole("menuitem", { name: "New pattern", exact: true }),
    ).toBeVisible();
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
