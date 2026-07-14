import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "../types";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema
} from "../data/schema";
import {
  createNewPanelAssetIdentityFromOccurrence,
  createAndPlacePanelAsset,
  placeExistingPanelAsset,
  removePanelComponentOccurrence
} from "../logic/commands/drawing-panel-component-commands";
import {
  applySheetDuplicatePlan,
  buildSheetDuplicatePlan
} from "../logic/services/drawing-sheet-duplication";
import {
  copySelectionToClipboard,
  pasteClipboardToSheet
} from "../logic/services/drawing-clipboard-commands";

const PANEL_ID = "asset_panel";
const DETAIL_ID = "sheet_detail";

function breakerSymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: "symbol_breaker",
    versionId: "version_breaker",
    versionNumber: 1,
    symbolKey: "breaker_symbol",
    displayName: "Miniature Circuit Breaker",
    category: "terminal_block",
    svg: '<svg viewBox="0 0 100 80"></svg>',
    metadata: {
      symbolKey: "breaker_symbol",
      displayName: "Miniature Circuit Breaker",
      category: "terminal_block",
      viewBox: { x: 0, y: 0, width: 100, height: 80 },
      anchors: [
        { key: "LINE", x: 20, y: 0, kind: "terminal" },
        { key: "LOAD", x: 20, y: 80, kind: "terminal" }
      ],
      terminals: [
        {
          key: "L",
          label: "Line",
          anchorKey: "LINE",
          panelSide: "single",
          requiredForWiring: true
        },
        {
          key: "T",
          label: "Load",
          anchorKey: "LOAD",
          panelSide: "single",
          requiredForWiring: true
        }
      ],
      panelWiring: {
        assetType: "breaker",
        tagPrefix: "MCB",
        schematicScale: 0.5
      }
    }
  };
}

function fixture() {
  const base = createDefaultDrawingModel();
  return drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: PANEL_ID, tag: "JB-001", type: "junction_box", title: "JB" }
    ],
    sheets: [
      {
        ...createDefaultDrawingSheet({ id: "sheet_source", name: "Source" }),
        placements: []
      },
      {
        ...createDefaultDrawingSheet({ id: DETAIL_ID, name: "Detail" }),
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: PANEL_ID
        }
      }
    ]
  });
}

function associatedFixture() {
  const symbol = breakerSymbol();
  const model = fixture();
  const asset = {
    id: "asset_breaker",
    tag: "MCB-105",
    type: "breaker" as const,
    title: "Existing breaker",
    symbolId: symbol.symbolId,
    versionId: symbol.versionId
  };
  const associated = drawingPackageModelSchema.parse({
    ...model,
    assets: [...(model.assets ?? []), asset],
    sheets: model.sheets.map((sheet) =>
      sheet.id === "sheet_source"
        ? {
            ...sheet,
            placements: [
              {
                id: "source_breaker",
                assetId: asset.id,
                containerAssetId: PANEL_ID,
                symbolId: symbol.symbolId,
                versionId: symbol.versionId,
                role: "device",
                tag: asset.tag,
                title: asset.title,
                x: 40,
                y: 40,
                rotation: 0,
                scale: 0.5
              }
            ]
          }
        : sheet
    )
  });

  return { asset, model: associated, symbol };
}

function representedFixture() {
  const associated = associatedFixture();
  const placed = placeExistingPanelAsset({
    model: associated.model,
    sheetId: DETAIL_ID,
    symbol: associated.symbol,
    assetId: associated.asset.id,
    symbols: [associated.symbol]
  });

  return { ...associated, placed };
}

describe("Detailed Panel component commands", () => {
  it("blocks physical equipment creation from a Detailed Panel Drawing", () => {
    const { model, symbol } = associatedFixture();

    expect(() => createAndPlacePanelAsset({
      model,
      sheetId: DETAIL_ID,
      symbol,
      symbols: [symbol]
    })).toThrow("Create physical equipment from the panel layout");
  });

  it("blocks splitting a Detailed Panel occurrence into a new physical identity", () => {
    const { placed, symbol } = representedFixture();

    expect(() =>
      createNewPanelAssetIdentityFromOccurrence({
        model: placed.model,
        sheetId: DETAIL_ID,
        placementId: placed.placement.id,
        symbol,
        tag: "MCB-120"
      })
    ).toThrow("Create physical equipment from the panel layout");
  });

  it("references a compatible associated asset without changing assets", () => {
    const { asset, model, symbol } = associatedFixture();
    const result = placeExistingPanelAsset({
      model,
      sheetId: DETAIL_ID,
      symbol,
      assetId: asset.id,
      symbols: [symbol]
    });

    expect(result.model.assets).toEqual(model.assets);
    expect(result.placement.assetId).toBe(asset.id);
    expect(() =>
      placeExistingPanelAsset({
        model: result.model,
        sheetId: DETAIL_ID,
        symbol,
        assetId: asset.id,
        symbols: [symbol]
      })
    ).toThrow("already represented");
  });

  it("removes only the occurrence and leaves the physical asset", () => {
    const { placed } = representedFixture();
    const removed = removePanelComponentOccurrence({
      model: placed.model,
      sheetId: DETAIL_ID,
      placementId: placed.placement.id
    });

    expect(removed.model.assets).toEqual(placed.model.assets);
    expect(
      removed.model.sheets
        .find((sheet) => sheet.id === DETAIL_ID)
        ?.placements.some((placement) => placement.id === placed.placement.id)
    ).toBe(false);
  });

  it("duplicates a Detailed Panel sheet while preserving physical asset IDs", () => {
    const { placed, symbol } = representedFixture();
    const plan = buildSheetDuplicatePlan({
      model: placed.model,
      symbols: [symbol],
      sourceSheetId: DETAIL_ID
    });
    const result = applySheetDuplicatePlan({
      model: placed.model,
      symbols: [symbol],
      plan
    });
    const duplicate = result.model.sheets.find(
      (sheet) => sheet.id === result.sheetId
    );

    expect(plan.preserveAssetReferences).toBe(true);
    expect(plan.assetRows.every((row) => row.action === "reference")).toBe(true);
    expect(result.model.assets).toEqual(placed.model.assets);
    expect(duplicate?.panelDrawingContext).toEqual(
      placed.model.sheets.find((sheet) => sheet.id === DETAIL_ID)
        ?.panelDrawingContext
    );
    expect(duplicate?.placements[0].assetId).toBe(placed.asset.id);
  });

  it("blocks same-sheet component paste and permits one same-panel cross-sheet reference", () => {
    const { placed, symbol } = representedFixture();
    const clipboard = copySelectionToClipboard({
      model: placed.model,
      sheetId: DETAIL_ID,
      selection: {
        placementIds: [placed.placement.id],
        annotationIds: []
      }
    });
    expect(clipboard).not.toBeNull();
    expect(() =>
      pasteClipboardToSheet({
        model: placed.model,
        sheetId: DETAIL_ID,
        clipboard: clipboard!,
        symbols: [symbol]
      })
    ).toThrow("only once");

    const secondSheetId = "sheet_detail_2";
    const withSecondSheet = drawingPackageModelSchema.parse({
      ...placed.model,
      sheets: [
        ...placed.model.sheets,
        {
          ...createDefaultDrawingSheet({ id: secondSheetId, name: "Detail 2" }),
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: PANEL_ID
          }
        }
      ]
    });
    const pasted = pasteClipboardToSheet({
      model: withSecondSheet,
      sheetId: secondSheetId,
      clipboard: clipboard!,
      symbols: [symbol]
    });

    expect(pasted.model.assets).toEqual(withSecondSheet.assets);
    expect(
      pasted.model.sheets.find((sheet) => sheet.id === secondSheetId)
        ?.placements[0].assetId
    ).toBe(placed.asset.id);
  });
});
