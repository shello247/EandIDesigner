import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  type DrawingModel
} from "../data/schema";
import {
  createAndPlaceTerminalBlockGroup,
  updateTerminalBlockGroup,
  validateTerminalBlockGroupResize
} from "../logic/commands/drawing-terminal-block-group-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import type { ApprovedDrawingSymbol } from "../types";

const terminalModule: ApprovedDrawingSymbol = {
  symbolId: "symbol_terminal_module",
  symbolKey: "terminal_block_single_scaled",
  displayName: "Terminal Block Single Scaled",
  category: "terminal_block",
  versionId: "version_terminal_module",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 20 178" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="178" fill="white" stroke="black"/></svg>',
  metadata: {
    symbolKey: "terminal_block_single_scaled",
    displayName: "Terminal Block Single Scaled",
    category: "terminal_block",
    layoutUsage: "both",
    panelCategory: "termination",
    mountingType: "din_rail",
    physicalWidthMm: 5.2,
    physicalHeightMm: 50,
    viewBox: { x: 0, y: 0, width: 20, height: 178 },
    anchors: [],
    terminals: []
  }
};

function createLayoutFixture(): DrawingModel {
  const model = createDefaultDrawingModel();
  const panel = {
    ...createPanelEnclosurePlacement({
      model,
      activeSheet: model.sheets[0],
      assetId: "asset_panel",
      tag: "JB001",
      title: "Field Junction Box",
      x: 20,
      y: 20
    }),
    id: "panel_placement"
  };
  const backplane = {
    ...createBackplanePlacement({ panelPlacement: panel, id: "backplane_1" }),
    layoutDimensions: { lengthMm: 300, widthMm: 200 }
  };

  return drawingPackageModelSchema.parse({
    ...model,
    assets: [
      {
        id: "asset_panel",
        tag: "JB001",
        type: "junction_box",
        title: "Field Junction Box"
      }
    ],
    sheets: [
      {
        ...model.sheets[0],
        placements: [panel, backplane]
      }
    ]
  });
}

describe("terminal block group commands", () => {
  it("creates one physical asset, one placement, and five logical terminals", () => {
    const model = createLayoutFixture();
    const result = createAndPlaceTerminalBlockGroup({
      model,
      symbols: [terminalModule],
      input: {
        sheetId: model.sheets[0].id,
        backplaneId: "backplane_1",
        name: "Modbus Terminal Strip",
        description: "Field bus terminations",
        count: 5,
        placementId: "terminal_group_1",
        assetId: "asset_terminal_group_1"
      }
    });

    expect(result.model.assets).toHaveLength(model.assets.length + 1);
    expect(result.model.sheets[0].placements).toHaveLength(
      model.sheets[0].placements.length + 1
    );
    expect(result.model.assets.at(-1)).toMatchObject({
      id: "asset_terminal_group_1",
      tag: "TB-101",
      type: "terminal_block",
      title: "Modbus Terminal Strip",
      description: "Field bus terminations",
      terminalBlock: { count: 5, startNumber: 1 }
    });
    expect(result.placement).toMatchObject({
      assetId: "asset_terminal_group_1",
      containerAssetId: "asset_panel",
      layoutKind: "layout_helper",
      layoutParentId: "backplane_1",
      layoutDimensions: { lengthMm: 26, widthMm: 50 },
      terminalBlock: { count: 5, startNumber: 1 }
    });
  });

  it("allocates sequential package-wide tags", () => {
    const model = createLayoutFixture();
    const first = createAndPlaceTerminalBlockGroup({
      model,
      symbols: [terminalModule],
      input: {
        sheetId: model.sheets[0].id,
        backplaneId: "backplane_1",
        name: "First strip",
        count: 5
      }
    });
    const second = createAndPlaceTerminalBlockGroup({
      model: first.model,
      symbols: [terminalModule],
      input: {
        sheetId: model.sheets[0].id,
        backplaneId: "backplane_1",
        name: "Second strip",
        count: 5
      }
    });

    expect(first.placement.tag).toBe("TB-101");
    expect(second.placement.tag).toBe("TB-102");
    expect(second.placement.layoutPosition).not.toEqual(
      first.placement.layoutPosition
    );
  });

  it("blocks reducing the count when removed terminals are connected", () => {
    const base = createLayoutFixture();
    const created = createAndPlaceTerminalBlockGroup({
      model: base,
      symbols: [terminalModule],
      input: {
        sheetId: base.sheets[0].id,
        backplaneId: "backplane_1",
        name: "Connected strip",
        count: 5,
        placementId: "terminal_group_connected",
        assetId: "asset_terminal_group_connected"
      }
    });
    const connected = drawingPackageModelSchema.parse({
      ...created.model,
      sheets: created.model.sheets.map((sheet) => ({
        ...sheet,
        connections: [
          ...sheet.connections,
          {
            id: "connection_t5",
            from: {
              placementId: created.placement.id,
              anchorKey: "T5_TOP"
            },
            to: {
              placementId: created.placement.id,
              anchorKey: "T1_TOP"
            }
          }
        ]
      }))
    });

    expect(
      validateTerminalBlockGroupResize({
        model: connected,
        assetId: created.assetId,
        count: 4
      })
    ).toMatchObject({ ok: false });
    expect(() =>
      updateTerminalBlockGroup({
        model: connected,
        assetId: created.assetId,
        count: 4
      })
    ).toThrow("cannot remove terminals");
  });

  it("requires a panel-associated backplane and a default module", () => {
    const model = createLayoutFixture();

    expect(() =>
      createAndPlaceTerminalBlockGroup({
        model,
        symbols: [],
        input: {
          sheetId: model.sheets[0].id,
          backplaneId: "backplane_1",
          name: "No module",
          count: 5
        }
      })
    ).toThrow("default terminal group module");

    expect(() =>
      createAndPlaceTerminalBlockGroup({
        model,
        symbols: [terminalModule],
        input: {
          sheetId: model.sheets[0].id,
          backplaneId: "missing_backplane",
          name: "No backplane",
          count: 5
        }
      })
    ).toThrow("Choose a backplane");
  });
});
