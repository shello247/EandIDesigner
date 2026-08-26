import { expect, test, type Page } from "@playwright/test";
import {
  createE2eWireHitTestingDrawing,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

async function clickDrawingPoint(
  page: Page,
  point: { x: number; y: number },
  clickCount = 1
) {
  const clientPoint = await page
    .locator('svg[aria-label="Interactive drawing overlay"]')
    .evaluate((svg, userPoint) => {
      const matrix = (svg as SVGSVGElement).getScreenCTM();

      if (!matrix) {
        throw new Error("The drawing overlay has no screen transform.");
      }

      const svgPoint = (svg as SVGSVGElement).createSVGPoint();
      svgPoint.x = userPoint.x;
      svgPoint.y = userPoint.y;
      const transformed = svgPoint.matrixTransform(matrix);

      return { x: transformed.x, y: transformed.y };
    }, point);

  await page.mouse.click(clientPoint.x, clientPoint.y, { clickCount });
}

test("selects only wire strokes when one orthogonal route encloses another", async ({
  page
}) => {
  const fixture = await createE2eWireHitTestingDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });

    const innerLine = page.locator(
      `[data-testid="canvas-connection-line"][data-connection-id="${fixture.innerConnectionId}"]`
    );
    const outerLine = page.locator(
      `[data-testid="canvas-connection-line"][data-connection-id="${fixture.outerConnectionId}"]`
    );
    const innerHit = page.locator(
      `[data-testid="canvas-connection-hit"][data-connection-id="${fixture.innerConnectionId}"]`
    );
    const outerHit = page.locator(
      `[data-testid="canvas-connection-hit"][data-connection-id="${fixture.outerConnectionId}"]`
    );

    await expect(innerHit).toHaveAttribute("pointer-events", "stroke");
    await expect(outerHit).toHaveAttribute("pointer-events", "stroke");
    await expect(innerLine).toHaveAttribute("pointer-events", "none");
    await expect(outerLine).toHaveAttribute("pointer-events", "none");

    await clickDrawingPoint(page, { x: 195, y: 125 });
    await expect(innerLine).toHaveClass(/stroke-sky-600/);
    await expect(outerLine).not.toHaveClass(/stroke-sky-600/);

    await clickDrawingPoint(page, { x: 30, y: 175 });
    await expect(outerLine).toHaveClass(/stroke-sky-600/);
    await expect(innerLine).not.toHaveClass(/stroke-sky-600/);

    await clickDrawingPoint(page, { x: 195, y: 170 });
    await expect(innerLine).not.toHaveClass(/stroke-sky-600/);
    await expect(outerLine).not.toHaveClass(/stroke-sky-600/);

    await page.getByRole("button", { name: "Zoom in" }).click();
    await clickDrawingPoint(page, { x: 195, y: 125 });
    await expect(innerLine).toHaveClass(/stroke-sky-600/);

    await clickDrawingPoint(page, { x: 30, y: 175 });
    await expect(outerLine).toHaveClass(/stroke-sky-600/);
    const routePointCount = await page
      .getByTestId("canvas-route-point")
      .count();
    await clickDrawingPoint(page, { x: 30, y: 175 }, 2);
    await expect(outerLine).toHaveClass(/stroke-sky-600/);
    await expect(page.getByTestId("canvas-route-point")).toHaveCount(
      routePointCount + 1
    );
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
