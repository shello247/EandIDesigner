import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, type DrawingModel } from "../data/schema";
import {
  deletePlacement,
  movePlacement,
  updateConnectionLabel,
  updateConnectionRoute
} from "../logic/commands/drawing-model-commands";

function modelWithPlacementsAndConnections(): DrawingModel {
  return {
    ...createDefaultDrawingModel(),
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
});
