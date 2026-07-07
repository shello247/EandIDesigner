import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingSheetCanvasModel
} from "../data/schema";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import {
  addAnnotation,
  deleteAnnotation,
  deletePlacement,
  moveAnnotation,
  movePlacement,
  updateAnnotation,
  updateConnectionLabel,
  updateConnectionRoute
} from "../logic/commands/drawing-model-commands";

function modelWithPlacementsAndConnections(): DrawingSheetCanvasModel {
  return {
    ...toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1"),
    placements: [
      {
        id: "device_1",
        symbolId: "sym_1",
        versionId: "ver_1",
        role: "device",
        tag: "TT-101",
        x: 10,
        y: 20,
        rotation: 0,
        scale: 1
      },
      {
        id: "cable_1",
        symbolId: "sym_2",
        versionId: "ver_2",
        role: "cable_assembly",
        tag: "C-101",
        x: 100,
        y: 120,
        rotation: 0,
        scale: 0.5
      }
    ],
    connections: [
      {
        id: "connection_1",
        from: { placementId: "device_1", anchorKey: "1" },
        to: { placementId: "cable_1", anchorKey: "CH1_T1" },
        cablePlacementId: "cable_1",
        conductorKey: "CH1_T1",
        wireId: "C-101-WHT"
      }
    ]
  };
}

describe("drawing model commands", () => {
  it("moves only the targeted placement", () => {
    const model = modelWithPlacementsAndConnections();
    const next = movePlacement(model, "device_1", { x: 42.5, y: 84.25 });

    expect(next).not.toBe(model);
    expect(next.placements[0]).toMatchObject({ x: 42.5, y: 84.25 });
    expect(next.placements[1]).toEqual(model.placements[1]);
  });

  it("deletes a placement and removes related connections", () => {
    const model = modelWithPlacementsAndConnections();
    const next = deletePlacement(model, "cable_1");

    expect(next.placements.map((placement) => placement.id)).toEqual([
      "device_1"
    ]);
    expect(next.connections).toHaveLength(0);
  });

  it("updates a connection route without changing the connection id", () => {
    const model = modelWithPlacementsAndConnections();
    const route = {
      mode: "manual" as const,
      style: "orthogonal" as const,
      points: [
        { id: "start", kind: "endpoint" as const, x: 1, y: 2 },
        { id: "end", kind: "endpoint" as const, x: 3, y: 4 }
      ]
    };
    const next = updateConnectionRoute(model, "connection_1", route);

    expect(next.connections[0].id).toBe("connection_1");
    expect(next.connections[0].route).toEqual(route);
  });

  it("updates a connection label while preserving route data", () => {
    const model = modelWithPlacementsAndConnections();
    const route = {
      mode: "manual" as const,
      style: "orthogonal" as const,
      points: [
        { id: "start", kind: "endpoint" as const, x: 1, y: 2 },
        { id: "end", kind: "endpoint" as const, x: 3, y: 4 }
      ],
      labelPosition: { x: 9, y: 10 }
    };
    const routed = updateConnectionRoute(model, "connection_1", route);
    const next = updateConnectionLabel(routed, "connection_1", "White");

    expect(next.connections[0]).toMatchObject({
      id: "connection_1",
      label: "White",
      route
    });
  });

  it("adds, moves, updates, and deletes annotations", () => {
    const model = modelWithPlacementsAndConnections();
    const withAnnotation = addAnnotation(model, {
      id: "note_1",
      text: "Install seal fitting",
      x: 20,
      y: 30,
      width: 70,
      height: 24,
      kind: "note",
      leader: {
        enabled: true,
        targetX: 110,
        targetY: 55
      }
    });

    expect(withAnnotation.annotations).toHaveLength(1);

    const moved = moveAnnotation(withAnnotation, "note_1", { x: 25, y: 36 });
    expect(moved.annotations[0]).toMatchObject({
      x: 25,
      y: 36,
      leader: {
        enabled: true,
        targetX: 110,
        targetY: 55
      }
    });

    const updated = updateAnnotation(moved, "note_1", { text: "Updated note" });
    expect(updated.annotations[0].text).toBe("Updated note");

    const removed = deleteAnnotation(updated, "note_1");
    expect(removed.annotations).toHaveLength(0);
  });
});
