import { describe, expect, it } from "vitest";
import {
  calculateFitTransform,
  clampZoom,
  zoomAtPoint
} from "../logic/services/viewport-transform";

describe("viewport transform", () => {
  it("clamps zoom to the supported drawing viewport range", () => {
    expect(clampZoom(0.05)).toBe(0.2);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(10)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("fits and centers a sheet inside a viewport with padding", () => {
    const transform = calculateFitTransform(
      { width: 1000, height: 700 },
      { width: 840, height: 594 },
      40
    );

    expect(transform.zoom).toBeCloseTo(1);
    expect(transform.panX).toBeCloseTo(80);
    expect(transform.panY).toBeCloseTo(53);
  });

  it("keeps the drawing point under the cursor stable while zooming", () => {
    const current = { zoom: 1, panX: 100, panY: 80 };
    const next = zoomAtPoint({
      current,
      nextZoom: 2,
      pointerX: 300,
      pointerY: 240
    });

    const before = {
      x: (300 - current.panX) / current.zoom,
      y: (240 - current.panY) / current.zoom
    };
    const after = {
      x: (300 - next.panX) / next.zoom,
      y: (240 - next.panY) / next.zoom
    };

    expect(after).toEqual(before);
  });
});
