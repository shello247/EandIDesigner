import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("authors, removes, restores, and reloads a structured panel jumper", async ({
  page
}) => {
  const fixture = await createE2ePanelComponentPackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const queue = await openDetailedPanelWorkflow(page, "advanced");
    await queue
      .getByRole("row", { name: /TB-101/ })
      .getByRole("button", { name: "Place" })
      .click();
    await queue
      .getByRole("row", { name: /MCB-101/ })
      .getByRole("button", { name: "Place" })
      .click();
    await queue.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Pattern", exact: true }).click();
    const authoring = page.getByLabel("Connection pattern authoring");
    await authoring.getByLabel("Pattern type").selectOption("terminal_jumper");
    await authoring.getByLabel("Electrical domain").selectOption("signal");
    await authoring.getByRole("button", { name: "Select terminals" }).click();
    await page.locator('[data-anchor-hotspot$=":T1_TOP"]').click();
    await page.locator('[data-anchor-hotspot$=":LINE"]').click();
    await authoring.getByRole("button", { name: "Review" }).click();

    const review = page.getByRole("dialog", {
      name: "Review connection pattern"
    });
    await expect(review).toBeVisible();
    await expect(review.locator("..")).toHaveCSS("position", "fixed");
    await expect(review).toContainText("JMP-001");
    await review.getByRole("button", { name: "Create pattern" }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("JMP-001 added");
    await expect(page.locator('[data-panel-pattern-id="panel_pattern:asset_jb_001:JMP-001"]')).toHaveCount(1);

    const refreshedQueue = await openDetailedPanelWorkflow(page, "advanced");
    await refreshedQueue.getByRole("tab", { name: /Connection Patterns/ }).click();
    const patternRow = refreshedQueue.getByRole("row", { name: /JMP-001/ });
    await expect(patternRow).toContainText(/terminal jumper/i);
    await patternRow.getByTitle("Remove this sheet representation").click();
    await expect(patternRow).toContainText("Unrepresented");
    await patternRow.getByRole("button", { name: "Add" }).click();
    await expect(patternRow).toContainText("Sheet 2");
    await refreshedQueue.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Drawing saved.");
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();
    const reloadedQueue = await openDetailedPanelWorkflow(page, "advanced");
    await reloadedQueue
      .getByRole("tab", { name: /Connection Patterns/ })
      .click();
    await expect(reloadedQueue).toContainText("JMP-001");
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
