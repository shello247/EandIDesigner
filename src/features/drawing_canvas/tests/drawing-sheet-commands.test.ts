import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  drawingPackageModelSchema,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "../data/schema";
import {
  addDrawingSheet,
  addSectionTitlePage,
  addSheet,
  deleteSheet,
  duplicateSheet,
  moveSheet,
  moveSheetToEnd,
  replaceSheetFromCanvasModel,
  toSheetCanvasModel,
  updatePackageTitleBlock,
  updateSectionTitlePage,
  updateSheetMetadata
} from "../logic/commands/drawing-sheet-commands";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";

function populatedPackageModel(): DrawingModel {
  const model = createDefaultDrawingModel();
  const sheet = model.sheets[0];

  return {
    ...model,
    titleBlock: {
      ...model.titleBlock,
      drawingNumber: "EI-001"
    },
    sheets: [
      {
        ...sheet,
        description: "Primary loop sheet",
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
            x: 80,
            y: 20,
            rotation: 0,
            scale: 0.5
          }
        ],
        connections: [
          {
            id: "connection_1",
            from: { placementId: "device_1", anchorKey: "T1" },
            to: { placementId: "cable_1", anchorKey: "CH1_T1" },
            cablePlacementId: "cable_1",
            conductorKey: "CH1_T1",
            wireId: "C-101-WHT",
            route: {
              mode: "manual",
              style: "orthogonal",
              points: [
                { id: "route_start", kind: "endpoint", x: 10, y: 20 },
                { id: "route_end", kind: "endpoint", x: 80, y: 20 }
              ]
            }
          }
        ],
        annotations: [
          {
            id: "note_1",
            title: "Install",
            text: "Install seal fitting",
            x: 20,
            y: 30,
            width: 70,
            height: 24,
            kind: "note"
          }
        ]
      }
    ]
  };
}

describe("drawing sheet package commands", () => {
  it("migrates version 1 drawing JSON into a one-sheet version 2 package", () => {
    const legacyModel = {
      version: 1,
      sheet: {
        size: "A3_LANDSCAPE",
        width: 420,
        height: 297,
        gridSize: 10,
        titleBlock: {
          drawingNumber: "EI-LEGACY-001",
          revision: "A"
        }
      },
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
        }
      ],
      connections: [],
      annotations: []
    };

    const parsed = parseDrawingModelJson(JSON.stringify(legacyModel));

    expect(parsed.version).toBe(2);
    expect(parsed.titleBlock.drawingNumber).toBe("EI-LEGACY-001");
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0].kind).toBe("drawing");
    expect(parsed.sheets[0].placements[0].id).toBe("device_1");
    expect(JSON.parse(stringifyDrawingModel(parsed)).version).toBe(2);
  });

  it("normalizes legacy panel layout sheets into regular drawing sheets", () => {
    const legacyModel = {
      ...createDefaultDrawingModel(),
      sheets: [
        {
          ...createDefaultDrawingModel().sheets[0],
          kind: "panel_layout",
          panelLayout: {
            panelAssetId: "asset_jb001",
            panelTag: "JB001",
            title: "Field Junction Box",
            enclosureWidth: 250,
            enclosureHeight: 250,
            gridSize: 10,
            items: []
          }
        }
      ]
    };

    const parsed = parseDrawingModelJson(JSON.stringify(legacyModel));

    expect(parsed.sheets[0].kind).toBe("drawing");
    expect("panelLayout" in parsed.sheets[0]).toBe(false);
  });

  it("adds, updates metadata, moves, and blocks deletion of the last sheet", () => {
    const initial = createDefaultDrawingModel();
    const added = addSheet(initial, "Loop Sheet");
    const renamed = updateSheetMetadata(added.model, added.sheetId, {
      name: "Loop Detail",
      description: "Panel wiring detail"
    });
    const moved = moveSheet(renamed, added.sheetId, -1);

    expect(drawingPackageModelSchema.parse(moved).sheets).toHaveLength(2);
    expect(moved.sheets[0].id).toBe(added.sheetId);
    expect(moved.sheets[0].name).toBe("Loop Detail");
    expect(moved.sheets[0].description).toBe("Panel wiring detail");

    const deleted = deleteSheet(moved, added.sheetId);
    expect(deleted.model.sheets).toHaveLength(1);

    const blocked = deleteSheet(deleted.model, deleted.model.sheets[0].id);
    expect(blocked.model.sheets).toHaveLength(1);
    expect(blocked.activeSheetId).toBe(deleted.model.sheets[0].id);
  });

  it("preserves typed spaces in sheet metadata while editing", () => {
    const initial = createDefaultDrawingModel();
    const added = addSheet(initial);
    const edited = updateSheetMetadata(added.model, added.sheetId, {
      name: "Loop Detail ",
      description: "Panel wiring detail "
    });

    expect(edited.sheets[1].name).toBe("Loop Detail ");
    expect(edited.sheets[1].description).toBe("Panel wiring detail ");

    const serialized = JSON.parse(stringifyDrawingModel(edited)) as DrawingModel;

    expect(serialized.sheets[1].name).toBe("Loop Detail");
    expect(serialized.sheets[1].description).toBe("Panel wiring detail");
  });

  it("adds and updates section title pages", () => {
    const initial = createDefaultDrawingModel();
    const drawingSheet = addDrawingSheet(initial, "Loop Detail");
    const added = addSectionTitlePage(drawingSheet.model, {
      name: "Power Section",
      title: "Power Distribution",
      subtitle: "Main low-voltage distribution drawings",
      sectionNumber: "Section 2"
    });
    const updated = updateSectionTitlePage(added.model, added.sheetId, {
      title: "Power Distribution ",
      subtitle: "Panel and breaker drawings ",
      sectionNumber: "02 "
    });
    const sectionSheet = updated.sheets.find(
      (sheet) => sheet.id === added.sheetId
    );
    const serialized = JSON.parse(stringifyDrawingModel(updated)) as DrawingModel;
    const serializedSection = serialized.sheets.find(
      (sheet) => sheet.id === added.sheetId
    );

    expect(sectionSheet?.kind).toBe("section_title");
    expect(sectionSheet?.placements).toHaveLength(0);
    expect(sectionSheet?.connections).toHaveLength(0);
    expect(sectionSheet?.annotations).toHaveLength(0);
    expect(sectionSheet?.sectionTitlePage?.title).toBe("Power Distribution ");
    expect(sectionSheet?.sectionTitlePage?.subtitle).toBe(
      "Panel and breaker drawings "
    );
    expect(serializedSection?.sectionTitlePage?.title).toBe(
      "Power Distribution"
    );
    expect(serializedSection?.sectionTitlePage?.subtitle).toBe(
      "Panel and breaker drawings"
    );
    expect(serializedSection?.sectionTitlePage?.sectionNumber).toBe("02");
  });

  it("duplicates a sheet and remaps nested ids and endpoint references", () => {
    const model = populatedPackageModel();
    const result = duplicateSheet(model, "sheet_1");
    const duplicate = result.model.sheets[1];

    expect(duplicate.id).toBe(result.sheetId);
    expect(duplicate.description).toBe("Primary loop sheet");
    expect(duplicate.placements.map((placement) => placement.id)).not.toEqual(
      model.sheets[0].placements.map((placement) => placement.id)
    );
    expect(duplicate.connections[0].id).not.toBe(model.sheets[0].connections[0].id);
    expect(duplicate.connections[0].from.placementId).toBe(
      duplicate.placements[0].id
    );
    expect(duplicate.connections[0].to.placementId).toBe(
      duplicate.placements[1].id
    );
    expect(duplicate.connections[0].cablePlacementId).toBe(
      duplicate.placements[1].id
    );
    expect(duplicate.connections[0].route?.points[0].id).not.toBe(
      model.sheets[0].connections[0].route?.points[0].id
    );
    expect(duplicate.annotations[0].id).not.toBe(model.sheets[0].annotations[0].id);
  });

  it("remaps dimension attachment references when duplicating a sheet", () => {
    const initial = createDefaultDrawingModel();
    const source = initial.sheets[0];
    const model: DrawingModel = {
      ...initial,
      sheets: [
        {
          ...source,
          placements: [
            {
              id: "backplane_1",
              symbolId: "__generated_backplane__",
              versionId: "generated_backplane_v1",
              role: "other",
              tag: "Backplane",
              x: 20,
              y: 20,
              rotation: 0,
              scale: 1,
              layoutKind: "backplane",
              layoutDimensions: { lengthMm: 250, widthMm: 250 }
            },
            {
              id: "rail_1",
              symbolId: "rail_symbol",
              versionId: "rail_symbol_v1",
              role: "other",
              tag: "DIN Rail",
              x: 30,
              y: 30,
              rotation: 0,
              scale: 1,
              layoutKind: "layout_helper",
              layoutParentId: "backplane_1",
              layoutPosition: { xMm: 20, yMm: 30 },
              layoutDimensions: { lengthMm: 100, widthMm: 20 }
            },
            {
              id: "dimension_1",
              symbolId: "__generated_horizontal_dimension__",
              versionId: "generated_horizontal_dimension_v1",
              role: "other",
              tag: "Horizontal Dimension",
              x: 30,
              y: 25,
              rotation: 0,
              scale: 1,
              layoutKind: "layout_helper",
              layoutParentId: "backplane_1",
              layoutPosition: { xMm: 20, yMm: 10 },
              layoutDimensions: { lengthMm: 100, widthMm: 8 },
              layoutDimension: {
                orientation: "horizontal",
                startMm: 20,
                endMm: 120,
                offsetMm: 10,
                startWitnessMm: 30,
                endWitnessMm: 30,
                startAttachment: {
                  targetKind: "placement",
                  placementId: "rail_1",
                  edge: "left",
                  ratio: 0
                }
              }
            }
          ]
        }
      ]
    };
    const result = duplicateSheet(model, source.id);
    const duplicate = result.model.sheets[1];
    const duplicatedRail = duplicate.placements.find(
      (placement) => placement.symbolId === "rail_symbol"
    );
    const duplicatedDimension = duplicate.placements.find(
      (placement) =>
        placement.symbolId === "__generated_horizontal_dimension__"
    );

    expect(duplicatedDimension?.layoutDimension?.startAttachment?.placementId)
      .toBe(duplicatedRail?.id);
    expect(duplicatedDimension?.layoutDimension?.startAttachment?.placementId)
      .not.toBe("rail_1");
  });

  it("duplicates generated terminal blocks as new globally numbered assets", () => {
    const base = createDefaultDrawingModel();
    const terminalBlock = createTerminalBlockPlacement({
      model: base,
      activeSheet: base.sheets[0],
      assetId: "asset_tb_101",
      tag: "TB-101"
    });
    const model: DrawingModel = {
      ...base,
      sheets: [
        {
          ...base.sheets[0],
          placements: [terminalBlock]
        }
      ]
    };

    const result = duplicateSheet(model, "sheet_1", []);
    const duplicate = result.model.sheets[1];

    expect(duplicate.placements[0]).toMatchObject({
      tag: "TB-102",
      role: "terminal_block"
    });
    expect(duplicate.placements[0].assetId).not.toBe("asset_tb_101");
  });

  it("adapts active package sheets to and from canvas models", () => {
    const model = populatedPackageModel();
    const canvasModel = toSheetCanvasModel(model, "sheet_1");
    const nextCanvasModel = {
      ...canvasModel,
      placements: [
        ...canvasModel.placements,
        {
          id: "device_2",
          symbolId: "sym_1",
          versionId: "ver_1",
          role: "device" as const,
          tag: "TT-102",
          x: 120,
          y: 40,
          rotation: 0,
          scale: 1
        }
      ]
    };
    const replaced = replaceSheetFromCanvasModel(
      model,
      "sheet_1",
      nextCanvasModel
    );
    const titled = updatePackageTitleBlock(replaced, { revision: "B" });

    expect(canvasModel.sheet.titleBlock.drawingNumber).toBe("EI-001");
    expect(replaced.sheets[0].placements).toHaveLength(3);
    expect(titled.titleBlock.revision).toBe("B");
    expect(titled.sheets[0].page).toEqual(model.sheets[0].page);
  });

  it("moves a sheet directly to the end", () => {
    const initial = createDefaultDrawingModel();
    const second = addSheet(initial, "Second");
    const third = addSheet(second.model, "Third");
    const moved = moveSheetToEnd(third.model, "sheet_1");

    expect(moved.sheets.map((sheet) => sheet.name)).toEqual([
      "Second",
      "Third",
      "Sheet 1"
    ]);
    expect(moveSheetToEnd(moved, "sheet_1")).toBe(moved);
  });
});
