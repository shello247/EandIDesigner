import { expect, test } from "./drawing-test";
import { prisma } from "../../src/lib/prisma";
import {
  createE2ePanelQualityPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("selects and reviews saved Panel Analysis findings", async ({ page }) => {
  test.setTimeout(120000);
  const drawingId = await createE2ePanelQualityPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    const contextualLink = page.getByRole("link", { name: "Panel Analysis" });
    await expect(contextualLink).toHaveAttribute(
      "href",
      `/panel-analysis/${drawingId}`
    );

    await page.goto("/panel-analysis");
    await expect(
      page.getByRole("heading", { name: "Panel Analysis", exact: true })
    ).toBeVisible();
    const selectorRow = page.getByRole("row").filter({
      has: page.locator(`a[href="/panel-analysis/${drawingId}"]`)
    });
    await expect(selectorRow).toContainText("Panel Discovery Test");
    await selectorRow.getByRole("link", { name: "Analyze" }).click();

    await expect(page).toHaveURL(`/panel-analysis/${drawingId}`);
    await expect(page.getByText("Analysis is based on the saved drawing revision.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Error Detection" })).toBeVisible();
    await expect(page.getByText(/^Coverage: (Complete|Partial|Not evaluated)$/)).toBeVisible();
    await expect(page.getByText(/root causes · \d+ matching findings/)).toBeVisible();

    await page.getByLabel("Search findings").fill("orphan_panel_route");
    await expect(page.getByText(/1 root causes · 1 matching findings/)).toBeVisible();
    await expect(page.getByText(/orphan_panel_route/).first()).toBeVisible();
    const recheckButton = page.getByRole("button", {
      name: "Recheck This Error"
    });
    await recheckButton.click();
    await expect(
      page.getByText("Rechecked against the latest saved drawing revision.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText(/root causes · \d+ matching findings/)).toBeVisible();
    const fixInDrawingLink = page
      .getByRole("link", { name: "Fix in Drawing" })
      .first();
    await expect(fixInDrawingLink).toHaveAttribute("target", "_blank");
    await expect(fixInDrawingLink).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    const [drawingPage] = await Promise.all([
      page.waitForEvent("popup"),
      fixInDrawingLink.click()
    ]);
    await drawingPage.waitForLoadState("domcontentloaded");
    await expect(drawingPage).toHaveURL(
      new RegExp(`/drawings/${drawingId}\\?sheetId=`)
    );
    await drawingPage.close();

    await page.getByRole("button", { name: "Terminals" }).click();
    await expect(page.getByLabel("terminal schedule report")).toBeVisible();
    await expect(page.getByRole("cell", { name: "TB-101", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "CSV" })).toHaveAttribute(
      "href",
      new RegExp(`/drawings/${drawingId}/deliverables/csv`)
    );
    await page.getByRole("button", { name: "Internal Wiring" }).click();
    await expect(page.getByLabel("internal wire schedule report")).toBeVisible();
    await page.getByRole("button", { name: "Assets" }).click();
    await expect(page.getByLabel("panel asset schedule report")).toBeVisible();
    await page.getByRole("button", { name: "Materials / BOM" }).click();
    await expect(page.getByLabel("bom report")).toBeVisible();
    await expect(page.getByRole("link", { name: "PDF" })).toHaveAttribute(
      "href",
      new RegExp(`/drawings/${drawingId}/pdf`)
    );
    await page.getByRole("button", { name: "Error Detection" }).click();
    await expect(page.getByRole("heading", { name: "Error Detection" })).toBeVisible();
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});

test("returns not found for an unknown Panel Analysis drawing", async ({
  page
}) => {
  const response = await page.goto("/panel-analysis/unknown-drawing-id");
  expect(response?.status()).toBe(404);
});

test("opens a validated drawing target and safely ignores a stale object", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();
  try {
    await page.goto(
      `/drawings/${drawingId}?sheetId=sheet_field&objectKind=connection&objectId=connection_field_tb_101_1`
    );
    await expect(page.getByTestId("active-sheet-heading")).toContainText(
      "JB001 Field Terminations"
    );
    await expect(page.getByText("C-101-P1-WHT", { exact: true })).toBeVisible();

    await page.goto(
      `/drawings/${drawingId}?sheetId=sheet_field&objectKind=placement&objectId=deleted_placement`
    );
    await expect(page.getByTestId("active-sheet-heading")).toContainText(
      "JB001 Field Terminations"
    );
    await expect(page.getByText("C-101-P1-WHT", { exact: true })).toHaveCount(0);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});

test("rejects lazy BOM loading when the saved drawing revision changed", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();
  try {
    await page.goto(`/panel-analysis/${drawingId}`);
    await expect(page.getByRole("heading", { name: "Error Detection" })).toBeVisible();
    await prisma.drawing.update({
      where: { id: drawingId },
      data: { updatedAt: new Date(Date.now() + 60_000) }
    });
    await page.getByRole("button", { name: "Materials / BOM" }).click();
    await expect(
      page.locator('[role="alert"]').filter({
        hasText: "Materials could not be loaded"
      })
    ).toContainText("saved drawing changed");
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
