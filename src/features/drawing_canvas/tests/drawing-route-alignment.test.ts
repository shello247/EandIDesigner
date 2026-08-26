import { describe, expect, it } from "vitest";
import type { DrawingConnectionRoute } from "../data/schema";
import {
  buildEditableRouteSegments,
  insertRouteControlPointOnSegment,
  resolveRoutePointDrag,
  resolveRouteSegmentDrag
} from "../logic/services/connection-route-alignment";
import { routeToPathData } from "../logic/services/connection-route-renderer";

const sheet = { width: 200, height: 120 };

function route(): DrawingConnectionRoute {
  return {
    mode: "manual",
    style: "orthogonal",
    points: [
      { id: "from", kind: "endpoint", x: 10, y: 20 },
      { id: "p1", kind: "control", x: 40, y: 20 },
      { id: "p2", kind: "control", x: 40, y: 70 },
      { id: "p3", kind: "control", x: 120, y: 70 },
      { id: "to", kind: "endpoint", x: 160, y: 40 }
    ]
  };
}

describe("drawing route alignment", () => {
  it("maps direct and synthetic dogleg segments to persisted editable points", () => {
    const segments = buildEditableRouteSegments(route());

    expect(segments.map((segment) => segment.axis)).toEqual([
      "horizontal",
      "vertical",
      "horizontal",
      "horizontal",
      "vertical"
    ]);
    expect(segments.at(-2)).toMatchObject({
      axis: "horizontal",
      editablePointIds: ["p3"],
      sourcePairIndex: 3
    });
    expect(segments.at(-1)).toMatchObject({
      axis: "vertical",
      editablePointIds: [],
      sourcePairIndex: 3
    });
  });

  it.each([
    { pixelsPerUnit: 0.5, proposedY: 29.5 },
    { pixelsPerUnit: 1, proposedY: 24 },
    { pixelsPerUnit: 2, proposedY: 22 }
  ])(
    "uses a screen-space snapping threshold at $pixelsPerUnit pixels per unit",
    ({ pixelsPerUnit, proposedY }) => {
      const result = resolveRoutePointDrag({
        route: route(),
        pointId: "p1",
        proposedPoint: { x: 90, y: proposedY },
        startPoint: { x: 40, y: 20 },
        sheet,
        pixelsPerUnit: { x: pixelsPerUnit, y: pixelsPerUnit }
      });

      expect(result.route.points[1]).toMatchObject({ x: 90, y: 20 });
      expect(result.feedback.map((feedback) => feedback.axis)).toEqual(["y"]);
    }
  );

  it("holds an acquired snap until the release threshold is crossed", () => {
    const source = route();
    source.points[source.points.length - 1] = {
      ...source.points.at(-1)!,
      y: 100
    };
    const acquired = resolveRoutePointDrag({
      route: source,
      pointId: "p1",
      proposedPoint: { x: 70, y: 27 },
      startPoint: { x: 40, y: 20 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 }
    });
    const held = resolveRoutePointDrag({
      route: source,
      pointId: "p1",
      proposedPoint: { x: 70, y: 31 },
      startPoint: { x: 40, y: 20 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      activeSnapState: acquired.snapState
    });
    const released = resolveRoutePointDrag({
      route: source,
      pointId: "p1",
      proposedPoint: { x: 70, y: 33 },
      startPoint: { x: 40, y: 20 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      activeSnapState: acquired.snapState
    });

    expect(held.route.points[1].y).toBe(20);
    expect(released.route.points[1].y).toBe(33);
  });

  it("supports axis constraint and snapping bypass without changing point identity", () => {
    const constrained = resolveRoutePointDrag({
      route: route(),
      pointId: "p2",
      proposedPoint: { x: 72, y: 72 },
      startPoint: { x: 40, y: 70 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      axisLock: "x",
      bypassSnapping: true
    });

    expect(constrained.route.points[2]).toMatchObject({
      id: "p2",
      x: 72,
      y: 70
    });
    expect(constrained.route.points).toHaveLength(route().points.length);
    expect(constrained.feedback).toEqual([]);
  });

  it("does not snap both axes onto the same adjacent point", () => {
    const result = resolveRoutePointDrag({
      route: route(),
      pointId: "p2",
      proposedPoint: { x: 43, y: 23 },
      startPoint: { x: 40, y: 70 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 }
    });
    const moved = result.route.points[2];

    expect(moved.x === 40 && moved.y === 20).toBe(false);
    expect(result.feedback).toHaveLength(1);
  });

  it("moves a complete segment on one axis while preserving endpoints and point ids", () => {
    const source = route();
    const horizontal = buildEditableRouteSegments(source).find(
      (segment) =>
        segment.axis === "horizontal" &&
        segment.editablePointIds.includes("p2") &&
        segment.editablePointIds.includes("p3")
    );
    const result = resolveRouteSegmentDrag({
      route: source,
      segmentKey: horizontal!.key,
      delta: { x: 90, y: 18 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      bypassSnapping: true
    });

    expect(result.route.points.map((point) => point.id)).toEqual(
      source.points.map((point) => point.id)
    );
    expect(result.route.points[2].y).toBe(88);
    expect(result.route.points[3].y).toBe(88);
    expect(result.route.points[0]).toEqual(source.points[0]);
    expect(result.route.points.at(-1)).toEqual(source.points.at(-1));
  });

  it("moves the editable end of a terminal-adjacent segment and leaves the endpoint fixed", () => {
    const source = route();
    const terminalAdjacent = buildEditableRouteSegments(source)[0];
    const result = resolveRouteSegmentDrag({
      route: source,
      segmentKey: terminalAdjacent.key,
      delta: { x: 0, y: 15 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      bypassSnapping: true
    });

    expect(result.route.points[0]).toEqual(source.points[0]);
    expect(result.route.points[1]).toMatchObject({ id: "p1", x: 40, y: 35 });
    expect(result.route.points).toHaveLength(source.points.length);
  });

  it("does not move a synthetic segment with no editable backing point", () => {
    const source = route();
    const fixedSegment = buildEditableRouteSegments(source).find(
      (segment) => segment.editablePointIds.length === 0
    );
    const result = resolveRouteSegmentDrag({
      route: source,
      segmentKey: fixedSegment!.key,
      delta: { x: 10, y: 10 },
      sheet,
      pixelsPerUnit: { x: 1, y: 1 }
    });

    expect(result.route).toBe(source);
  });

  it("projects a new control point onto the clicked segment and inserts it in route order", () => {
    const source = route();
    const pathBefore = routeToPathData(source, 0);
    const result = insertRouteControlPointOnSegment({
      route: source,
      connectionId: "wire-1",
      point: { x: 88, y: 73 },
      pointId: "inserted",
      sheet
    });

    expect(result.points.map((point) => point.id)).toEqual([
      "from",
      "p1",
      "p2",
      "inserted",
      "p3",
      "to"
    ]);
    expect(result.points[3]).toMatchObject({ x: 88, y: 70, kind: "control" });
    expect(result.points).toHaveLength(source.points.length + 1);
    expect(routeToPathData(result, 0)).toBe(
      pathBefore.replace("L 120 70", "L 88 70 L 120 70")
    );
  });
});
