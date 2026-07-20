import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingPlacement,
  type DrawingSheetCanvasModel
} from "../data/schema";
import {
  buildLayoutDimensionAttachmentTargets,
  buildLayoutDimensionSnapTargets,
  getLayoutItemPhysicalBounds,
  resolveDimensionSnapToleranceMm,
  resolveLayoutDimensionAttachmentSnap,
  resolveLayoutDimensionSnap
} from "../logic/services/drawing-dimension-snapping";
import {
  createLayoutDimensionPlacement,
  moveLayoutDimensionByDisplayDelta,
  resolveLayoutDimensionPhysicalGeometry,
  resolveLayoutDimensionPointerUpdate,
  updateLayoutDimensionPlacement
} from "../logic/services/drawing-layout-dimensions";
import { moveCanvasSelection } from "../logic/services/drawing-movement";

function placement(
  updates: Partial<DrawingPlacement> & Pick<DrawingPlacement, "id">
): DrawingPlacement {
  return {
    id: updates.id,
    symbolId: "layout_symbol",
    versionId: "layout_symbol_v1",
    role: "other",
    tag: updates.id,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    ...updates
  };
}

function fixture() {
  const packageModel = createDefaultDrawingModel();
  const sheet: DrawingSheetCanvasModel["sheet"] = {
    ...packageModel.sheets[0].page,
    titleBlock: packageModel.titleBlock
  };
  const backplane = placement({
    id: "backplane_1",
    symbolId: "__generated_backplane__",
    versionId: "generated_backplane_v1",
    layoutKind: "backplane",
    x: 20,
    y: 22,
    layoutDimensions: {
      lengthMm: 250,
      widthMm: 250
    }
  });
  const rail = placement({
    id: "rail_1",
    layoutKind: "layout_helper",
    layoutParentId: backplane.id,
    layoutPosition: { xMm: 20, yMm: 30 },
    layoutDimensions: { lengthMm: 100, widthMm: 20 }
  });
  const rotatedTray = placement({
    id: "tray_1",
    layoutKind: "layout_helper",
    layoutParentId: backplane.id,
    layoutPosition: { xMm: 140, yMm: 60 },
    layoutDimensions: { lengthMm: 80, widthMm: 20 },
    rotation: 90
  });
  const otherBackplaneItem = placement({
    id: "other_item",
    layoutKind: "layout_helper",
    layoutParentId: "backplane_2",
    layoutPosition: { xMm: 200, yMm: 200 },
    layoutDimensions: { lengthMm: 20, widthMm: 20 }
  });
  const model: DrawingSheetCanvasModel = {
    sheet,
    placements: [backplane, rail, rotatedTray, otherBackplaneItem],
    connections: [],
    annotations: []
  };

  return { sheet, backplane, rail, rotatedTray, model };
}

describe("drawing dimension snapping", () => {
  it("builds backplane, usable, and same-backplane item edge targets", () => {
    const { model, backplane } = fixture();
    const targets = buildLayoutDimensionSnapTargets({
      model,
      backplane,
      orientation: "horizontal"
    });
    const values = targets.map((target) => target.valueMm);

    expect(values).toEqual(expect.arrayContaining([0, 3, 20, 120, 247, 250]));
    expect(targets.some((target) => target.sourcePlacementId === "other_item"))
      .toBe(false);
  });

  it("resolves orthogonally rotated physical item bounds", () => {
    const { sheet, backplane, rotatedTray } = fixture();

    expect(
      getLayoutItemPhysicalBounds({
        sheet,
        placement: rotatedTray,
        backplane
      })
    ).toMatchObject({
      x: 170,
      y: 30,
      width: 20,
      height: 80
    });
  });

  it("chooses the nearest edge inside tolerance and ignores distant edges", () => {
    const targets = [
      {
        axis: "x" as const,
        valueMm: 20,
        kind: "item-edge" as const,
        label: "Rail edge"
      },
      {
        axis: "x" as const,
        valueMm: 40,
        kind: "usable-edge" as const,
        label: "Usable edge"
      }
    ];

    expect(
      resolveLayoutDimensionSnap({
        axis: "x",
        valueMm: 22,
        targets,
        toleranceMm: 3
      })
    ).toMatchObject({ valueMm: 20, target: targets[0] });
    expect(
      resolveLayoutDimensionSnap({
        axis: "x",
        valueMm: 30,
        targets,
        toleranceMm: 3
      })
    ).toEqual({ valueMm: 30 });
  });

  it("projects witness points onto layout edges and records an attachment", () => {
    const { model, backplane } = fixture();
    const targets = buildLayoutDimensionAttachmentTargets({
      model,
      backplane
    });
    const resolution = resolveLayoutDimensionAttachmentSnap({
      pointMm: { x: 19.2, y: 31 },
      targets,
      toleranceMm: 3
    });

    expect(resolution.pointMm).toEqual({ x: 20, y: 31 });
    expect(resolution.target).toMatchObject({
      kind: "item-edge",
      sourcePlacementId: "rail_1",
      edge: "left"
    });
    expect(resolution.reference).toMatchObject({
      targetKind: "placement",
      placementId: "rail_1",
      edge: "left",
      ratio: 0.05
    });
  });

  it("converts the nominal screen tolerance to bounded physical millimetres", () => {
    const { sheet, backplane } = fixture();

    expect(
      resolveDimensionSnapToleranceMm({
        sheet,
        backplane,
        screenScale: 2
      })
    ).toBe(8);
    expect(
      resolveDimensionSnapToleranceMm({
        sheet,
        backplane,
        screenScale: 0.05
      })
    ).toBe(10);
  });

  it("snaps endpoint updates, clamps crossing, and leaves offset unsnapped", () => {
    const { sheet, backplane, model } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_1"
    });
    const targets = buildLayoutDimensionSnapTargets({
      model: {
        ...model,
        placements: [...model.placements, dimension]
      },
      backplane,
      orientation: "horizontal",
      excludePlacementId: dimension.id
    });
    const snapped = resolveLayoutDimensionPointerUpdate({
      placement: dimension,
      backplane,
      sheet,
      handle: "dimension-start",
      pointer: { x: backplane.x + 11, y: dimension.y },
      snapTargets: targets,
      snapToleranceMm: 3
    });
    const crossed = resolveLayoutDimensionPointerUpdate({
      placement: snapped.placement,
      backplane,
      sheet,
      handle: "dimension-start",
      pointer: { x: backplane.x + 500, y: dimension.y }
    });
    const offset = resolveLayoutDimensionPointerUpdate({
      placement: crossed.placement,
      backplane,
      sheet,
      handle: "dimension-offset",
      pointer: { x: dimension.x, y: backplane.y + 15.4 }
    });

    expect(snapped.placement.layoutDimension?.startMm).toBe(20);
    expect(snapped.snapTarget?.sourcePlacementId).toBe("rail_1");
    expect(crossed.placement.layoutDimension?.startMm).toBe(
      crossed.placement.layoutDimension!.endMm - 1
    );
    expect(offset.placement.layoutDimension?.offsetMm).toBe(31);
  });

  it("keeps attached witness points associated when the measured item moves", () => {
    const { sheet, backplane, rail, model } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_attached"
    });
    const modelWithDimension = {
      ...model,
      placements: [...model.placements, dimension]
    };
    const targets = buildLayoutDimensionAttachmentTargets({
      model: modelWithDimension,
      backplane,
      excludePlacementId: dimension.id
    });
    const attached = resolveLayoutDimensionPointerUpdate({
      model: modelWithDimension,
      placement: dimension,
      backplane,
      sheet,
      handle: "dimension-start",
      pointer: {
        x: backplane.x + 10,
        y: backplane.y + 15
      },
      attachmentTargets: targets,
      snapToleranceMm: 3
    }).placement;
    const movedModel = moveCanvasSelection({
      model: {
        ...modelWithDimension,
        placements: modelWithDimension.placements.map((candidate) =>
          candidate.id === attached.id ? attached : candidate
        )
      },
      selection: { placementIds: [rail.id], annotationIds: [] },
      delta: { x: 5, y: 5 },
      symbols: []
    });
    const movedBackplane = movedModel.placements.find(
      (candidate) => candidate.id === backplane.id
    )!;
    const movedDimension = movedModel.placements.find(
      (candidate) => candidate.id === attached.id
    )!;
    const resolved = resolveLayoutDimensionPhysicalGeometry({
      model: movedModel,
      placement: movedDimension,
      backplane: movedBackplane
    });

    expect(attached.layoutDimension?.startAttachment).toMatchObject({
      targetKind: "placement",
      placementId: rail.id,
      edge: "top"
    });
    expect(resolved).toMatchObject({
      startMm: 30,
      startWitnessMm: 40
    });
  });

  it("moves the label independently along the dimension line", () => {
    const { sheet, backplane, model } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_label"
    });
    const updated = resolveLayoutDimensionPointerUpdate({
      model: { ...model, placements: [...model.placements, dimension] },
      placement: dimension,
      backplane,
      sheet,
      handle: "dimension-label",
      pointer: { x: backplane.x + 40, y: dimension.y }
    }).placement;

    expect(updated.layoutDimension?.labelPositionMm).toBe(80);
    expect(updated.layoutDimension?.startMm).toBe(
      dimension.layoutDimension?.startMm
    );
    expect(updated.layoutDimension?.endMm).toBe(
      dimension.layoutDimension?.endMm
    );
  });

  it("detaches only the endpoint edited numerically", () => {
    const { sheet, backplane } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_numeric"
    });
    const attached = {
      ...dimension,
      layoutDimension: {
        ...dimension.layoutDimension!,
        startAttachment: {
          targetKind: "placement" as const,
          placementId: "rail_1",
          edge: "left" as const,
          ratio: 0
        },
        endAttachment: {
          targetKind: "placement" as const,
          placementId: "rail_1",
          edge: "right" as const,
          ratio: 0
        }
      }
    };
    const updated = updateLayoutDimensionPlacement({
      placement: attached,
      backplane,
      sheet,
      updates: { startMm: 25 }
    });

    expect(updated.layoutDimension?.startAttachment).toBeUndefined();
    expect(updated.layoutDimension?.endAttachment).toEqual(
      attached.layoutDimension.endAttachment
    );
  });

  it("translates the complete dimension while preserving its measured span", () => {
    const { sheet, backplane } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_1"
    });
    const movableDimension = {
      ...dimension,
      layoutDimension: {
        ...dimension.layoutDimension!,
        startMm: 20,
        endMm: 100,
        offsetMm: 20
      }
    };
    const before = movableDimension.layoutDimension;
    const moved = moveLayoutDimensionByDisplayDelta({
      placement: movableDimension,
      backplane,
      sheet,
      delta: { x: 5, y: 4 }
    });
    const after = moved.layoutDimension!;

    expect(after.endMm - after.startMm).toBe(before.endMm - before.startMm);
    expect(after.startMm).toBe(before.startMm + 10);
    expect(after.endMm).toBe(before.endMm + 10);
    expect(after.offsetMm).toBe(before.offsetMm + 8);
  });

  it("uses synchronized dimension movement through the canvas selection path", () => {
    const { sheet, backplane } = fixture();
    const dimension = createLayoutDimensionPlacement({
      backplane,
      sheet,
      orientation: "horizontal",
      id: "dimension_1"
    });
    const movableDimension = {
      ...dimension,
      layoutDimension: {
        ...dimension.layoutDimension!,
        startMm: 20,
        endMm: 100,
        offsetMm: 20
      }
    };
    const movedModel = moveCanvasSelection({
      model: {
        sheet,
        placements: [backplane, movableDimension],
        connections: [],
        annotations: []
      },
      selection: {
        placementIds: [movableDimension.id],
        annotationIds: []
      },
      delta: { x: 5, y: 4 },
      symbols: []
    });
    const movedDimension = movedModel.placements.find(
      (candidate) => candidate.id === movableDimension.id
    )!;

    expect(movedDimension.layoutDimension).toMatchObject({
      startMm: 30,
      endMm: 110,
      offsetMm: 28
    });
  });
});
