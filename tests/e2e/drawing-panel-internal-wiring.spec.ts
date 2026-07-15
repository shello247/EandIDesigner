import { expect, test } from "@playwright/test";
import {
  createE2ePanelComponentPackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";
import { openDetailedPanelWorkflow } from "./panel-workflow-helpers";

test("authors, removes, re-represents, and reloads an internal panel wire", async ({
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

    const guided = await openDetailedPanelWorkflow(page);
    await guided.getByRole("button", { name: /TB-101/ }).click();
    await guided.getByRole("button", { name: /Internal Wiring/ }).click();
    await expect(guided.getByLabel("To equipment")).toBeEnabled();
    await guided
      .getByLabel("To equipment")
      .selectOption({ label: "MCB-101 - Main Circuit Breaker" });
    await expect(guided.getByLabel("To terminal")).toBeDisabled();
    await guided
      .getByLabel("From terminal")
      .selectOption({ label: "Terminal 1 - Internal (top)" });
    await expect(
      guided.getByLabel("To equipment").locator("option:checked")
    ).toHaveText("MCB-101 - Main Circuit Breaker");
    await expect(guided.getByLabel("To terminal")).toBeEnabled();
    await guided
      .getByLabel("To terminal")
      .selectOption({ label: "Terminal Line - Single (top)" });
    await expect(guided.getByLabel("Wire ID")).toHaveValue("JB001-W001");
    await guided.getByLabel("Color").fill("BU");
    await guided.getByRole("button", { name: "Create wire" }).click();
    await guided.getByRole("button", { name: "Close", exact: true }).click();

    await expect(page.getByTestId("drawing-toast")).toContainText(
      "JB001-W001 added"
    );
    await expect(
      page.getByRole("heading", { name: "Internal Wire", exact: true })
    ).toBeVisible();
    await expect(page.getByText("TB-101:T1", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Remove wire" }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Remove internal wire"
    });
    await deleteDialog
      .getByRole("button", { name: "Remove route only" })
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "physical wire remains"
    );

    const refreshedQueue = await openDetailedPanelWorkflow(page, "advanced");
    await refreshedQueue
      .getByRole("tab", { name: /Internal Wires/ })
      .click();
    const wireRow = refreshedQueue.getByRole("row", { name: /JB001-W001/ });
    await expect(wireRow).toContainText("Unrepresented");
    await wireRow.getByRole("button", { name: "Add representation" }).click();
    await expect(wireRow).toContainText("Sheet 2 - JB001 Detailed Panel Drawing");
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
    await reloadedQueue.getByRole("tab", { name: /Internal Wires/ }).click();
    await expect(reloadedQueue).toContainText("JB001-W001");
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
