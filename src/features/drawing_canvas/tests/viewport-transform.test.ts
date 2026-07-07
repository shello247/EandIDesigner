import { describe, expect, it } from "vitest";
import {
  calculateScrollForZoomAnchor,
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

  it("calculates scroll offsets that keep a sheet point under the cursor", () => {
    const nextScroll = calculateScrollForZoomAnchor({
      scrollLeft: 120,
      scrollTop: 240,
      paperLeft: 80,
      paperTop: 140,
      pointerClientX: 300,
      pointerClientY: 260,
      sheetX: 110,
      sheetY: 60,
      nextScale: 3
    });
    const correctedPaperLeft = 80 - (nextScroll.left - 120);
    const correctedPaperTop = 140 - (nextScroll.top - 240);

    expect(correctedPaperLeft + 110 * 3).toBeCloseTo(300);
    expect(correctedPaperTop + 60 * 3).toBeCloseTo(260);
  });
});
