import { expect, test } from "@playwright/test";
import {
  createE2eGenericPanelReleasePackage,
  deleteE2eDrawing,
} from "./drawing-fixtures";
import {
  loadSheetFromSheetLoader,
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
      await loadSheetFromSheetLoader(
        page,
        "MCP-201 Detailed Panel Drawing",
        /MCP-201 Detailed Panel Drawing Detailed Panel/
      );
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
      await expect(
        page.getByRole("menuitem", { name: /Panel Deliverables/ }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Preview", exact: true }).click();

      const reportQuery = new URLSearchParams({
        scope: "active_panel",
        panelAssetId: "asset_mcp_201",
        reports: "terminal_schedule,internal_wire_schedule",
        issueMode: "draft",
        composition: "schedules_only",
      });
      const report = await page.request.get(
        `/drawings/${drawingId}/print?${reportQuery}`,
      );
      expect(report.ok()).toBe(true);
      const reportHtml = await report.text();
      expect(reportHtml).toContain("MCP201-XT1");
      expect(reportHtml).toContain("MCP201-FW1");
      expect(reportHtml).not.toContain("JB001");
    });
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
