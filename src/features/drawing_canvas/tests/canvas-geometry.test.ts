import { describe, expect, it } from "vitest";
import { getAnchorWorldPoint } from "../logic/services/drawing-geometry";
import {
  calculatePlacementResizeUpdate,
  calculatePlacementRotationUpdate,
  getRotationAngleFromPointer,
  normalizeRotation,
  snapPlacementRotation
} from "../ui/canvas/utils/canvasGeometry";
import type { PlacementResizeState } from "../ui/canvas/types";

describe("canvasGeometry", () => {
  it("calculates southeast placement resize without moving the fixed origin", () => {
    const resizeState: PlacementResizeState = {
      placementId: "placement_1",
      handle: "se",
      fixedPoint: { x: 10, y: 20 },
      baseSize: { width: 100, height: 50 }
    };

    expect(calculatePlacementResizeUpdate(resizeState, { x: 160, y: 60 }))
      .toEqual({
        x: 10,
        y: 20,
        scale: 1.5
      });
  });

  it("calculates northwest placement resize from the opposite fixed point", () => {
    const resizeState: PlacementResizeState = {
      placementId: "placement_1",
      handle: "nw",
      fixedPoint: { x: 160, y: 70 },
      baseSize: { width: 100, height: 50 }
    };

    expect(calculatePlacementResizeUpdate(resizeState, { x: 10, y: 20 }))
      .toEqual({
        x: 10,
        y: -5,
        scale: 1.5
      });
  });

  it("calculates snapped placement rotation from pointer movement", () => {
    expect(normalizeRotation(-15)).toBe(345);
    expect(snapPlacementRotation(176)).toBe(180);
    expect(snapPlacementRotation(83)).toBe(83);

    const center = { x: 50, y: 50 };
    const rotationState = {
      placementId: "placement_1",
      center,
      startPointerAngle: getRotationAngleFromPointer(center, { x: 50, y: 20 }),
      startRotation: 0
    };

    expect(
      calculatePlacementRotationUpdate(rotationState, { x: 80, y: 50 })
    ).toEqual({ rotation: 90 });
  });

  it("rotates anchor points around the placement center", () => {
    expect(
      getAnchorWorldPoint(
        {
          id: "placement_1",
          symbolId: "symbol_1",
          versionId: "version_1",
          role: "device",
          tag: "TT-101",
          x: 10,
          y: 20,
          rotation: 90,
          scale: 1
        },
        {
          symbolKey: "test_symbol",
          displayName: "Test Symbol",
          category: "instrument",
          viewBox: { x: 0, y: 0, width: 100, height: 50 },
          anchors: [{ key: "A1", x: 100, y: 25, kind: "terminal" }],
          terminals: []
        },
        { key: "A1", x: 100, y: 25, kind: "terminal" }
      )
    ).toEqual({ x: 60, y: 95 });
  });
});
