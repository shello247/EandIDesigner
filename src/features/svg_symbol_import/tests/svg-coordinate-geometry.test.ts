import { describe, expect, it } from "vitest";
import {
  clampPointToViewBox,
  findNearestAnchorInScreenSpace,
  getAdaptiveSvgMarkerDiameterPx,
  getContainedSvgStageDimensions,
  getMaximumSvgStageDimensions,
  getRenderedPixelsPerUserUnit,
  getResponsiveSvgStageDimensions,
  isUsableSvgViewBox,
  roundSvgPoint,
  SVG_MARKER_DIAMETER_PX,
  svgUserUnitsForPixels,
  transformClientPoint
} from "@/shared/svg/svg-coordinate-geometry";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";

describe("SVG coordinate-stage geometry", () => {
  it.each([
    ["Phoenix", { x: 0, y: 0, width: 42, height: 143 }, (620 * 42) / 143, 620],
    ["2085-IF4", { x: 0, y: 0, width: 169, height: 511 }, (620 * 169) / 511, 620],
    ["breaker", { x: 0, y: 0, width: 109, height: 147 }, (620 * 109) / 147, 620],
    ["Terminal Block Single", { x: 0, y: 0, width: 20, height: 178 }, (620 * 20) / 178, 620],
    ["landscape", { x: 0, y: 0, width: 160, height: 100 }, 620, 387.5],
    ["square", { x: 0, y: 0, width: 100, height: 100 }, 620, 620],
    ["non-zero origin", { x: -30, y: 45, width: 200, height: 100 }, 620, 310]
  ] as const)(
    "fits the %s viewBox inside 620 CSS pixels",
    (_name, viewBox, expectedWidth, expectedHeight) => {
      const dimensions = getMaximumSvgStageDimensions(viewBox);

      expect(dimensions.width).toBeCloseTo(expectedWidth);
      expect(dimensions.height).toBeCloseTo(expectedHeight);
      expect(dimensions.width).toBeLessThanOrEqual(620);
      expect(dimensions.height).toBeLessThanOrEqual(620);
    }
  );

  it("reduces both dimensions proportionally in a narrow responsive container", () => {
    const viewBox = { x: 0, y: 0, width: 42, height: 143 };

    expect(getResponsiveSvgStageDimensions(viewBox, 100)).toEqual({
      width: 100,
      height: (100 * 143) / 42
    });
    expect(getResponsiveSvgStageDimensions(viewBox, 400)).toEqual(
      getMaximumSvgStageDimensions(viewBox)
    );
  });

  it.each([
    [
      "portrait",
      { x: 0, y: 0, width: 169, height: 511 },
      { width: 500, height: 360 },
      (360 * 169) / 511,
      360
    ],
    [
      "landscape",
      { x: 0, y: 0, width: 160, height: 100 },
      { width: 320, height: 500 },
      320,
      200
    ],
    [
      "square",
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 900, height: 900 },
      620,
      620
    ],
    [
      "non-zero origin",
      { x: -30, y: 45, width: 200, height: 100 },
      { width: 250, height: 90 },
      180,
      90
    ]
  ] as const)(
    "fits the %s viewBox inside both container dimensions",
    (_name, viewBox, available, expectedWidth, expectedHeight) => {
      const dimensions = getContainedSvgStageDimensions(viewBox, available);

      expect(dimensions.width).toBeCloseTo(expectedWidth);
      expect(dimensions.height).toBeCloseTo(expectedHeight);
      expect(dimensions.width).toBeLessThanOrEqual(available.width);
      expect(dimensions.height).toBeLessThanOrEqual(available.height);
      expect(dimensions.width).toBeLessThanOrEqual(620);
      expect(dimensions.height).toBeLessThanOrEqual(620);
    }
  );

  it("rejects invalid container sizes", () => {
    const viewBox = { x: 0, y: 0, width: 42, height: 143 };

    expect(
      getContainedSvgStageDimensions(viewBox, { width: 0, height: 300 })
    ).toEqual({ width: 0, height: 0 });
    expect(
      getContainedSvgStageDimensions(viewBox, {
        width: Number.NaN,
        height: 300
      })
    ).toEqual({ width: 0, height: 0 });
  });

  it("rejects malformed legacy viewBoxes so callers can use the fallback renderer", () => {
    expect(
      isUsableSvgViewBox({ x: Number.NaN, y: 0, width: 42, height: 143 })
    ).toBe(false);
    expect(isUsableSvgViewBox({ x: 0, y: 0, width: 0, height: 143 })).toBe(
      false
    );
  });

  it.each([
    [{ width: 182.1, height: 620 }, { x: 0, y: 0, width: 42, height: 143 }],
    [{ width: 620, height: 387.5 }, { x: 0, y: 0, width: 160, height: 100 }],
    [{ width: 250, height: 250 }, { x: -50, y: 20, width: 100, height: 100 }]
  ] as const)(
    "keeps an 18px marker at every stage size",
    (renderedSize, viewBox) => {
      const scale = getRenderedPixelsPerUserUnit(viewBox, renderedSize);
      const radiusInUserUnits = svgUserUnitsForPixels(
        SVG_MARKER_DIAMETER_PX / 2,
        scale
      );

      expect(radiusInUserUnits * 2 * scale).toBeCloseTo(18);
    }
  );

  it("retains the preferred marker diameter for normally spaced anchors", () => {
    const anchors = [
      { x: 10, y: 10 },
      { x: 30, y: 10 }
    ];

    expect(getAdaptiveSvgMarkerDiameterPx(anchors, 0, 2)).toBe(18);
  });

  it("shrinks dense cable markers to preserve visible separation", () => {
    const anchors = Array.from({ length: 13 }, (_, index) => ({
      x: 20 + index * 4,
      y: 10
    }));

    expect(getAdaptiveSvgMarkerDiameterPx(anchors, 6, 2)).toBeCloseTo(5.6);
  });

  it("keeps coincident marker geometry visible at the minimum diameter", () => {
    const anchors = [
      { x: 10, y: 10 },
      { x: 10, y: 10 }
    ];

    expect(getAdaptiveSvgMarkerDiameterPx(anchors, 0, 4)).toBe(5);
  });
});

describe("nearest SVG anchor selection", () => {
  const anchors = [
    { key: "2.5", x: 21.5, y: 39.5 },
    { key: "3.1", x: 21.5, y: 48.5 },
    { key: "3.2", x: 21.5, y: 52.5 }
  ];

  it("selects the nearest dense Phoenix terminal inside 12 screen pixels", () => {
    const result = findNearestAnchorInScreenSpace(
      anchors,
      { x: 21.5, y: 51.7 },
      4.33,
      12
    );

    expect(result?.key).toBe("3.2");
  });

  it("rejects a pointer outside the fixed screen-space radius", () => {
    expect(
      findNearestAnchorInScreenSpace(anchors, { x: 30, y: 60 }, 4.33, 12)
    ).toBeNull();
  });

  it("resolves exact-distance ties in hotspot document order", () => {
    const tied = [
      { key: "first", x: 10, y: 10 },
      { key: "second", x: 14, y: 10 }
    ];

    expect(
      findNearestAnchorInScreenSpace(tied, { x: 12, y: 10 }, 5, 12)?.key
    ).toBe("first");
  });

  it("selects distinct anchors in an NRF81-style dense row", () => {
    const denseRow = Array.from({ length: 8 }, (_, index) => ({
      key: `CH${index + 1}`,
      x: 10 + index * 3,
      y: 20
    }));

    expect(
      findNearestAnchorInScreenSpace(denseRow, { x: 25.8, y: 20 }, 6, 12)
        ?.key
    ).toBe("CH6");
  });
});

describe("SVG pointer conversion", () => {
  const viewBox: SvgViewBox = { x: -10, y: 20, width: 42, height: 143 };

  it("applies an inverse screen matrix to client coordinates", () => {
    expect(
      transformClientPoint(
        { x: 30, y: 60 },
        { a: 0.5, b: 0, c: 0, d: 0.25, e: -5, f: -10 }
      )
    ).toEqual({ x: 10, y: 5 });
  });

  it("clamps non-zero-origin viewBoxes and rounds saved coordinates", () => {
    expect(
      roundSvgPoint(
        clampPointToViewBox({ x: 90.555, y: 19.444 }, viewBox)
      )
    ).toEqual({ x: 32, y: 20 });
    expect(roundSvgPoint({ x: 12.345, y: 67.899 })).toEqual({
      x: 12.35,
      y: 67.9
    });
  });
});
