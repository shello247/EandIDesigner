import { expect, test } from "@playwright/test";
import {
  createE2ePanelQualityPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("sends blocked approval to saved Panel Analysis without legacy review controls", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByRole("button", { name: /Panel Review/, includeHidden: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page).toHaveURL(`/panel-analysis/${drawingId}`);
    await expect(page.getByRole("heading", { name: "Error Detection" })).toBeVisible();
    await page.getByLabel("Search findings").fill("orphan_panel_route");
    await expect(page.getByText(/orphan_panel_route/).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Panel Drawing Review/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Repair" })).toHaveCount(0);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
