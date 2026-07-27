import { describe, expect, it } from "vitest";
import { getAnchorWorldPoint } from "../logic/services/drawing-geometry";
import {
  calculatePlacementLengthResizeUpdate,
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

  it("resizes a horizontal tray from its end without changing its width", () => {
    const resizeState: PlacementResizeState = {
      placementId: "tray_1",
      handle: "length-end",
      fixedPoint: { x: 10, y: 30 },
      baseSize: { width: 100, height: 20 },
      center: { x: 60, y: 30 },
      rotation: 0
    };

    expect(
      calculatePlacementLengthResizeUpdate(resizeState, { x: 150, y: 75 })
    ).toEqual({
      x: 10,
      y: 20,
      layoutDimensions: {
        lengthMm: 140,
        widthMm: 20
      }
    });
  });

  it("keeps the opposite endpoint fixed when resizing a rotated tray", () => {
    const resizeState: PlacementResizeState = {
      placementId: "tray_1",
      handle: "length-start",
      fixedPoint: { x: 60, y: 80 },
      baseSize: { width: 100, height: 20 },
      center: { x: 60, y: 30 },
      rotation: 90
    };

    expect(
      calculatePlacementLengthResizeUpdate(resizeState, { x: 60, y: -40 })
    ).toEqual({
      x: 0,
      y: 10,
      layoutDimensions: {
        lengthMm: 120,
        widthMm: 20
      }
    });
  });

  it("enforces the minimum tray length without changing its width", () => {
    const resizeState: PlacementResizeState = {
      placementId: "tray_1",
      handle: "length-end",
      fixedPoint: { x: 10, y: 30 },
      baseSize: { width: 100, height: 20 },
      center: { x: 60, y: 30 },
      rotation: 0
    };

    expect(
      calculatePlacementLengthResizeUpdate(resizeState, { x: 5, y: 30 })
    ).toEqual({
      x: 10,
      y: 20,
      layoutDimensions: {
        lengthMm: 5,
        widthMm: 20
      }
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
