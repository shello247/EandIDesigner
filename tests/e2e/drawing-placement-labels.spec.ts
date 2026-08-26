import { expect, test } from "@playwright/test";
import {
  createE2ePlacementLabelDrawing,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

test("keeps default equipment labels outside small and large symbol artwork", async ({
  page
}) => {
  const fixture = await createE2ePlacementLabelDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    const labels = await page
      .locator(".drawing-sheet-rendered svg")
      .evaluate((svg, placements) => {
        const readLabel = (element: Element | null) => {
          if (!element) {
            throw new Error("Expected placement label elements.");
          }
          const x = Number(element.getAttribute("x"));
          const y = Number(element.getAttribute("y"));
          const fontSize = Number(element.getAttribute("font-size"));
          return {
            x,
            y,
            fontSize
          };
        };

        return placements.map((placement) => {
          return {
            ...placement,
            tag: readLabel(
              svg.querySelector(`[data-placement-tag="${placement.id}"]`)
            ),
            title: readLabel(
              svg.querySelector(`[data-placement-title="${placement.id}"]`)
            )
          };
        });
      }, fixture.placements);

    expect(labels).toHaveLength(2);
    for (const item of labels) {
      expect(item.tag.y).toBeLessThan(item.title.y);
      expect(item.title.y + item.title.fontSize * 0.25).toBeLessThan(
        item.bounds.top
      );
      expect(item.tag.x).toBe(item.bounds.left);
      expect(item.title.x).toBe(item.bounds.left);
    }
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
