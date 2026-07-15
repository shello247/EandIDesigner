import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingModel
} from "../data/schema";
import { addSectionTitlePage } from "../logic/commands/drawing-sheet-commands";
import {
  buildSheetLoaderRows,
  buildSheetLoaderGroups,
  filterSheetLoaderGroups,
  filterSheetLoaderRows
} from "../logic/services/sheet-loader-rows";

describe("sheet loader rows", () => {
  it("summarizes sheet rows with type labels and counts", () => {
    let model = createDefaultDrawingModel("Test Drawing");
    model = {
      ...model,
      sheets: [
        {
          ...model.sheets[0],
          id: "sheet_1",
          name: "Tank 1 Wiring",
          description: "Field wiring",
          placements: [
            {
              id: "pl_asset_1",
              assetId: "asset_tt_101",
              symbolId: "sym_tt",
              versionId: "sym_tt_v1",
              role: "device",
              tag: "TT-101",
              x: 10,
              y: 10,
              rotation: 0,
              scale: 1
            },
            {
              id: "pl_asset_2",
              assetId: "asset_tt_101",
              symbolId: "sym_tt",
              versionId: "sym_tt_v1",
              role: "device",
              tag: "TT-101",
              x: 20,
              y: 20,
              rotation: 0,
              scale: 1
            },
            {
              id: "pl_backplane",
              layoutKind: "backplane",
              symbolId: "__generated_backplane__",
              versionId: "generated_backplane_v1",
              role: "other",
              tag: "Backplane",
              x: 30,
              y: 30,
              rotation: 0,
              scale: 1
            }
          ],
          connections: [
            {
              id: "conn_1",
              from: { placementId: "pl_asset_1", anchorKey: "A" },
              to: { placementId: "pl_asset_2", anchorKey: "B" }
            }
          ]
        }
      ]
    } satisfies DrawingModel;
    const sectionResult = addSectionTitlePage(model, {
      name: "Section A",
      title: "Tank Area",
      subtitle: "",
      sectionNumber: "A"
    });
    model = sectionResult.model;

    expect(buildSheetLoaderRows(model)).toEqual([
      {
        sheetId: "sheet_1",
        sheetNumber: 1,
        name: "Tank 1 Wiring",
        typeLabel: "Drawing",
        description: "Field wiring",
        placementCount: 3,
        assetCount: 1,
        connectionCount: 1
      },
      {
        sheetId: model.sheets[1].id,
        sheetNumber: 2,
        name: "Section A",
        typeLabel: "Section Title",
        description: "",
        placementCount: 0,
        assetCount: 0,
        connectionCount: 0
      }
    ]);
  });

  it("filters sheet rows by number, name, type, and description", () => {
    const rows = [
      {
        sheetId: "sheet_1",
        sheetNumber: 1,
        name: "Tank 1 Wiring",
        typeLabel: "Drawing" as const,
        description: "Field wiring",
        placementCount: 2,
        assetCount: 2,
        connectionCount: 1
      },
      {
        sheetId: "sheet_2",
        sheetNumber: 2,
        name: "Divider",
        typeLabel: "Section Title" as const,
        description: "Tank 2 package",
        placementCount: 0,
        assetCount: 0,
        connectionCount: 0
      }
    ];

    expect(filterSheetLoaderRows(rows, "")).toBe(rows);
    expect(filterSheetLoaderRows(rows, "sheet 2")).toEqual([rows[1]]);
    expect(filterSheetLoaderRows(rows, "wiring")).toEqual([rows[0]]);
    expect(filterSheetLoaderRows(rows, "section")).toEqual([rows[1]]);
    expect(filterSheetLoaderRows(rows, "field")).toEqual([rows[0]]);
  });

  it("uses the saved section subtitle for legacy rows without a sheet description", () => {
    const model = createDefaultDrawingModel("Section Package");
    const sectionResult = addSectionTitlePage(model, {
      name: "Panel Details",
      title: "Panel Details",
      subtitle: "Detailed panel wiring drawings"
    });
    const legacyModel = {
      ...sectionResult.model,
      sheets: sectionResult.model.sheets.map((sheet) =>
        sheet.id === sectionResult.sheetId
          ? { ...sheet, description: undefined }
          : sheet
      )
    };

    expect(buildSheetLoaderRows(legacyModel)[1].description).toBe(
      "Detailed panel wiring drawings"
    );
  });

  it("classifies detailed panel sheets and counts their context asset", () => {
    const model = createDefaultDrawingModel("Panel Package");
    const detailedSheet = {
      ...model.sheets[0],
      name: "JB001 Detailed Panel Drawing",
      panelDrawingContext: {
        kind: "detailed_panel_wiring" as const,
        panelAssetId: "asset_jb_001"
      },
      placements: []
    };
    const rows = buildSheetLoaderRows({
      ...model,
      sheets: [detailedSheet]
    });

    expect(rows[0]).toMatchObject({
      typeLabel: "Detailed Panel",
      assetCount: 1
    });
    expect(filterSheetLoaderRows(rows, "detailed panel")).toEqual(rows);
  });

  it("groups front matter and section members and preserves section context while filtering", () => {
    let model = createDefaultDrawingModel("Grouped Package");
    model = addSectionTitlePage(model, {
      title: "Field Wiring",
      subtitle: "Field connection sheets"
    }).model;
    model = {
      ...model,
      sheets: [
        ...model.sheets,
        {
          ...model.sheets[0],
          id: "field_detail",
          name: "Tank Field Detail",
          description: "Tank 4 wiring"
        }
      ]
    };
    const groups = buildSheetLoaderGroups(model);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      id: "front_matter",
      startSheetNumber: 1,
      endSheetNumber: 1
    });
    expect(groups[1]).toMatchObject({
      kind: "section",
      sectionNumber: 1,
      title: "Field Wiring",
      startSheetNumber: 2,
      endSheetNumber: 3
    });
    expect(groups[1].rows.map((row) => row.sheetId)).toEqual(["field_detail"]);
    expect(filterSheetLoaderGroups(groups, "section 1")).toEqual([groups[1]]);
    expect(filterSheetLoaderGroups(groups, "tank 4")[0].rows).toHaveLength(1);
  });
});
