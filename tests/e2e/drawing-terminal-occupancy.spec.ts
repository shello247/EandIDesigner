import { expect, test } from "./drawing-test";
import {
  createE2eTerminalOccupancyPackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("enforces terminal-side occupancy across repeated equipment occurrences", async ({
  page
}) => {
  test.setTimeout(120000);
  const fixture = await createE2eTerminalOccupancyPackage();

  try {
    await page.goto(`/panel-analysis/${fixture.drawingId}`);
    await expect(
      page.getByRole("heading", {
        name: /TB-101:T1\/external has 2 conductors on the same terminal end/
      })
    ).toBeVisible();

    const firstLink = page.getByRole("link", {
      name: /Open C-101-P1-WHT/
    });
    const secondLink = page.getByRole("link", {
      name: /Open C-202-P1-WHT/
    });
    await expect(firstLink).toHaveAttribute(
      "href",
      new RegExp(`objectId=${fixture.firstConnectionId}`)
    );
    await expect(secondLink).toHaveAttribute(
      "href",
      new RegExp(`objectId=${fixture.conflictingConnectionId}`)
    );

    await page.goto(
      `/drawings/${fixture.drawingId}?sheetId=sheet_second_terminal_occurrence&objectKind=connection&objectId=${fixture.editableConnectionId}`
    );
    await expect(page.getByTestId("active-sheet-heading")).toContainText(
      "Second TB-101 occurrence"
    );
    await page
      .getByRole("button", { name: "Connection C-203-P2-BLK" })
      .click();
    const toAnchor = page.locator("#connection-to-anchor");
    await expect(toAnchor).toHaveValue("T2_BOTTOM");
    await expect(
      toAnchor.locator('option[value="T1_BOTTOM"]')
    ).toBeDisabled();
    await expect(toAnchor.locator('option[value="T1_TOP"]')).toBeEnabled();
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
  }
});
