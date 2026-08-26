import { expect, test } from "@playwright/test";
import {
  createE2eDinRailResizePackage,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

test("resizes DIN rail length from an end handle without changing width", async ({
  page
}) => {
  const fixture = await createE2eDinRailResizePackage();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);

    const rail = page.locator(
      `rect[data-placement-id="${fixture.railId}"]`
    );
    await rail.click();
    await expect(page.getByLabel("Length (mm)", { exact: true })).toHaveValue(
      "170"
    );
    await expect(page.getByLabel("Width (mm)", { exact: true })).toHaveValue(
      "35"
    );
    await expect(page.locator("circle[data-length-resize-handle]")).toHaveCount(
      2
    );
    const slots = page.locator(
      '[data-generated-din-rail="true"] [data-din-rail-slot]'
    );
    await expect(slots).toHaveCount(4);
    const firstSlotBeforeResize = await slots.nth(0).boundingBox();
    const secondSlotBeforeResize = await slots.nth(1).boundingBox();

    const beforeResize = await rail.boundingBox();
    const endHandle = page.locator(
      'circle[data-length-resize-handle="end"]'
    );
    const endHandleBox = await endHandle.boundingBox();

    if (!beforeResize || !endHandleBox) {
      throw new Error("Expected the selected DIN rail and its end handle.");
    }

    await page.mouse.move(
      endHandleBox.x + endHandleBox.width / 2,
      endHandleBox.y + endHandleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      endHandleBox.x + endHandleBox.width / 2 + 100,
      endHandleBox.y + endHandleBox.height / 2
    );
    await page.mouse.up();

    const afterResize = await rail.boundingBox();

    if (!afterResize) {
      throw new Error("Expected the resized DIN rail to remain visible.");
    }

    expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20);
    expect(Math.abs(afterResize.height - beforeResize.height)).toBeLessThan(1);
    const resizedSlotCount = await slots.count();
    const firstSlotAfterResize = await slots.nth(0).boundingBox();
    const secondSlotAfterResize = await slots.nth(1).boundingBox();

    expect(resizedSlotCount).toBeGreaterThan(4);
    if (
      !firstSlotBeforeResize ||
      !secondSlotBeforeResize ||
      !firstSlotAfterResize ||
      !secondSlotAfterResize
    ) {
      throw new Error("Expected fixed-size DIN rail slots before and after resizing.");
    }
    expect(
      Math.abs(firstSlotAfterResize.width - firstSlotBeforeResize.width)
    ).toBeLessThan(1);
    expect(
      Math.abs(firstSlotAfterResize.height - firstSlotBeforeResize.height)
    ).toBeLessThan(1);
    expect(
      Math.abs(
        (secondSlotAfterResize.x - firstSlotAfterResize.x) -
          (secondSlotBeforeResize.x - firstSlotBeforeResize.x)
      )
    ).toBeLessThan(1);

    const saveButton = page.getByRole("button", { name: "Save", exact: true });
    await saveButton.click();
    await expect(page.getByTestId("drawing-toast")).toContainText(
      "Drawing saved."
    );
    await expect(
      page.getByRole("button", { name: "Drawing saved" })
    ).toBeDisabled();
    await page.reload();

    const persistedRail = page.locator(
      `rect[data-placement-id="${fixture.railId}"]`
    );
    await expect(persistedRail).toBeVisible();
    const persistedBounds = await persistedRail.boundingBox();
    const persistedSlots = page.locator(
      '[data-generated-din-rail="true"] [data-din-rail-slot]'
    );

    expect(persistedBounds?.width ?? 0).toBeGreaterThan(beforeResize.width + 20);
    expect(
      Math.abs((persistedBounds?.height ?? 0) - beforeResize.height)
    ).toBeLessThan(1);
    await expect(persistedSlots).toHaveCount(resizedSlotCount);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
