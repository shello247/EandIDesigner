import { describe, expect, it } from "vitest";
import {
  clientPointToNetworkSheetPoint,
  networkNodeOriginFromCenter,
  normalizeNetworkNodeRotation,
  rotateNetworkPoint
} from "../logic/services/network-node-geometry";

describe("network node geometry", () => {
  it.each([0.35, 1, 1.75])(
    "converts client points to sheet coordinates at %s zoom",
    (zoom) => {
      const point = clientPointToNetworkSheetPoint({
        clientX: 40 + 420 * zoom * 0.5,
        clientY: 60 + 297 * zoom * 0.25,
        bounds: {
          left: 40,
          top: 60,
          width: 420 * zoom,
          height: 297 * zoom
        },
        page: { width: 420, height: 297 }
      });

      expect(point).toEqual({ x: 210, y: 74.25 });
    }
  );

  it("centers, snaps, and clamps a placement inside the sheet", () => {
    expect(
      networkNodeOriginFromCenter({
        center: { x: 210, y: 150 },
        size: { width: 49, height: 28.7 },
        page: { size: "A3_LANDSCAPE", width: 420, height: 297, gridSize: 10 }
      })
    ).toEqual({ x: 190, y: 140 });
  });

  it("normalizes rotation and rotates points around the node center", () => {
    expect(normalizeNetworkNodeRotation(-90)).toBe(270);
    expect(rotateNetworkPoint({ x: 20, y: 10 }, { x: 10, y: 10 }, 90)).toEqual(
      { x: 10, y: 20 }
    );
  });
});
