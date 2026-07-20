import { expect, test } from "@playwright/test";
import {
  createE2ePanelDiscoveryPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("guides one panel asset through placement and persists its focus", async ({
  page
}) => {
  const drawingId = await createE2ePanelDiscoveryPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    await expect(
      page.getByRole("button", { name: "Change", exact: true })
    ).toBeVisible();
    const workflow = await openDetailedPanelWorkflow(page);
    await expect(
      workflow.getByRole("button", { name: "Guided", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      workflow.getByText("Add connection patterns", { exact: true })
    ).toHaveCount(0);

    const equipment = workflow.getByRole("button", { name: /TB-101/ });
    await equipment.click();
    await expect(workflow).toContainText("Add TB-101 to drawing");
    await workflow
      .getByRole("button", { name: "Add to drawing", exact: true })
      .click();
    await expect(
      workflow.getByRole("button", { name: "Center equipment", exact: true })
    ).toBeVisible();
    await expect(equipment).toContainText("Needs mapping");
    await workflow
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(workflow).toContainText(
      "Review and map field terminations for TB-101"
    );
    await workflow
      .getByRole("button", { name: "Back", exact: true })
      .click();
    await expect(workflow).toContainText("Add TB-101 to drawing");

    await workflow
      .getByRole("button", { name: "Advanced Workbench", exact: true })
      .click();
    await expect(
      workflow.getByRole("row", { name: /TB-101/ })
    ).toContainText("Represented");
    await workflow
      .getByRole("tab", { name: /Connection Patterns/ })
      .click();
    await expect(
      workflow.getByRole("button", { name: "New pattern", exact: true })
    ).toBeVisible();
    await workflow.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    const restoredWorkflow = await openDetailedPanelWorkflow(page);
    await expect(
      restoredWorkflow.getByRole("button", { name: /TB-101/ })
    ).toContainText("Needs mapping");
    await expect(restoredWorkflow).toContainText(
      "Review and map field terminations for TB-101"
    );
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
