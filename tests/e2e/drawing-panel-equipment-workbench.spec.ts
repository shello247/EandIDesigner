import { expect, test } from "./drawing-test";
import { confirmCanvasPlacement } from "./drawing-placement-helpers";
import { prisma } from "../../src/lib/prisma";
import { parseDrawingModelJson, stringifyDrawingModel } from "../../src/features/drawing_canvas/data/schema";
import { assertAuditDatabase, resolveAuditConfiguration } from "../../scripts/drawing-performance-audit/run-config.mjs";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing,
} from "./drawing-fixtures";
import {
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test("existing-asset placement queue cancels only the unplaced remainder", async ({ page }) => {
  assertAuditDatabase(resolveAuditConfiguration());
  const drawingId = await createE2ePanelDiscoveryPackage();
  try {
    const row = await prisma.drawing.findUniqueOrThrow({ where: { id: drawingId } });
    const model = parseDrawingModelJson(row.modelJson);
    const source = model.assets.find(asset => asset.id === "asset_tb_101")!;
    model.assets.push({ ...source, id: "asset_tb_102", tag: "TB-102", title: "Terminal Strip 2" });
    for (const sheet of model.sheets) {
      const occurrence = sheet.placements.find(placement => placement.assetId === source.id);
      if (occurrence) sheet.placements.push({ ...occurrence, id: occurrence.id + "_second",
        assetId: "asset_tb_102", tag: "TB-102", x: occurrence.x + 50,
        layoutPosition: occurrence.layoutPosition ? { ...occurrence.layoutPosition, xMm: occurrence.layoutPosition.xMm + 70 } : undefined });
    }
    await prisma.drawing.update({ where: { id: drawingId }, data: { modelJson: stringifyDrawingModel(model) } });
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const loader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(loader.getByRole("button", { name: "Collapse Package Information" })).toHaveAttribute("aria-expanded", "true");
    await loader.getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" }).click();
    const workbench = await openPanelEngineeringWorkbench(page);
    await workbench.getByLabel("Select TB-101").check();
    await workbench.getByLabel("Select TB-102").check();
    await workbench.getByRole("button", { name: "Add selected to sheet" }).click();
    await expect(page.getByTestId("placement-tag")).toHaveText("TB-101");
    await confirmCanvasPlacement(page, undefined, false);
    await expect(page.getByTestId("placement-tag")).toHaveText("TB-102");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("placement-session")).toHaveCount(0);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Drawing saved", exact: true })).toBeDisabled();
    const saved = parseDrawingModelJson((await prisma.drawing.findUniqueOrThrow({ where: { id: drawingId } })).modelJson);
    const detail = saved.sheets.find(sheet => sheet.id === "sheet_detailed_panel")!;
    expect(detail.placements.map(placement => placement.assetId)).toEqual(["asset_tb_101"]);
    expect(saved.assets).toEqual(model.assets);
    for (const sheet of model.sheets.filter(sheet => sheet.id !== detail.id)) {
      expect(saved.sheets.find(candidate => candidate.id === sheet.id)?.connections).toEqual(sheet.connections);
    }
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await expect(loader.getByRole("button", { name: "Collapse Package Information" })).toHaveAttribute("aria-expanded", "true");
    await loader.getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" }).click();
    await expect(page.locator('svg[aria-label="Interactive drawing overlay"] rect[data-placement-id]')).toHaveCount(1);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});

test("selects and adds panel equipment without a guided workflow", async ({
  page,
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    const sheetLoader = page.getByRole("dialog", { name: "Sheet Loader" });
    await expect(sheetLoader.getByRole("button", { name: "Collapse Package Information" })).toHaveAttribute("aria-expanded", "true");
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
    await confirmCanvasPlacement(page);
    await openPanelEngineeringWorkbench(page);
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
