import { describe, expect, it } from "vitest";
import {
  calculateScrollForZoomAnchor,
  calculateFitTransform,
  clampZoom,
  formatZoomPercent,
  wheelDeltaInPixels,
  zoomAtPoint
} from "../logic/services/viewport-transform";

describe("viewport transform", () => {
  it.each([
    [0, -48, -48],
    [1, -3, -48],
    [2, -1, -600],
    [1, 3, 48],
    [0, -0.5, -0.5],
    [0, 0, 0]
  ])("normalizes wheel units (mode %i, delta %f)", (deltaMode, deltaY, expected) => {
    expect(wheelDeltaInPixels({ deltaMode, deltaY }, 600)).toBe(expected);
  });

  it("clamps zoom to the supported drawing viewport range", () => {
    expect(clampZoom(0.05)).toBe(0.2);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(4)).toBe(4);
    expect(clampZoom(6)).toBe(6);
    expect(clampZoom(8)).toBe(8);
    expect(clampZoom(8.001)).toBe(8);
    expect(clampZoom(10)).toBe(8);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("displays the full 800 percent zoom range", () => {
    expect(formatZoomPercent(0.2)).toBe("20%");
    expect(formatZoomPercent(1)).toBe("100%");
    expect(formatZoomPercent(6)).toBe("600%");
    expect(formatZoomPercent(8)).toBe("800%");
    expect(formatZoomPercent(10)).toBe("800%");
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

  it.each([[1, 2], [4, 8], [8, 4], [4, 12]])(
    "keeps the cursor anchor stable from %fx to %fx (clamped)", (currentZoom, nextZoom) => {
    const current = { zoom: currentZoom, panX: 100, panY: 80 };
    const next = zoomAtPoint({
      current,
      nextZoom,
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

  it("does not move the anchor when already at the 800 percent ceiling", () => {
    const current = { zoom: 8, panX: -1400, panY: -720 };
    expect(zoomAtPoint({
      current, nextZoom: 12, pointerX: 300, pointerY: 240
    })).toEqual(current);
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
