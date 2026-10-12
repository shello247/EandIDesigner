import { type Page } from "./drawing-test";

/** Wait for Fit/zoom's smooth scrolling before converting drawing coordinates. */
export async function waitForDrawingViewport(page: Page) {
  await page.locator('svg[aria-label="Interactive drawing overlay"]').evaluate(async (element) => {
    const svg = element as SVGSVGElement;
    const started = performance.now();
    let stableSince = started;
    let previous: number[] | undefined;
    while (performance.now() - started < 5000) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const matrix = svg.getScreenCTM();
      if (!matrix) throw new Error("The drawing overlay has no screen transform.");
      const current = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
      if (!previous || current.some((value, index) => Math.abs(value - previous![index]) > 0.01)) {
        stableSince = performance.now();
      } else if (performance.now() - stableSince >= 150) {
        return;
      }
      previous = current;
    }
    throw new Error("Drawing viewport did not settle before the pointer gesture.");
  });
}

