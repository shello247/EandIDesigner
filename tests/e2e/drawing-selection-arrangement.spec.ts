import { expect, test } from "@playwright/test";
import {
  createE2eSelectionArrangementDrawing,
  deleteE2eDrawing
} from "./drawing-fixtures";

test("aligns and evenly distributes a multi-selection", async ({ page }) => {
  test.setTimeout(90000);
  let drawingId: string | undefined;

  try {
    const fixture = await createE2eSelectionArrangementDrawing();
    drawingId = fixture.drawingId;
    await page.goto(`/drawings/${drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    const placementRects = fixture.placementIds.map((placementId) =>
      page.locator(
        `svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="${placementId}"]`
      )
    );

    const placementClickPosition = { x: 3, y: 3 };
    await placementRects[0].click({
      force: true,
      position: placementClickPosition
    });
    for (const placementRect of placementRects.slice(1)) {
      await placementRect.click({
        force: true,
        modifiers: ["Control"],
        position: placementClickPosition
      });
    }

    const selectionSection = page.getByRole("button", { name: /^Selection/ });
    await expect(selectionSection).toHaveAttribute("aria-expanded", "false");
    await selectionSection.click();
    await expect(page.getByTestId("drawing-selection-arrange-controls")).toBeVisible();
    await page.getByRole("button", { name: "Align top" }).click();

    const alignedTops = await Promise.all(
      placementRects.map(async (placementRect) =>
        Number(await placementRect.getAttribute("y"))
      )
    );
    expect(new Set(alignedTops).size).toBe(1);
    await expect(
      page.getByTestId("drawing-selection-arrange-controls")
    ).toBeVisible();

    const firstXBefore = Number(await placementRects[0].getAttribute("x"));
    const lastXBefore = Number(await placementRects[3].getAttribute("x"));
    await page
      .getByRole("button", { name: "Distribute horizontally" })
      .click();

    const arrangedBounds = await Promise.all(
      placementRects.map(async (placementRect) => ({
        x: Number(await placementRect.getAttribute("x")),
        width: Number(await placementRect.getAttribute("width"))
      }))
    );
    const sortedBounds = [...arrangedBounds].sort((first, second) => first.x - second.x);
    const gaps = sortedBounds.slice(1).map(
      (bounds, index) =>
        bounds.x - (sortedBounds[index].x + sortedBounds[index].width)
    );

    expect(sortedBounds[0].x).toBeCloseTo(firstXBefore, 2);
    expect(sortedBounds[sortedBounds.length - 1].x).toBeCloseTo(lastXBefore, 2);
    gaps.forEach((gap) => expect(gap).toBeCloseTo(gaps[0], 1));
    await expect(
      page.getByText("Distributed 4 symbols horizontally.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();

    const reloadedTops = await Promise.all(
      placementRects.map(async (placementRect) =>
        Number(await placementRect.getAttribute("y"))
      )
    );
    expect(new Set(reloadedTops).size).toBe(1);
  } finally {
    await deleteE2eDrawing(drawingId);
  }
});
