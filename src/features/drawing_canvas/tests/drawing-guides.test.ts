import { describe, expect, it } from "vitest";
import {
  deriveDrawingRulerTicks,
  formatDrawingGuidePosition,
  resolveDrawingGuideSnap,
  type DrawingGuide,
  type DrawingGuideSnapBounds
} from "../logic/services/drawing-guides";

const bounds: DrawingGuideSnapBounds = {
  left: 20,
  right: 40,
  top: 30,
  bottom: 50,
  centerX: 30,
  centerY: 40
};

const guides: DrawingGuide[] = [
  { id: "vertical", axis: "vertical", position: 60 },
  { id: "horizontal", axis: "horizontal", position: 75 }
];

describe("drawing guides", () => {
  it.each([
    { pixelsPerUnit: 0.5, proposedX: 5, expectedX: 20 },
    { pixelsPerUnit: 1, proposedX: 14, expectedX: 20 },
    { pixelsPerUnit: 2, proposedX: 17, expectedX: 20 }
  ])(
    "uses screen-space acquisition tolerance at $pixelsPerUnit pixels per unit",
    ({ pixelsPerUnit, proposedX, expectedX }) => {
      const result = resolveDrawingGuideSnap({
        bounds,
        proposedDelta: { x: proposedX, y: 0 },
        guides,
        pixelsPerUnit: { x: pixelsPerUnit, y: pixelsPerUnit }
      });

      expect(result.delta.x).toBe(expectedX);
      expect(result.snapState.verticalGuideId).toBe(
        expectedX === proposedX ? undefined : "vertical"
      );
    }
  );

  it("snaps horizontal and vertical axes independently", () => {
    const result = resolveDrawingGuideSnap({
      bounds,
      proposedDelta: { x: 12, y: 27 },
      guides,
      pixelsPerUnit: { x: 1, y: 1 }
    });

    expect(result.delta).toEqual({ x: 20, y: 25 });
    expect(result.snapState).toEqual({
      verticalGuideId: "vertical",
      horizontalGuideId: "horizontal"
    });
  });

  it("holds an acquired guide until the release threshold is exceeded", () => {
    const held = resolveDrawingGuideSnap({
      bounds,
      proposedDelta: { x: 21, y: 0 },
      guides,
      pixelsPerUnit: { x: 1, y: 1 },
      activeSnapState: { verticalGuideId: "vertical" }
    });
    const released = resolveDrawingGuideSnap({
      bounds,
      proposedDelta: { x: 60, y: 0 },
      guides,
      pixelsPerUnit: { x: 1, y: 1 },
      activeSnapState: { verticalGuideId: "vertical" }
    });

    expect(held.delta.x).toBe(20);
    expect(held.snapState.verticalGuideId).toBe("vertical");
    expect(released.delta.x).toBe(60);
    expect(released.snapState.verticalGuideId).toBeUndefined();
  });

  it("bypasses guide snapping while Alt is held", () => {
    const result = resolveDrawingGuideSnap({
      bounds,
      proposedDelta: { x: 12, y: 27 },
      guides,
      pixelsPerUnit: { x: 1, y: 1 },
      bypass: true
    });

    expect(result).toEqual({ delta: { x: 12, y: 27 }, snapState: {} });
  });

  it("derives readable ruler ticks at different zoom levels and units", () => {
    const millimetreTicks = deriveDrawingRulerTicks({
      length: 420,
      pixelsPerUnit: 2,
      measurementUnit: "mm"
    });
    const inchTicks = deriveDrawingRulerTicks({
      length: 420,
      pixelsPerUnit: 2,
      measurementUnit: "in"
    });

    expect(millimetreTicks.filter((tick) => tick.major).slice(0, 3)).toEqual([
      { position: 0, major: true, label: "0" },
      { position: 50, major: true, label: "50" },
      { position: 100, major: true, label: "100" }
    ]);
    expect(inchTicks.filter((tick) => tick.major).slice(0, 3)).toEqual([
      { position: 0, major: true, label: "0" },
      { position: 50.8, major: true, label: "2" },
      { position: 101.6, major: true, label: "4" }
    ]);
  });

  it("formats guide coordinates in the active drawing unit", () => {
    expect(
      formatDrawingGuidePosition(
        { id: "guide", axis: "vertical", position: 50.8 },
        "in"
      )
    ).toBe("X 2.00 in");
    expect(
      formatDrawingGuidePosition(
        { id: "guide", axis: "horizontal", position: 75 },
        "mm"
      )
    ).toBe("Y 75.0 mm");
  });
});
