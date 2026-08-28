import { describe, expect, it } from "vitest";
import type {
  DrawingConnection,
  DrawingEndpoint,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import {
  addGuidedConnectionWaypoint,
  buildGuidedConnectionPreview,
  buildGuidedConnectionRoute,
  removeLastGuidedConnectionWaypoint,
  resolveGuidedConnectionPointer,
  type GuidedConnectionWaypoint
} from "../logic/services/guided-connection-routing";

function symbol(input: {
  id: string;
  anchorKey: string;
  x: number;
  y: number;
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.id,
    symbolKey: input.id,
    displayName: input.id,
    category: "other",
    versionId: `${input.id}_v1`,
    versionNumber: 1,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"/>',
    metadata: {
      symbolKey: input.id,
      displayName: input.id,
      category: "other",
      viewBox: { x: 0, y: 0, width: 20, height: 20 },
      anchors: [
        {
          key: input.anchorKey,
          x: input.x,
          y: input.y,
          kind: "terminal"
        }
      ],
      terminals: [
        {
          key: input.anchorKey,
          label: input.anchorKey,
          anchorKey: input.anchorKey,
          requiredForWiring: true
        }
      ]
    }
  };
}

const sourceSymbol = symbol({
  id: "source_symbol",
  anchorKey: "OUT",
  x: 10,
  y: 20
});
const destinationSymbol = symbol({
  id: "destination_symbol",
  anchorKey: "IN",
  x: 0,
  y: 10
});
const symbols = [sourceSymbol, destinationSymbol];

const sourcePlacement: DrawingPlacement = {
  id: "source_placement",
  symbolId: sourceSymbol.symbolId,
  versionId: sourceSymbol.versionId,
  role: "device",
  tag: "SOURCE",
  x: 40,
  y: 20,
  rotation: 0,
  scale: 1
};
const destinationPlacement: DrawingPlacement = {
  id: "destination_placement",
  symbolId: destinationSymbol.symbolId,
  versionId: destinationSymbol.versionId,
  role: "device",
  tag: "DESTINATION",
  x: 240,
  y: 150,
  rotation: 0,
  scale: 1
};
const from: DrawingEndpoint = {
  placementId: sourcePlacement.id,
  anchorKey: "OUT"
};
const to: DrawingEndpoint = {
  placementId: destinationPlacement.id,
  anchorKey: "IN"
};

function model(): DrawingSheetCanvasModel {
  return {
    sheet: {
      size: "A3_LANDSCAPE",
      width: 420,
      height: 297,
      gridSize: 10,
      titleBlock: {
        revision: "A",
        date: "2026-08-18"
      }
    },
    placements: [sourcePlacement, destinationPlacement],
    connections: [],
    annotations: []
  };
}

function connection(): DrawingConnection {
  return { id: "connection_1", from, to };
}

function assertOrthogonal(points: Array<{ x: number; y: number }>) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    expect(current.x === next.x || current.y === next.y).toBe(true);
  }
}

describe("guided connection routing", () => {
  it("previews an orthogonal route from the source terminal through the pointer", () => {
    const preview = buildGuidedConnectionPreview({
      model: model(),
      symbols,
      from,
      pointer: { x: 120, y: 90 },
      waypoints: []
    });

    expect(preview.warning).toBeUndefined();
    expect(preview.points[0]).toEqual({ x: 50, y: 40 });
    expect(preview.points[1]).toEqual({ x: 50, y: 52 });
    expect(preview.points.at(-1)).toEqual({ x: 120, y: 90 });
    assertOrthogonal(preview.points);
  });

  it("preserves multiple pass-through waypoints and terminal approach stubs", () => {
    const waypoints: GuidedConnectionWaypoint[] = [
      { id: "waypoint_1", x: 50, y: 100 },
      { id: "waypoint_2", x: 180, y: 100 }
    ];
    const route = buildGuidedConnectionRoute({
      model: model(),
      symbols,
      connection: connection(),
      waypoints
    });

    expect(route?.mode).toBe("manual");
    expect(route?.points[0]).toMatchObject({ x: 50, y: 40, kind: "endpoint" });
    expect(route?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 50, y: 52 }),
        expect.objectContaining({ x: 50, y: 100 }),
        expect.objectContaining({ x: 228, y: 160 }),
        expect.objectContaining({ x: 240, y: 160, kind: "endpoint" })
      ])
    );
    expect(route?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 50, y: 100 }),
        expect.objectContaining({ x: 228, y: 100 })
      ])
    );
    assertOrthogonal(route?.points ?? []);
  });

  it("uses the automatic orthogonal route when no waypoint was placed", () => {
    const route = buildGuidedConnectionRoute({
      model: model(),
      symbols,
      connection: connection(),
      waypoints: []
    });

    expect(route?.mode).toBe("auto");
    expect(route?.style).toBe("orthogonal");
    assertOrthogonal(route?.points ?? []);
  });

  it("uses identical preview and committed coordinates at a destination", () => {
    const waypoints = [{ id: "waypoint_1", x: 70, y: 120 }];
    const preview = buildGuidedConnectionPreview({
      model: model(),
      symbols,
      from,
      destination: to,
      waypoints
    });
    const route = buildGuidedConnectionRoute({
      model: model(),
      symbols,
      connection: connection(),
      waypoints
    });

    expect(preview.points).toEqual(
      route?.points.map(({ x, y }) => ({ x, y }))
    );
  });

  it("preserves the visible path when endpoints and waypoint traversal are reversed", () => {
    const waypoints = [
      { id: "waypoint_1", x: 70, y: 120 },
      { id: "waypoint_2", x: 190, y: 120 }
    ];
    const forward = buildGuidedConnectionRoute({
      model: model(),
      symbols,
      connection: connection(),
      waypoints
    });
    const reversedTraversal = (forward?.points ?? [])
      .slice(1, -1)
      .reverse()
      .map((point, index) => ({
        id: `reversed_${index}`,
        x: point.x,
        y: point.y
      }));
    const reversed = buildGuidedConnectionRoute({
      model: model(),
      symbols,
      connection: { id: "connection_reversed", from: to, to: from },
      waypoints: reversedTraversal
    });

    const forwardPoints = forward?.points.map(({ x, y }) => ({ x, y }));
    const reversedPoints = reversed?.points
      .map(({ x, y }) => ({ x, y }))
      .reverse();
    expect(reversedPoints).toEqual(forwardPoints);
  });

  it("fails closed when a waypoint is outside the printable sheet", () => {
    expect(
      buildGuidedConnectionRoute({
        model: model(),
        symbols,
        connection: connection(),
        waypoints: [{ id: "outside", x: 500, y: 100 }]
      })
    ).toBeNull();
  });

  it("snaps to anchor axes before existing route lanes and grid lines", () => {
    const current = model();
    current.connections = [
      {
        id: "existing",
        from,
        to,
        route: {
          mode: "manual",
          style: "orthogonal",
          points: [
            { id: "a", kind: "endpoint", x: 20, y: 100 },
            { id: "b", kind: "control", x: 220, y: 100 },
            { id: "c", kind: "endpoint", x: 220, y: 140 }
          ]
        }
      }
    ];
    const resolution = resolveGuidedConnectionPointer({
      model: current,
      symbols,
      from,
      waypoints: [],
      proposedPoint: { x: 54, y: 94 },
      pixelsPerUnit: { x: 1, y: 1 }
    });

    expect(resolution.point).toEqual({ x: 50, y: 100 });
    expect(resolution.alignmentFeedback.map((item) => item.sourceId)).toEqual([
      "source:x",
      "existing:0"
    ]);
  });

  it("holds a snap through the release threshold and supports Alt bypass", () => {
    const acquired = resolveGuidedConnectionPointer({
      model: model(),
      symbols,
      from,
      waypoints: [],
      proposedPoint: { x: 56, y: 84 },
      pixelsPerUnit: { x: 1, y: 1 }
    });
    const held = resolveGuidedConnectionPointer({
      model: model(),
      symbols,
      from,
      waypoints: [],
      proposedPoint: { x: 61, y: 84 },
      pixelsPerUnit: { x: 1, y: 1 },
      activeSnapState: acquired.snapState
    });
    const bypassed = resolveGuidedConnectionPointer({
      model: model(),
      symbols,
      from,
      waypoints: [],
      proposedPoint: { x: 56, y: 84 },
      pixelsPerUnit: { x: 1, y: 1 },
      bypassSnapping: true
    });

    expect(acquired.point.x).toBe(50);
    expect(held.point.x).toBe(50);
    expect(bypassed.point).toEqual({ x: 56, y: 84 });
    expect(bypassed.alignmentFeedback).toEqual([]);
  });

  it("adds, rejects near-duplicates, removes, and rejects outside waypoints", () => {
    const first = addGuidedConnectionWaypoint({
      waypoints: [],
      point: { x: 80.004, y: 90.006 },
      sheet: model().sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      id: "first"
    });
    const duplicate = addGuidedConnectionWaypoint({
      waypoints: first,
      point: { x: 82, y: 91 },
      sheet: model().sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      id: "duplicate"
    });
    const outside = addGuidedConnectionWaypoint({
      waypoints: first,
      point: { x: -1, y: 91 },
      sheet: model().sheet,
      pixelsPerUnit: { x: 1, y: 1 },
      id: "outside"
    });

    expect(first).toEqual([{ id: "first", x: 80, y: 90.01 }]);
    expect(duplicate).toBe(first);
    expect(outside).toBe(first);
    expect(removeLastGuidedConnectionWaypoint(first)).toEqual([]);
    expect(removeLastGuidedConnectionWaypoint([])).toEqual([]);
  });
});
