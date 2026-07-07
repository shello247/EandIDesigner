import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPlacement
} from "../data/schema";
import {
  assignPlacementToContainer,
  createPanelEnclosurePlacement,
  getPanelEnclosureBounds,
  getPanelEnclosureTitle,
  updatePanelEnclosureTitle
} from "../logic/services/drawing-asset-containment";
import {
  autosizeLayoutHelperToBackplane,
  createBackplanePlacement,
  getBackplaneUsableBounds
} from "../logic/services/drawing-backplane-layouts";
import { renameDrawingAssetTag } from "../logic/services/drawing-asset-identity";
import { moveCanvasSelection } from "../logic/services/drawing-movement";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import type { ApprovedDrawingSymbol } from "../types";

const breakerSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_mcb",
  symbolKey: "miniature_circuit_breaker_3_pole",
  displayName: "Miniature Circuit Breaker 3 Pole",
  model: "3 Pole",
  category: "terminal_block",
  versionId: "sym_mcb_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50"/></svg>',
  metadata: {
    symbolKey: "miniature_circuit_breaker_3_pole",
    displayName: "Miniature Circuit Breaker 3 Pole",
    model: "3 Pole",
    category: "terminal_block",
    viewBox: { x: 0, y: 0, width: 80, height: 50 },
    anchors: [{ key: "L1", x: 10, y: 0, kind: "terminal" }],
    terminals: []
  }
};

const dinRailSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_din_rail",
  symbolKey: "standard_th35_din_rail",
  displayName: "Standard TH35 DIN Rail",
  category: "terminal_block",
  versionId: "sym_din_rail_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 300 35" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="35"/></svg>',
  metadata: {
    symbolKey: "standard_th35_din_rail",
    displayName: "Standard TH35 DIN Rail",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    panelCategory: "rail",
    mountingType: "backplate",
    resizable: true,
    physicalWidthMm: 300,
    physicalHeightMm: 35,
    viewBox: { x: 0, y: 0, width: 300, height: 35 },
    anchors: [],
    terminals: []
  }
};

function breakerPlacement(overrides: Partial<DrawingPlacement> = {}): DrawingPlacement {
  return {
    id: "mcb_101",
    assetId: "asset_mcb_101",
    symbolId: breakerSymbol.symbolId,
    versionId: breakerSymbol.versionId,
    role: "device",
    tag: "MCB-101",
    x: 42,
    y: 52,
    rotation: 0,
    scale: 0.34,
    ...overrides
  };
}

function modelWithPanelAndBreaker(): DrawingModel {
  const model = createDefaultDrawingModel();
  const panel = createPanelEnclosurePlacement({
    model,
    activeSheet: model.sheets[0],
    assetId: "asset_pdp_101",
    tag: "PDP-101",
    x: 25,
    y: 30
  });
  const breaker = breakerPlacement({ containerAssetId: "asset_pdp_101" });

  return {
    ...model,
    sheets: [
      {
        ...model.sheets[0],
        placements: [panel, breaker],
        connections: [
          {
            id: "conn_1",
            from: { placementId: "mcb_101", anchorKey: "L1" },
            to: { placementId: "mcb_101", anchorKey: "L1" }
          }
        ]
      }
    ]
  };
}

describe("drawing asset containment", () => {
  it("accepts generated panel placements and child container references", () => {
    const model = modelWithPanelAndBreaker();
    const parsed = drawingPackageModelSchema.parse(model);

    expect(parsed.sheets[0].placements[0]).toMatchObject({
      role: "enclosure",
      tag: "PDP-101",
      enclosure: {
        kind: "power_distribution_panel"
      }
    });
    expect(parsed.sheets[0].placements[1].containerAssetId).toBe(
      "asset_pdp_101"
    );
  });

  it("allocates PDP tags across the package", () => {
    const first = createDefaultDrawingModel();
    const firstPanel = createPanelEnclosurePlacement({
      model: first,
      activeSheet: first.sheets[0]
    });
    const secondModel: DrawingModel = {
      ...first,
      sheets: [
        {
          ...first.sheets[0],
          placements: [firstPanel]
        }
      ]
    };
    const secondPanel = createPanelEnclosurePlacement({
      model: secondModel,
      activeSheet: secondModel.sheets[0]
    });

    expect(firstPanel.tag).toBe("PDP-101");
    expect(secondPanel.tag).toBe("PDP-102");
  });

  it("creates and renders editable panel titles", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_pdp_101",
      tag: "PDP-101",
      title: "Motor Control Center"
    });
    const canvas = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: [panel],
      connections: [],
      annotations: []
    };
    const svg = renderDrawingToSvg({
      model: canvas,
      approvedSymbols: []
    });

    expect(getPanelEnclosureTitle(panel)).toBe("Motor Control Center");
    expect(svg).toContain("PDP-101  MOTOR CONTROL CENTER");
  });

  it("assigns a breaker to a visible panel", () => {
    const model = modelWithPanelAndBreaker();
    const sheet = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: model.sheets[0].placements.map((placement) =>
        placement.id === "mcb_101"
          ? { ...placement, containerAssetId: undefined }
          : placement
      ),
      connections: [],
      annotations: []
    };
    const assigned = assignPlacementToContainer(
      sheet,
      "mcb_101",
      "asset_pdp_101"
    );

    expect(assigned.placements[1].containerAssetId).toBe("asset_pdp_101");
  });

  it("renames linked panel references across sheets", () => {
    const model = modelWithPanelAndBreaker();
    const secondPanel = {
      ...model.sheets[0].placements[0],
      id: "panel_ref",
      x: 60
    };
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        ...model.sheets,
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Sheet 2",
          placements: [secondPanel],
          connections: []
        }
      ]
    };
    const renamed = renameDrawingAssetTag(
      linkedModel,
      "asset_pdp_101",
      "PDP-201",
      [breakerSymbol]
    );

    expect(
      renamed.sheets.flatMap((sheet) =>
        sheet.placements
          .filter((placement) => placement.assetId === "asset_pdp_101")
          .map((placement) => placement.tag)
      )
    ).toEqual(["PDP-201", "PDP-201"]);
  });

  it("updates linked panel titles across sheets", () => {
    const model = modelWithPanelAndBreaker();
    const secondPanel = {
      ...model.sheets[0].placements[0],
      id: "panel_ref",
      x: 60
    };
    const linkedModel: DrawingModel = {
      ...model,
      sheets: [
        ...model.sheets,
        {
          ...model.sheets[0],
          id: "sheet_2",
          name: "Sheet 2",
          placements: [secondPanel],
          connections: []
        }
      ]
    };
    const renamed = updatePanelEnclosureTitle(
      linkedModel,
      "asset_pdp_101",
      "JB01 Power Distribution Panel"
    );

    expect(
      renamed.sheets.flatMap((sheet) =>
        sheet.placements
          .filter((placement) => placement.assetId === "asset_pdp_101")
          .map((placement) => placement.enclosure?.title)
      )
    ).toEqual([
      "JB01 Power Distribution Panel",
      "JB01 Power Distribution Panel"
    ]);
  });

  it("moves selected panels with contained same-sheet placements", () => {
    const model = modelWithPanelAndBreaker();
    const canvas = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: model.sheets[0].placements,
      connections: [],
      annotations: []
    };
    const moved = moveCanvasSelection({
      model: canvas,
      selection: { placementIds: [model.sheets[0].placements[0].id], annotationIds: [] },
      delta: { x: 10, y: 5 },
      symbols: [breakerSymbol]
    });

    expect(getPanelEnclosureBounds(moved.placements[0])).toMatchObject({
      x: 35,
      y: 35
    });
    expect(moved.placements[1]).toMatchObject({
      x: 52,
      y: 57
    });
  });

  it("moving a child placement does not move its panel", () => {
    const model = modelWithPanelAndBreaker();
    const canvas = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: model.sheets[0].placements,
      connections: [],
      annotations: []
    };
    const moved = moveCanvasSelection({
      model: canvas,
      selection: { placementIds: ["mcb_101"], annotationIds: [] },
      delta: { x: 10, y: 5 },
      symbols: [breakerSymbol]
    });

    expect(getPanelEnclosureBounds(moved.placements[0])).toMatchObject({
      x: 25,
      y: 30
    });
    expect(moved.placements[1]).toMatchObject({
      x: 52,
      y: 57
    });
  });

  it("renders panel enclosures behind normal placements and connections", () => {
    const model = modelWithPanelAndBreaker();
    const canvas = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: model.sheets[0].placements,
      connections: model.sheets[0].connections,
      annotations: []
    };
    const svg = renderDrawingToSvg({
      model: canvas,
      approvedSymbols: [breakerSymbol]
    });

    expect(svg).toContain('data-panel-enclosure="true"');
    expect(svg.indexOf('data-panel-enclosure="true"')).toBeLessThan(
      svg.indexOf('data-placement-id="mcb_101"')
    );
    expect(svg.indexOf('data-panel-enclosure="true"')).toBeLessThan(
      svg.indexOf("conn_1")
    );
  });

  it("creates a programmable backplane inside a visible panel", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_jb_001",
      tag: "JB001",
      title: "Field Junction Box",
      x: 20,
      y: 22,
      width: 118,
      height: 92,
      kind: "junction_box"
    });
    const backplane = createBackplanePlacement({ panelPlacement: panel });

    expect(backplane).toMatchObject({
      role: "other",
      tag: "Backplane",
      containerAssetId: "asset_jb_001",
      layoutKind: "backplane"
    });
    expect(backplane.assetId).toBeUndefined();
    expect(backplane.layoutDimensions?.lengthMm).toBeGreaterThan(100);
    expect(backplane.layoutDimensions?.widthMm).toBeGreaterThan(70);
  });

  it("autosizes a DIN rail layout helper to the backplane usable width", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_jb_001",
      tag: "JB001",
      x: 20,
      y: 22,
      width: 118,
      height: 92,
      kind: "junction_box"
    });
    const backplane = createBackplanePlacement({ panelPlacement: panel });
    const rail = autosizeLayoutHelperToBackplane({
      backplane,
      symbol: dinRailSymbol,
      placement: {
        id: "rail_1",
        symbolId: dinRailSymbol.symbolId,
        versionId: dinRailSymbol.versionId,
        role: "other",
        tag: dinRailSymbol.displayName,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper",
        layoutDimensions: {
          lengthMm: 300,
          widthMm: 35
        }
      }
    });
    const usable = getBackplaneUsableBounds(backplane);

    expect(rail.layoutParentId).toBe(backplane.id);
    expect(rail.containerAssetId).toBe("asset_jb_001");
    expect(rail.layoutDimensions?.lengthMm).toBe(usable.width);
    expect(rail.layoutDimensions?.widthMm).toBe(35);
    expect(rail.x).toBe(usable.x);
  });

  it("moves selected backplanes with assigned layout children", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_jb_001",
      tag: "JB001",
      x: 20,
      y: 22
    });
    const backplane = createBackplanePlacement({ panelPlacement: panel });
    const rail = autosizeLayoutHelperToBackplane({
      backplane,
      symbol: dinRailSymbol,
      placement: {
        id: "rail_1",
        symbolId: dinRailSymbol.symbolId,
        versionId: dinRailSymbol.versionId,
        role: "other",
        tag: dinRailSymbol.displayName,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper",
        layoutDimensions: {
          lengthMm: 300,
          widthMm: 35
        }
      }
    });
    const canvas = {
      sheet: {
        ...model.sheets[0].page,
        titleBlock: model.titleBlock
      },
      placements: [panel, backplane, rail],
      connections: [],
      annotations: []
    };
    const moved = moveCanvasSelection({
      model: canvas,
      selection: { placementIds: [backplane.id], annotationIds: [] },
      delta: { x: 10, y: 5 },
      symbols: [dinRailSymbol]
    });

    expect(moved.placements[1]).toMatchObject({
      x: backplane.x + 10,
      y: backplane.y + 5
    });
    expect(moved.placements[2]).toMatchObject({
      x: rail.x + 10,
      y: rail.y + 5
    });
  });

  it("renders backplanes between panel enclosures and layout helpers", () => {
    const model = createDefaultDrawingModel();
    const panel = createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_jb_001",
      tag: "JB001",
      x: 20,
      y: 22
    });
    const backplane = createBackplanePlacement({ panelPlacement: panel });
    const rail = autosizeLayoutHelperToBackplane({
      backplane,
      symbol: dinRailSymbol,
      placement: {
        id: "rail_1",
        symbolId: dinRailSymbol.symbolId,
        versionId: dinRailSymbol.versionId,
        role: "other",
        tag: dinRailSymbol.displayName,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper",
        layoutDimensions: {
          lengthMm: 300,
          widthMm: 35
        }
      }
    });
    const svg = renderDrawingToSvg({
      model: {
        sheet: {
          ...model.sheets[0].page,
          titleBlock: model.titleBlock
        },
        placements: [panel, backplane, rail],
        connections: [],
        annotations: []
      },
      approvedSymbols: [dinRailSymbol]
    });

    expect(svg).toContain('data-backplane="true"');
    expect(svg.indexOf('data-panel-enclosure="true"')).toBeLessThan(
      svg.indexOf('data-backplane="true"')
    );
    expect(svg.indexOf('data-backplane="true"')).toBeLessThan(
      svg.indexOf('data-placement-id="rail_1"')
    );
  });
});
