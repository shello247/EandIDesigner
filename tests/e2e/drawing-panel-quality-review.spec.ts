import { expect, test } from "@playwright/test";
import {
  createE2ePanelQualityPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("keeps panel QC in blocked approval without a standalone review toolbar action", async ({
  page
}) => {
  const drawingId = await createE2ePanelQualityPackage();

  try {
    await page.goto(`/drawings/${drawingId}`);
    await page.getByRole("button", { name: "Open sheet loader" }).click();
    await page.getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("searchbox", { name: "Search sheets" })
      .fill("JB001 Detailed Panel Drawing");
    await page
      .getByRole("dialog", { name: "Sheet Loader" })
      .getByRole("row", { name: /JB001 Detailed Panel Drawing Detailed Panel/ })
      .getByRole("button", { name: "Load" })
      .click();

    await expect(page.getByRole("button", { name: /Panel Review/, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wire", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pattern", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText("Approval blocked");
    let review = page.getByRole("dialog", {
      name: "JB001 Panel Drawing Review"
    });
    await expect(review).toContainText("orphan_panel_route");
    const orphanRow = review.getByRole("row", { name: /orphan_panel_route/ });
    await orphanRow.getByRole("button", { name: "Repair" }).click();
    await page
      .getByRole("alertdialog", { name: "Remove orphan route" })
      .getByRole("button", { name: "Confirm repair" })
      .click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Approved panel repair applied"
    );
    await expect(review).not.toContainText("orphan_panel_route");

    const sourceFinding = review.getByRole("row", {
      name: /unresolved_external_termination/
    });
    await sourceFinding.getByRole("button", { name: "Go to" }).click();
    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "JB001 Field Terminations"
    );
    await expect(page.getByRole("button", { name: /Panel Review/, includeHidden: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Approval blocked"
    );
    review = page.getByRole("dialog", {
      name: "JB001 Panel Drawing Review"
    });
    await expect(review).toBeVisible();
    await expect(page.getByTestId("active-sheet-readout")).toContainText(
      "JB001 Detailed Panel Drawing"
    );
    await review.getByRole("button", { name: "Close panel review" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Open sheet loader" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Panel Review/, includeHidden: true })).toHaveCount(0);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
