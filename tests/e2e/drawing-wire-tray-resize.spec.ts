import { expect, test } from "./drawing-test";
import {
  createE2eWireTrayResizePackage,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("resizes wire tray length from an end handle without changing width", async ({
  page
}) => {
  const fixture = await createE2eWireTrayResizePackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);

    const tray = page.locator(
      `rect[data-placement-id="${fixture.trayId}"]`
    );
    await tray.click();
    await expect(page.locator("circle[data-length-resize-handle]")).toHaveCount(
      2
    );

    const beforeResize = await tray.boundingBox();
    const endHandle = page.locator(
      'circle[data-length-resize-handle="end"]'
    );
    const endHandleBox = await endHandle.boundingBox();

    if (!beforeResize || !endHandleBox) {
      throw new Error("Expected the selected wire tray and its end handle.");
    }

    await page.mouse.move(
      endHandleBox.x + endHandleBox.width / 2,
      endHandleBox.y + endHandleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      endHandleBox.x + endHandleBox.width / 2 + 48,
      endHandleBox.y + endHandleBox.height / 2
    );
    await page.mouse.up();

    const afterResize = await tray.boundingBox();

    if (!afterResize) {
      throw new Error("Expected the resized wire tray to remain visible.");
    }

    expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20);
    expect(Math.abs(afterResize.height - beforeResize.height)).toBeLessThan(1);

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await page.reload();

    const persistedTray = page.locator(
      `rect[data-placement-id="${fixture.trayId}"]`
    );
    const persistedBounds = await persistedTray.boundingBox();

    expect(persistedBounds?.width ?? 0).toBeGreaterThan(beforeResize.width + 20);
    expect(
      Math.abs((persistedBounds?.height ?? 0) - beforeResize.height)
    ).toBeLessThan(1);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
  }
});
