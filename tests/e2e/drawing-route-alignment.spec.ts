import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createE2eWireHitTestingDrawing,
  deleteE2eDrawing,
  deleteE2eSymbol
} from "./drawing-fixtures";

async function drawingToClientPoint(
  page: Page,
  point: { x: number; y: number }
) {
  return page
    .locator('svg[aria-label="Interactive drawing overlay"]')
    .evaluate((svg, drawingPoint) => {
      const matrix = (svg as SVGSVGElement).getScreenCTM();
      if (!matrix) {
        throw new Error("The drawing overlay has no screen transform.");
      }

      const svgPoint = (svg as SVGSVGElement).createSVGPoint();
      svgPoint.x = drawingPoint.x;
      svgPoint.y = drawingPoint.y;
      const transformed = svgPoint.matrixTransform(matrix);
      return { x: transformed.x, y: transformed.y };
    }, point);
}

async function dragRouteHandle(
  page: Page,
  handle: Locator,
  target: { x: number; y: number },
  options?: { alt?: boolean; pauseBeforeRelease?: boolean }
) {
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error("The route handle has no visible bounding box.");
  }
  const clientTarget = await drawingToClientPoint(page, target);

  if (options?.alt) await page.keyboard.down("Alt");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(clientTarget.x, clientTarget.y, { steps: 4 });
  if (options?.pauseBeforeRelease) return;
  await page.mouse.up();
  if (options?.alt) await page.keyboard.up("Alt");
}

async function routePointCenter(handle: Locator) {
  return handle.evaluate((element) => {
    const rect = element as SVGRectElement;
    return {
      x: rect.x.baseVal.value + rect.width.baseVal.value / 2,
      y: rect.y.baseVal.value + rect.height.baseVal.value / 2
    };
  });
}

test("snaps route points with guides and inserts new points on the clicked segment", async ({
  page
}) => {
  const fixture = await createE2eWireHitTestingDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });
    const outerLine = page.locator(
      `[data-testid="canvas-connection-line"][data-connection-id="${fixture.outerConnectionId}"]`
    );
    const outerHit = page.locator(
      `[data-testid="canvas-connection-hit"][data-connection-id="${fixture.outerConnectionId}"]`
    );
    const outerPoint = page.locator(
      `[data-testid="canvas-route-point"][data-route-point-id="${fixture.outerConnectionId}_left_bottom"]`
    );

    await outerHit.dispatchEvent("pointerdown", { button: 0 });
    await expect(outerLine).toHaveClass(/stroke-sky-600/);
    await expect(outerPoint).toBeVisible();
    const originalCount = await page.getByTestId("canvas-route-point").count();

    await dragRouteHandle(page, outerPoint, { x: 38, y: 190 }, { alt: true });
    expect((await routePointCenter(outerPoint)).x).toBeCloseTo(38, 1);

    await dragRouteHandle(
      page,
      outerPoint,
      { x: 34, y: 180 },
      { pauseBeforeRelease: true }
    );
    await expect(
      page.locator(
        '[data-testid="canvas-route-alignment-guide"][data-alignment-axis="x"]'
      )
    ).toBeAttached();
    await page.mouse.up();
    await expect(page.getByTestId("canvas-route-alignment-guides")).toHaveCount(0);
    expect((await routePointCenter(outerPoint)).x).toBeCloseTo(30, 1);
    await expect(page.getByTestId("canvas-route-point")).toHaveCount(originalCount);

    const innerPoint = await drawingToClientPoint(page, { x: 195, y: 125 });
    await page.mouse.click(innerPoint.x, innerPoint.y, { clickCount: 2 });
    const inserted = page.locator(
      `[data-testid="canvas-route-point"][data-route-point-id^="${fixture.innerConnectionId}_control_"]`
    );
    await expect(inserted).toBeVisible();
    expect((await routePointCenter(inserted)).y).toBeCloseTo(125, 2);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});

test("drags an internal route segment as one orthogonal line", async ({ page }) => {
  const fixture = await createE2eWireHitTestingDrawing();

  try {
    await page.goto(`/drawings/${fixture.drawingId}`);
    await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
      timeout: 15000
    });
    const outerLine = page.locator(
      `[data-testid="canvas-connection-line"][data-connection-id="${fixture.outerConnectionId}"]`
    );
    const outerHit = page.locator(
      `[data-testid="canvas-connection-hit"][data-connection-id="${fixture.outerConnectionId}"]`
    );
    await outerHit.dispatchEvent("pointerdown", { button: 0 });
    await expect(outerLine).toHaveClass(/stroke-sky-600/);

    const segmentKey = `${fixture.outerConnectionId}_left_bottom_${fixture.outerConnectionId}_right_bottom_direct`;
    const segmentHandle = page.locator(
      `[data-testid="canvas-route-segment-handle"][data-route-segment-key="${segmentKey}"]`
    );
    await expect(segmentHandle).toBeAttached();
    const start = await drawingToClientPoint(page, { x: 195, y: 220 });
    const target = await drawingToClientPoint(page, { x: 195, y: 200 });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 4 });
    await page.mouse.up();
    await expect(outerLine).toHaveAttribute("d", /200/);
    await page.mouse.click(target.x, target.y);
    await expect(outerLine).toHaveClass(/stroke-sky-600/);
    const pointCenters = await page
      .getByTestId("canvas-route-point")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element as SVGRectElement;
          return {
            id: element.getAttribute("data-route-point-id"),
            x: rect.x.baseVal.value + rect.width.baseVal.value / 2,
            y: rect.y.baseVal.value + rect.height.baseVal.value / 2
          };
        })
      );
    const leftCenter = pointCenters.find(
      (point) => point.id === `${fixture.outerConnectionId}_left_bottom`
    );
    const rightCenter = pointCenters.find(
      (point) => point.id === `${fixture.outerConnectionId}_right_bottom`
    );
    expect(leftCenter).toBeDefined();
    expect(rightCenter).toBeDefined();
    if (!leftCenter || !rightCenter) {
      throw new Error("The dragged segment lost its persisted route points.");
    }
    expect(leftCenter.y).toBeCloseTo(rightCenter.y, 2);
    expect(leftCenter.y).toBeCloseTo(200, 1);

    await page.keyboard.press("Control+z");
    await expect(outerLine).toHaveAttribute("d", /220/);
  } finally {
    await deleteE2eDrawing(fixture.drawingId);
    await deleteE2eSymbol(fixture.symbolId);
  }
});
