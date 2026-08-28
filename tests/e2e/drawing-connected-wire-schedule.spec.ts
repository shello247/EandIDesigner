import { expect, test } from "./drawing-test";
import {
  createE2eConnectedWireScheduleDrawing,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

test("adds, configures, persists, and exports a connected wire schedule", async ({
  page
}) => {
  const fixture = await createE2eConnectedWireScheduleDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    await page
      .locator(
        `svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="${fixture.sourcePlacementId}"]`
      )
      .click({ force: true });
    await page.getByRole("button", { name: "Add to drawing" }).click();
    await page
      .getByRole("menuitem", { name: /Connected Wire Schedule/ })
      .click();

    const scheduleHit = page.getByTestId("connected-wire-schedule-hit");
    await expect(scheduleHit).toBeVisible();
    const scheduleSection = page.getByRole("button", {
      name: /^Connected Wire Schedule/
    });
    await expect(scheduleSection).toHaveAttribute("aria-expanded", "false");
    await scheduleSection.click();
    await expect(
      page
        .getByLabel("Drawing properties", { exact: true })
        .getByText("Total rows", { exact: true })
        .locator("..")
        .getByText("3", { exact: true })
    ).toBeVisible();
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "FW-001"
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "MCB-101:T1"
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Feeder 1"
    );

    const widthInput = page.getByLabel("Table width mm");
    await expect(widthInput).toHaveValue("190");
    const resizeHandle = page.getByTestId(
      "connected-wire-schedule-resize-handle"
    );
    const resizeBox = await resizeHandle.boundingBox();
    if (!resizeBox) throw new Error("Expected the schedule resize handle.");
    await page.mouse.move(
      resizeBox.x + resizeBox.width / 2,
      resizeBox.y + resizeBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      resizeBox.x + resizeBox.width / 2 - 40,
      resizeBox.y + resizeBox.height / 2
    );
    await page.mouse.up();
    await expect(widthInput).not.toHaveValue("190");

    const columnHandles = page.getByTestId(
      "connected-wire-schedule-column-resize-handle"
    );
    await expect(columnHandles).toHaveCount(5);
    const fromDivider = columnHandles.nth(2);
    const dividerBox = await fromDivider.boundingBox();
    if (!dividerBox) throw new Error("Expected a schedule column divider.");
    await page.mouse.move(
      dividerBox.x + dividerBox.width / 2,
      dividerBox.y + dividerBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      dividerBox.x + dividerBox.width / 2 + 30,
      dividerBox.y + dividerBox.height / 2
    );
    await page.mouse.up();
    await expect(
      page.getByRole("button", { name: "Reset column widths" })
    ).toBeEnabled();

    const connectionDisplay = page.getByLabel("Connection display");
    await connectionDisplay.selectOption("internal_connected");
    await expect(
      page
        .getByLabel("Drawing properties", { exact: true })
        .getByText("Total rows", { exact: true })
        .locator("..")
        .getByText("0", { exact: true })
    ).toBeVisible();
    await connectionDisplay.selectOption("external_connected");
    await expect(
      page
        .getByLabel("Drawing properties", { exact: true })
        .getByText("Total rows", { exact: true })
        .locator("..")
        .getByText("3", { exact: true })
    ).toBeVisible();
    await connectionDisplay.selectOption("all_connected");
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "FW-001"
    );
    await connectionDisplay.selectOption("sheet_only");
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "FW-003"
    );

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await expect(page.getByTestId("connected-wire-schedule-hit")).toBeVisible();
    await page.getByTestId("connected-wire-schedule-hit").click();
    const reloadedScheduleSection = page.getByRole("button", {
      name: /^Connected Wire Schedule/
    });
    await expect(reloadedScheduleSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await reloadedScheduleSection.click();
    await expect(page.getByLabel("Connection display")).toHaveValue(
      "sheet_only"
    );
    await expect(
      page.getByRole("button", { name: "Reset column widths" })
    ).toBeEnabled();
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "CONNECTED WIRE SCHEDULE"
    );

    const printResponse = await page.request.get(
      `/drawings/${fixture.drawingId}/print`
    );
    expect(printResponse.ok()).toBeTruthy();
    expect(await printResponse.text()).toContain(
      'data-connected-wire-schedule="'
    );

    const pdfResponse = await page.request.get(
      `/drawings/${fixture.drawingId}/pdf`
    );
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
