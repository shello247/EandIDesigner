import { describe, expect, it } from "vitest";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../data/schema";
import {
  GENERATED_BACKPLANE_SYMBOL_ID,
  GENERATED_BACKPLANE_VERSION_ID
} from "../logic/services/drawing-backplane-layouts";
import { getRotatedPlacementBounds } from "../logic/services/drawing-geometry";
import {
  applyPlacementArrangement,
  resolvePlacementArrangement,
  type PlacementArrangementAction
} from "../logic/services/drawing-selection-arrangement";
import type { ApprovedDrawingSymbol } from "../types";

const sheet: DrawingSheetCanvasModel["sheet"] = {
  size: "A3_LANDSCAPE",
  width: 240,
  height: 160,
  gridSize: 10,
  titleBlock: { revision: "A", date: "2026-08-10" }
};

const metadata: SymbolMetadata = {
  symbolKey: "arrangement_fixture",
  displayName: "Arrangement Fixture",
  category: "other",
  viewBox: { x: 0, y: 0, width: 20, height: 10 },
  anchors: [],
  terminals: []
};

const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_arrangement_fixture",
  symbolKey: metadata.symbolKey,
  displayName: metadata.displayName,
  category: "other",
  versionId: "version_arrangement_fixture",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10"/></svg>',
  metadata
};

function placement(
  id: string,
  x: number,
  y: number,
  changes: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id,
    assetId: `asset_${id}`,
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: "device",
    tag: id.toUpperCase(),
    x,
    y,
    rotation: 0,
    scale: 1,
    ...changes
  };
}

function model(
  placements: DrawingPlacement[],
  changes: Partial<DrawingSheetCanvasModel> = {}
): DrawingSheetCanvasModel {
  return {
    sheet,
    placements,
    connections: [],
    annotations: [],
    ...changes
  };
}

function deltasFor(
  source: DrawingSheetCanvasModel,
  placementIds: string[],
  action: PlacementArrangementAction
) {
  const result = resolvePlacementArrangement({
    model: source,
    symbols: [symbol],
    placementIds,
    action
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }

  return Object.fromEntries(
    result.deltas.map((delta) => [delta.placementId, delta])
  );
}

describe("drawing selection arrangement", () => {
  it.each([
    ["align_left", { a: { placementId: "a", x: 0, y: 0 }, b: { placementId: "b", x: -40, y: 0 } }],
    ["align_center", { a: { placementId: "a", x: 20, y: 0 }, b: { placementId: "b", x: -20, y: 0 } }],
    ["align_right", { a: { placementId: "a", x: 40, y: 0 }, b: { placementId: "b", x: 0, y: 0 } }],
    ["align_top", { a: { placementId: "a", x: 0, y: 0 }, b: { placementId: "b", x: 0, y: -30 } }],
    ["align_middle", { a: { placementId: "a", x: 0, y: 15 }, b: { placementId: "b", x: 0, y: -15 } }],
    ["align_bottom", { a: { placementId: "a", x: 0, y: 30 }, b: { placementId: "b", x: 0, y: 0 } }]
  ] as const)("resolves %s against the selection envelope", (action, expected) => {
    const source = model([placement("a", 10, 20), placement("b", 50, 50)]);

    expect(deltasFor(source, ["b", "a"], action)).toEqual(expected);
  });

  it("distributes unequal widths using equal visible horizontal gaps", () => {
    const source = model([
      placement("a", 10, 20),
      placement("b", 50, 20, { scale: 2 }),
      placement("c", 120, 20)
    ]);

    const deltas = deltasFor(source, ["c", "a", "b"], "distribute_horizontal");

    expect(deltas).toEqual({
      a: { placementId: "a", x: 0, y: 0 },
      b: { placementId: "b", x: 5, y: 0 },
      c: { placementId: "c", x: 0, y: 0 }
    });
  });

  it("distributes unequal heights vertically and keeps the outer items fixed", () => {
    const source = model([
      placement("a", 20, 10),
      placement("b", 20, 40, { scale: 2 }),
      placement("c", 20, 100)
    ]);

    const deltas = deltasFor(source, ["a", "b", "c"], "distribute_vertical");

    expect(deltas.a).toEqual({ placementId: "a", x: 0, y: 0 });
    expect(deltas.b).toEqual({ placementId: "b", x: 0, y: 10 });
    expect(deltas.c).toEqual({ placementId: "c", x: 0, y: 0 });
  });

  it("uses rotated rendered bounds without changing the rotation", () => {
    const rotated = placement("rotated", 70, 40, { rotation: 90 });
    const source = model([placement("fixed", 20, 20), rotated]);
    const before = getRotatedPlacementBounds(rotated, symbol.metadata);
    const result = resolvePlacementArrangement({
      model: source,
      symbols: [symbol],
      placementIds: ["fixed", "rotated"],
      action: "align_top"
    });

    expect(before).toMatchObject({ x: 75, y: 35, width: 10, height: 20 });
    expect(result).toEqual({
      ok: true,
      deltas: [
        { placementId: "fixed", x: 0, y: 0 },
        { placementId: "rotated", x: 0, y: -15 }
      ]
    });

    if (!result.ok) throw new Error(result.message);
    const updated = applyPlacementArrangement({ model: source, deltas: result.deltas });
    expect(updated.placements[1].rotation).toBe(90);
  });

  it("rejects distribution when the selection span cannot avoid overlap", () => {
    const result = resolvePlacementArrangement({
      model: model([
        placement("a", 10, 20, { scale: 2 }),
        placement("b", 25, 20, { scale: 2 }),
        placement("c", 40, 20, { scale: 2 })
      ]),
      symbols: [symbol],
      placementIds: ["a", "b", "c"],
      action: "distribute_horizontal"
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "insufficient_distribution_span"
    });
  });

  it("rejects unsupported and mixed-coordinate selections", () => {
    const unsupported = placement("unsupported", 20, 20, { assetId: undefined });
    expect(
      resolvePlacementArrangement({
        model: model([placement("a", 10, 10), unsupported]),
        symbols: [symbol],
        placementIds: ["a", "unsupported"],
        action: "align_left"
      })
    ).toMatchObject({
      ok: false,
      reason: "unsupported_selection",
      message: "Deselect unsupported items before arranging: UNSUPPORTED."
    });

    expect(
      resolvePlacementArrangement({
        model: model([
          placement("a", 10, 10),
          placement("b", 40, 10, {
            layoutKind: "layout_helper",
            layoutParentId: "backplane"
          })
        ]),
        symbols: [symbol],
        placementIds: ["a", "b"],
        action: "align_left"
      })
    ).toMatchObject({ ok: false, reason: "mixed_coordinate_context" });
  });

  it("updates physical layoutPosition for equipment on one backplane", () => {
    const backplane: DrawingPlacement = {
      id: "backplane",
      symbolId: GENERATED_BACKPLANE_SYMBOL_ID,
      versionId: GENERATED_BACKPLANE_VERSION_ID,
      role: "other",
      tag: "BP-1",
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      layoutKind: "backplane",
      layoutScale: { mode: "manual", value: 1 },
      layoutDimensions: { lengthMm: 200, widthMm: 120 }
    };
    const first = placement("a", 20, 25, {
      layoutKind: "layout_helper",
      layoutParentId: backplane.id,
      layoutPosition: { xMm: 20, yMm: 25 },
      layoutDimensions: { lengthMm: 20, widthMm: 10 }
    });
    const second = placement("b", 60, 45, {
      layoutKind: "layout_helper",
      layoutParentId: backplane.id,
      layoutPosition: { xMm: 60, yMm: 45 },
      layoutDimensions: { lengthMm: 20, widthMm: 10 }
    });
    const source = model([backplane, first, second]);
    const result = resolvePlacementArrangement({
      model: source,
      symbols: [symbol],
      placementIds: [first.id, second.id],
      action: "align_top"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const updated = applyPlacementArrangement({ model: source, deltas: result.deltas });
    const updatedSecond = updated.placements.find(
      (candidate) => candidate.id === second.id
    );

    expect(updatedSecond).toMatchObject({
      x: 60,
      y: 25,
      layoutPosition: { xMm: 60, yMm: 25 }
    });
  });

  it("rejects arrangements that leave the usable backplane area", () => {
    const backplane: DrawingPlacement = {
      id: "backplane",
      symbolId: GENERATED_BACKPLANE_SYMBOL_ID,
      versionId: GENERATED_BACKPLANE_VERSION_ID,
      role: "other",
      tag: "BP-1",
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      layoutKind: "backplane",
      layoutScale: { mode: "manual", value: 1 },
      layoutDimensions: { lengthMm: 100, widthMm: 80 }
    };
    const source = model([
      backplane,
      placement("a", 3, 3, {
        layoutKind: "layout_helper",
        layoutParentId: backplane.id,
        layoutPosition: { xMm: 3, yMm: 3 },
        layoutDimensions: { lengthMm: 20, widthMm: 10 }
      }),
      placement("b", 30, 72, {
        layoutKind: "layout_helper",
        layoutParentId: backplane.id,
        layoutPosition: { xMm: 30, yMm: 72 },
        layoutDimensions: { lengthMm: 20, widthMm: 10 }
      })
    ]);

    expect(
      resolvePlacementArrangement({
        model: source,
        symbols: [symbol],
        placementIds: ["a", "b"],
        action: "align_bottom"
      })
    ).toMatchObject({ ok: false, reason: "containment_violation" });
  });

  it("moves custom labels and only moves routes when every participant shares a delta", () => {
    const first = placement("a", 20, 20, {
      labelPosition: { x: 18, y: 12 },
      deviceTitlePosition: { x: 17, y: 11 }
    });
    const second = placement("b", 60, 20);
    const source = model([first, second], {
      connections: [
        {
          id: "connection_1",
          wireId: "W-001",
          from: { placementId: first.id, anchorKey: "T1" },
          to: { placementId: second.id, anchorKey: "T2" },
          route: {
            mode: "manual",
            style: "orthogonal",
            points: [
              { id: "from", kind: "endpoint", x: 20, y: 20 },
              { id: "control", kind: "control", x: 40, y: 30 },
              { id: "to", kind: "endpoint", x: 60, y: 20 }
            ],
            labelPosition: { x: 40, y: 24 }
          }
        }
      ]
    });

    const movedTogether = applyPlacementArrangement({
      model: source,
      deltas: [
        { placementId: first.id, x: 5, y: 7 },
        { placementId: second.id, x: 5, y: 7 }
      ]
    });
    expect(movedTogether.placements[0].labelPosition).toEqual({ x: 23, y: 19 });
    expect(movedTogether.placements[0].deviceTitlePosition).toEqual({
      x: 22,
      y: 18
    });
    expect(movedTogether.connections[0].route?.points[1]).toMatchObject({
      x: 45,
      y: 37
    });
    expect(movedTogether.connections[0].route?.labelPosition).toEqual({
      x: 45,
      y: 31
    });

    const movedDifferently = applyPlacementArrangement({
      model: source,
      deltas: [
        { placementId: first.id, x: 5, y: 0 },
        { placementId: second.id, x: -5, y: 0 }
      ]
    });
    expect(movedDifferently.connections[0].route).toEqual(
      source.connections[0].route
    );
  });

  it("returns the original model for a no-op arrangement", () => {
    const source = model([placement("a", 10, 20), placement("b", 10, 50)]);
    const result = resolvePlacementArrangement({
      model: source,
      symbols: [symbol],
      placementIds: ["a", "b"],
      action: "align_left"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(applyPlacementArrangement({ model: source, deltas: result.deltas })).toBe(
      source
    );
  });
});
