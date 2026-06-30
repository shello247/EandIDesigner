import { describe, expect, it } from "vitest";
import { calculatePlacementResizeUpdate } from "../ui/canvas/utils/canvasGeometry";
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
});
