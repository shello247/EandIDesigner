import { expect, test } from "@playwright/test";
import {
  createE2ePaginatedConnectedWireScheduleDrawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("creates and synchronizes connected wire schedule continuation sheets", async ({
  page
}) => {
  const fixture = await createE2ePaginatedConnectedWireScheduleDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    await page.getByTestId("connected-wire-schedule-hit").click();
    const scheduleSection = page.getByRole("button", {
      name: /^Connected Wire Schedule/
    });
    await expect(scheduleSection).toHaveAttribute("aria-expanded", "false");
    await scheduleSection.click();
    await expect(page.getByText("25", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Rows per sheet").fill("10");
    await page
      .getByRole("button", { name: "Create continuation sheets" })
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "3-part schedule created for PDB-101."
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Part 2 of 3"
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Rows 11–20 of 25"
    );

    const continuationScheduleSection = page.getByRole("button", {
      name: /^Connected Wire Schedule/
    });
    await expect(continuationScheduleSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await continuationScheduleSection.click();
    await page.getByRole("button", { name: "Open Part 1" }).click();
    const partOneScheduleSection = page.getByRole("button", {
      name: /^Connected Wire Schedule/
    });
    await expect(partOneScheduleSection).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await partOneScheduleSection.click();
    await expect(
      page.getByRole("button", { name: "Synchronize continuation sheets" })
    ).toBeVisible();
    await page.getByLabel("Rows per sheet").fill("13");
    await page
      .getByRole("button", { name: "Synchronize continuation sheets" })
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "PDB-101 continuation sheets synchronized."
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Part 1 of 2"
    );
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Rows 1–13 of 25"
    );

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();
    await page.getByTestId("connected-wire-schedule-hit").click();
    await expect(page.locator(".drawing-sheet-rendered svg")).toContainText(
      "Part 1 of 2"
    );

    const printResponse = await page.request.get(
      `/drawings/${fixture.drawingId}/print`
    );
    expect(printResponse.ok()).toBeTruthy();
    const printHtml = await printResponse.text();
    expect(printHtml).toContain("Part 1 of 2");
    expect(printHtml).toContain("Part 2 of 2");
    expect(printHtml).toContain("Rows 14–25 of 25");
    const renderedSchedules = [
      ...printHtml.matchAll(
        /<g data-connected-wire-schedule="[^"]+"[\s\S]*?<\/g>/g
      )
    ].map((match) => match[0]);
    expect(renderedSchedules).toHaveLength(2);
    expect(renderedSchedules.join("\n").match(/FW-001/g)).toHaveLength(1);
    expect(renderedSchedules.join("\n").match(/FW-025/g)).toHaveLength(1);

    const pdfResponse = await page.request.get(
      `/drawings/${fixture.drawingId}/pdf`
    );
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
  }
});
