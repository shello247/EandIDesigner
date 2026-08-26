import { expect, test } from "@playwright/test";
import {
  createE2eGenericPanelReleasePackage,
  deleteE2eDrawing,
} from "./drawing-fixtures";
import {
  openPanelEngineeringWorkbench,
  selectPanelEngineeringView,
} from "./panel-workflow-helpers";

test.describe.configure({ mode: "serial" });

test("runs discovery and deliverables for MCP-201 without JB-specific assumptions", async ({
  page,
}) => {
  const drawingId = await createE2eGenericPanelReleasePackage();

  try {
    await test.step("load the generic panel context", async () => {
      await page.goto(`/drawings/${drawingId}`);
      await page.getByRole("button", { name: "Open sheet loader" }).click();
      await page
        .getByRole("dialog", { name: "Sheet Loader" })
        .getByRole("row", {
          name: /MCP-201 Detailed Panel Drawing Detailed Panel/,
        })
        .getByRole("button", { name: "Load" })
        .click();
      const panelSummary = page.getByRole("complementary", {
        name: "Symbol library",
      });
      await expect(
        panelSummary.getByText("MCP-201", { exact: true }),
      ).toBeVisible();
      await expect(
        panelSummary.getByText("Motor Control Panel 201", { exact: true }),
      ).toBeVisible();
    });

    await test.step("discover and place all differently sized terminal strips", async () => {
      const queue = await openPanelEngineeringWorkbench(page);
      for (const [tag, count] of [
        ["MCP201-XT1", "8"],
        ["MCP201-XT2", "12"],
        ["MCP201-XT3", "4"],
      ] as const) {
        const row = queue.getByRole("row", { name: new RegExp(tag) });
        await expect(row).toContainText(count);
        await row.getByRole("button", { name: "Add", exact: true }).click();
      }
      await selectPanelEngineeringView(queue, "Terminal Map");
      await expect(queue).toContainText("MCP201-XT1");
      await expect(queue).toContainText("MCP201-XT2");
      await expect(queue).toContainText("MCP201-XT3");
      await queue.getByRole("button", { name: "Close", exact: true }).click();
    });

    await test.step("save, reload, and generate generic reports", async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByTestId("drawing-toast")).toContainText(
        "Drawing saved",
      );
      await page.reload();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await page.getByRole("menuitem", { name: /Panel Deliverables/ }).click();
      const deliverables = page.getByRole("dialog", {
        name: "Panel Engineering Deliverables",
      });
      await expect(deliverables).toContainText("MCP201-XT1");
      await expect(deliverables).toContainText("MCP201-FW1");
      await expect(deliverables).not.toContainText("JB001");
    });
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
