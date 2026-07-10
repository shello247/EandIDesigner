import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema,
  type DrawingModel
} from "../data/schema";
import {
  placePanelAssetOccurrence,
  removePanelAssetOccurrence
} from "../logic/commands/drawing-panel-occurrence-commands";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";

const PANEL_ASSET_ID = "asset_panel_alpha";
const TERMINAL_ASSET_ID = "asset_terminal_alpha";
const DETAIL_SHEET_ID = "sheet_detail";

function createFixture(): DrawingModel {
  const base = createDefaultDrawingModel();
  const sourceSheet = createDefaultDrawingSheet({
    id: "sheet_source",
    name: "Field Terminations"
  });
  const terminal = createTerminalBlockPlacement({
    model: base,
    activeSheet: sourceSheet,
    assetId: TERMINAL_ASSET_ID,
    tag: "TB-101",
    x: 80,
    y: 70
  });
  const detailedSheet = {
    ...createDefaultDrawingSheet({
      id: DETAIL_SHEET_ID,
      name: "JB-001 Detailed Panel Drawing"
    }),
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: PANEL_ASSET_ID
    }
  };

  return drawingPackageModelSchema.parse({
    ...base,
    assets: [
      {
        id: PANEL_ASSET_ID,
        tag: "JB-001",
        type: "junction_box",
        title: "Field Junction Box"
      },
      {
        id: TERMINAL_ASSET_ID,
        tag: "TB-101",
        type: "terminal_block",
        title: "Terminal Strip",
        symbolId: terminal.symbolId,
        versionId: terminal.versionId
      }
    ],
    sheets: [
      {
        ...sourceSheet,
        placements: [
          {
            ...terminal,
            containerAssetId: PANEL_ASSET_ID
          }
        ]
      },
      detailedSheet
    ]
  });
}

describe("Detailed Panel asset occurrence commands", () => {
  it("places an existing asset occurrence without changing assets or source connections", () => {
    const model = createFixture();
    const result = placePanelAssetOccurrence({
      model,
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const detailedSheet = result.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    );

    expect(result.model.assets).toEqual(model.assets);
    expect(result.model.sheets[0].connections).toEqual(
      model.sheets[0].connections
    );
    expect(detailedSheet?.connections).toEqual([]);
    expect(result.placement).toMatchObject({
      assetId: TERMINAL_ASSET_ID,
      containerAssetId: PANEL_ASSET_ID,
      tag: "TB-101",
      role: "terminal_block"
    });
    expect(result.placement.id).not.toBe(model.sheets[0].placements[0].id);
  });

  it("rejects a second representation of the same asset", () => {
    const first = placePanelAssetOccurrence({
      model: createFixture(),
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });

    expect(() =>
      placePanelAssetOccurrence({
        model: first.model,
        sheetId: DETAIL_SHEET_ID,
        assetId: TERMINAL_ASSET_ID
      })
    ).toThrow("already represented");
  });

  it("removes only the representation so the asset can be placed again", () => {
    const placed = placePanelAssetOccurrence({
      model: createFixture(),
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const removed = removePanelAssetOccurrence({
      model: placed.model,
      sheetId: DETAIL_SHEET_ID,
      placementId: placed.placement.id
    });
    const replacement = placePanelAssetOccurrence({
      model: removed.model,
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });

    expect(removed.assetId).toBe(TERMINAL_ASSET_ID);
    expect(removed.model.assets).toEqual(placed.model.assets);
    expect(replacement.placement.assetId).toBe(TERMINAL_ASSET_ID);
  });

  it("blocks removal while a sheet-local connection references the occurrence", () => {
    const placed = placePanelAssetOccurrence({
      model: createFixture(),
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const withConnection = {
      ...placed.model,
      sheets: placed.model.sheets.map((sheet) =>
        sheet.id === DETAIL_SHEET_ID
          ? {
              ...sheet,
              connections: [
                {
                  id: "connection_local",
                  from: {
                    placementId: placed.placement.id,
                    anchorKey: "T1_TOP"
                  },
                  to: {
                    placementId: "other_placement",
                    anchorKey: "P1"
                  }
                }
              ]
            }
          : sheet
      )
    };

    expect(() =>
      removePanelAssetOccurrence({
        model: withConnection,
        sheetId: DETAIL_SHEET_ID,
        placementId: placed.placement.id
      })
    ).toThrow("Remove sheet-local connections");
  });
});
