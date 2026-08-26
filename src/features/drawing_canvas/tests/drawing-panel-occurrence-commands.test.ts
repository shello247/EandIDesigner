import { describe, expect, it } from "vitest";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema,
  type DrawingModel
} from "../data/schema";
import {
  centerDetailedPanelEquipment,
  getDetailedPanelUsableDrawingRect,
  placePanelAssetOccurrence,
  placePanelAssetOccurrences,
  removePanelAssetOccurrence
} from "../logic/commands/drawing-panel-occurrence-commands";
import { getPlacementBounds } from "../logic/services/drawing-geometry";
import { getRenderableSymbolForPlacement } from "../logic/services/drawing-generated-symbols";
import {
  createTerminalBlockPlacement,
  TERMINAL_BLOCK_SCHEMATIC_SCALE
} from "../logic/services/drawing-terminal-blocks";

const PANEL_ASSET_ID = "asset_panel_alpha";
const TERMINAL_ASSET_ID = "asset_terminal_alpha";
const SECOND_TERMINAL_ASSET_ID = "asset_terminal_beta";
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
  const secondTerminal = createTerminalBlockPlacement({
    model: base,
    activeSheet: sourceSheet,
    assetId: SECOND_TERMINAL_ASSET_ID,
    tag: "TB-102",
    x: 120,
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
      },
      {
        id: SECOND_TERMINAL_ASSET_ID,
        tag: "TB-102",
        type: "terminal_block",
        title: "Terminal Strip 2",
        symbolId: secondTerminal.symbolId,
        versionId: secondTerminal.versionId
      }
    ],
    sheets: [
      {
        ...sourceSheet,
        placements: [
          {
            ...terminal,
            containerAssetId: PANEL_ASSET_ID
          },
          {
            ...secondTerminal,
            containerAssetId: PANEL_ASSET_ID
          }
        ]
      },
      detailedSheet
    ]
  });
}

function createLayoutOnlyFixture(): DrawingModel {
  const model = createFixture();
  const sourcePlacement = model.sheets[0].placements.find(
    (placement) => placement.assetId === TERMINAL_ASSET_ID
  )!;
  const terminalBlock = sourcePlacement.terminalBlock!;

  return drawingPackageModelSchema.parse({
    ...model,
    assets: model.assets.map((asset) =>
      asset.id === TERMINAL_ASSET_ID
        ? { ...asset, terminalBlock }
        : asset
    ),
    sheets: model.sheets.map((sheet) =>
      sheet.id === "sheet_source"
        ? {
            ...sheet,
            placements: sheet.placements.map((placement) =>
              placement.assetId === TERMINAL_ASSET_ID
                ? {
                    ...placement,
                    layoutKind: "layout_helper" as const,
                    layoutParentId: "backplane_layout",
                    layoutPosition: { xMm: 20, yMm: 30 },
                    layoutDimensions: { lengthMm: 10.4, widthMm: 50 },
                    scale: 1,
                    terminalBlock: { ...terminalBlock, count: 2 }
                  }
                : placement
            )
          }
        : sheet
    )
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
    expect(
      createPanelWiringSource(result.model, [])
        .sheets.find((sheet) => sheet.id === DETAIL_SHEET_ID)
        ?.occurrences.find(
          (occurrence) => occurrence.placementId === result.placement.id
        )
        ?.terminals.find((terminal) => terminal.terminalKey === "T1")
        ?.anchors.find((anchor) => anchor.anchorKey === "T1_TOP")
    ).toMatchObject({
      sideHint: "internal",
      physicalPosition: "top"
    });
  });

  it("places a selected equipment set atomically in one model result", () => {
    const model = createFixture();
    const result = placePanelAssetOccurrences({
      model,
      sheetId: DETAIL_SHEET_ID,
      assetIds: [TERMINAL_ASSET_ID, SECOND_TERMINAL_ASSET_ID]
    });
    const detailedSheet = result.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    );

    expect(result.placements.map((placement) => placement.assetId)).toEqual([
      TERMINAL_ASSET_ID,
      SECOND_TERMINAL_ASSET_ID
    ]);
    expect(
      detailedSheet?.placements.filter((placement) =>
        [TERMINAL_ASSET_ID, SECOND_TERMINAL_ASSET_ID].includes(
          placement.assetId ?? ""
        )
      )
    ).toHaveLength(2);
    expect(model.sheets.find((sheet) => sheet.id === DETAIL_SHEET_ID)?.placements).toEqual([]);
  });

  it("creates a schematic occurrence from a layout-only terminal group", () => {
    const model = createLayoutOnlyFixture();
    const asset = model.assets.find(
      (candidate) => candidate.id === TERMINAL_ASSET_ID
    )!;
    const result = placePanelAssetOccurrence({
      model,
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const detailedOccurrence = createPanelWiringSource(result.model, [])
      .sheets.find((sheet) => sheet.id === DETAIL_SHEET_ID)
      ?.occurrences.find(
        (occurrence) => occurrence.placementId === result.placement.id
      );

    expect(result.model.assets).toEqual(model.assets);
    expect(result.placement).toMatchObject({
      assetId: TERMINAL_ASSET_ID,
      containerAssetId: PANEL_ASSET_ID,
      tag: "TB-101",
      role: "terminal_block",
      rotation: 0,
      scale: TERMINAL_BLOCK_SCHEMATIC_SCALE,
      terminalBlock: asset.terminalBlock
    });
    expect(result.placement.layoutKind).toBeUndefined();
    expect(result.placement.layoutParentId).toBeUndefined();
    expect(result.placement.layoutPosition).toBeUndefined();
    expect(result.placement.layoutDimensions).toBeUndefined();
    expect(detailedOccurrence).toMatchObject({
      occurrenceKind: "wiring",
      terminalResolutionStatus: "resolved"
    });
    expect(detailedOccurrence?.terminals).toHaveLength(
      asset.terminalBlock?.count
    );
    expect(
      detailedOccurrence?.terminals
        .find((terminal) => terminal.terminalKey === "T5")
        ?.anchors
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorKey: "T5_TOP",
          sideHint: "internal"
        }),
        expect.objectContaining({
          anchorKey: "T5_BOTTOM",
          sideHint: "external"
        })
      ])
    );
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

  it("places equipment from the usable-area center without moving existing items", () => {
    const model = createFixture();
    const first = placePanelAssetOccurrence({
      model,
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const firstSheet = first.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    )!;
    const firstSymbol = getRenderableSymbolForPlacement(first.placement, []);
    const firstBounds = getPlacementBounds(
      first.placement,
      firstSymbol!.metadata
    );
    const usable = getDetailedPanelUsableDrawingRect(firstSheet);
    const second = placePanelAssetOccurrence({
      model: first.model,
      sheetId: DETAIL_SHEET_ID,
      assetId: SECOND_TERMINAL_ASSET_ID
    });
    const secondSheet = second.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    )!;
    const preservedFirst = secondSheet.placements.find(
      (placement) => placement.id === first.placement.id
    )!;
    const secondSymbol = getRenderableSymbolForPlacement(second.placement, []);
    const secondBounds = getPlacementBounds(
      second.placement,
      secondSymbol!.metadata
    );

    expect(
      Math.abs(
        firstBounds.x + firstBounds.width / 2 -
          (usable.x + usable.width / 2)
      )
    ).toBeLessThanOrEqual(firstSheet.page.gridSize);
    expect(
      Math.abs(
        firstBounds.y + firstBounds.height / 2 -
          (usable.y + usable.height / 2)
      )
    ).toBeLessThanOrEqual(firstSheet.page.gridSize);
    expect(preservedFirst).toMatchObject({
      x: first.placement.x,
      y: first.placement.y
    });
    expect(second.placement.y).toBe(first.placement.y);
    expect(
      firstBounds.x + firstBounds.width <= secondBounds.x ||
        secondBounds.x + secondBounds.width <= firstBounds.x
    ).toBe(true);
  });

  it("centers equipment as one group with labels and complete route geometry", () => {
    const first = placePanelAssetOccurrence({
      model: createFixture(),
      sheetId: DETAIL_SHEET_ID,
      assetId: TERMINAL_ASSET_ID
    });
    const second = placePanelAssetOccurrence({
      model: first.model,
      sheetId: DETAIL_SHEET_ID,
      assetId: SECOND_TERMINAL_ASSET_ID
    });
    const arranged = drawingPackageModelSchema.parse({
      ...second.model,
      sheets: second.model.sheets.map((sheet) =>
        sheet.id === DETAIL_SHEET_ID
          ? {
              ...sheet,
              placements: sheet.placements.map((placement) =>
                placement.id === first.placement.id
                  ? {
                      ...placement,
                      x: 35,
                      y: 40,
                      labelPosition: { x: 37, y: 30 }
                    }
                  : placement.id === second.placement.id
                    ? { ...placement, x: 85, y: 55 }
                    : placement
              ),
              connections: [
                {
                  id: "panel_route_1",
                  from: {
                    placementId: first.placement.id,
                    anchorKey: "T1_TOP"
                  },
                  to: {
                    placementId: second.placement.id,
                    anchorKey: "T1_TOP"
                  },
                  route: {
                    mode: "manual",
                    style: "orthogonal",
                    points: [
                      { id: "route_start", x: 40, y: 40, kind: "endpoint" },
                      { id: "route_control", x: 70, y: 35, kind: "control" },
                      { id: "route_end", x: 90, y: 55, kind: "endpoint" }
                    ],
                    labelPosition: { x: 65, y: 30 }
                  }
                }
              ],
              annotations: [
                {
                  id: "note_1",
                  kind: "note",
                  text: "Keep this note fixed",
                  x: 15,
                  y: 15
                }
              ]
            }
          : sheet
      )
    });
    const beforeSheet = arranged.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    )!;
    const beforeFirst = beforeSheet.placements.find(
      (placement) => placement.id === first.placement.id
    )!;
    const beforeSecond = beforeSheet.placements.find(
      (placement) => placement.id === second.placement.id
    )!;
    const result = centerDetailedPanelEquipment({
      model: arranged,
      sheetId: DETAIL_SHEET_ID
    });
    const centeredSheet = result.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    )!;
    const centeredFirst = centeredSheet.placements.find(
      (placement) => placement.id === first.placement.id
    )!;
    const centeredSecond = centeredSheet.placements.find(
      (placement) => placement.id === second.placement.id
    )!;
    const route = centeredSheet.connections[0].route!;

    expect(result.delta).not.toEqual({ x: 0, y: 0 });
    expect(centeredSecond.x - centeredFirst.x).toBe(
      beforeSecond.x - beforeFirst.x
    );
    expect(centeredSecond.y - centeredFirst.y).toBe(
      beforeSecond.y - beforeFirst.y
    );
    expect(centeredFirst.labelPosition).toEqual({
      x: 37 + result.delta.x,
      y: 30 + result.delta.y
    });
    expect(route.points.find((point) => point.id === "route_control")).toMatchObject({
      x: 70 + result.delta.x,
      y: 35 + result.delta.y
    });
    expect(route.labelPosition).toEqual({
      x: 65 + result.delta.x,
      y: 30 + result.delta.y
    });
    expect(centeredSheet.annotations[0]).toMatchObject({ x: 15, y: 15 });
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
