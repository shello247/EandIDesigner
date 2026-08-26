import { describe, expect, it } from "vitest";
import { isConnectedWireScheduleAnnotation } from "@/features/drawing_connected_wire_schedule/api/public";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema,
  type DrawingModel
} from "../data/schema";
import {
  createOrSynchronizeConnectedWireScheduleContinuations,
  removeConnectedWireSchedulePagination
} from "../logic/commands/drawing-connected-wire-schedule-continuation-commands";
import { updateDrawingConnectionDisplayMode } from "../logic/commands/drawing-connection-display-commands";
import { placePanelAssetOccurrence } from "../logic/commands/drawing-panel-occurrence-commands";
import { createTerminalBlockPlacement } from "../logic/services/drawing-terminal-blocks";

const PANEL_ID = "asset_panel_1";
const SOURCE_ASSET_ID = "asset_pdb_101";
const TARGET_ASSET_ID = "asset_loads";
const DETAIL_SHEET_ID = "sheet_detail";
const SCHEDULE_ID = "schedule_1";

function createFixture(connectionCount = 25): DrawingModel {
  const base = createDefaultDrawingModel("Continuation Test");
  const fieldSheet = createDefaultDrawingSheet({
    id: "sheet_field",
    name: "Panel Wiring"
  });
  const sourcePlacement = createTerminalBlockPlacement({
    model: base,
    activeSheet: fieldSheet,
    assetId: SOURCE_ASSET_ID,
    tag: "PDB-101",
    x: 40,
    y: 40,
    terminalBlock: { count: connectionCount }
  });
  const targetPlacement = createTerminalBlockPlacement({
    model: base,
    activeSheet: fieldSheet,
    assetId: TARGET_ASSET_ID,
    tag: "LOAD-101",
    x: 180,
    y: 40,
    terminalBlock: { count: connectionCount }
  });
  const model = drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: PANEL_ID, tag: "PLC-001", type: "panel", title: "PLC Panel" },
      {
        id: SOURCE_ASSET_ID,
        tag: "PDB-101",
        type: "terminal_block",
        title: "110 VAC Distribution Block",
        symbolId: sourcePlacement.symbolId,
        versionId: sourcePlacement.versionId,
        terminalBlock: sourcePlacement.terminalBlock
      },
      {
        id: TARGET_ASSET_ID,
        tag: "LOAD-101",
        type: "terminal_block",
        title: "Loads",
        symbolId: targetPlacement.symbolId,
        versionId: targetPlacement.versionId,
        terminalBlock: targetPlacement.terminalBlock
      }
    ],
    sheets: [
      {
        ...fieldSheet,
        placements: [
          { ...sourcePlacement, containerAssetId: PANEL_ID },
          { ...targetPlacement, containerAssetId: PANEL_ID }
        ],
        connections: Array.from({ length: connectionCount }, (_, index) => ({
          id: `connection_${index + 1}`,
          from: {
            placementId: sourcePlacement.id,
            anchorKey: `T${index + 1}_BOTTOM`
          },
          to: {
            placementId: targetPlacement.id,
            anchorKey: `T${index + 1}_BOTTOM`
          },
          wireId: `W-${index + 1}`,
          label: `Distribution wire ${index + 1}`
        }))
      },
      {
        ...createDefaultDrawingSheet({
          id: DETAIL_SHEET_ID,
          name: "PDB-101 Wiring"
        }),
        description: "Detailed wiring for PDB-101",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: PANEL_ID
        }
      }
    ]
  });
  const placed = placePanelAssetOccurrence({
    model,
    sheetId: DETAIL_SHEET_ID,
    assetId: SOURCE_ASSET_ID
  });

  return drawingPackageModelSchema.parse({
    ...placed.model,
    sheets: placed.model.sheets.map((sheet) =>
      sheet.id === DETAIL_SHEET_ID
        ? {
            ...sheet,
            placements: sheet.placements.map((placement) =>
              placement.id === placed.placement.id
                ? {
                    ...placement,
                    x: 30,
                    y: 35,
                    deviceTitlePosition: { x: 30, y: 25 }
                  }
                : placement
            ),
            annotations: [
              {
                id: SCHEDULE_ID,
                kind: "connected_wire_schedule",
                x: 210,
                y: 20,
                width: 190,
                schedule: {
                  assetId: SOURCE_ASSET_ID,
                  sourcePlacementId: placed.placement.id,
                  scope: "all_connected"
                }
              }
            ]
          }
        : sheet
    )
  });
}

function deterministicIds() {
  let index = 0;
  return (prefix: string) => `${prefix}_${++index}`;
}

function continuationSheets(model: DrawingModel) {
  return model.sheets.filter((sheet) =>
    sheet.annotations.some(
      (annotation) =>
        isConnectedWireScheduleAnnotation(annotation) &&
        (annotation.schedule.pagination?.pageIndex ?? 0) > 0
    )
  );
}

describe("Connected Wire Schedule continuation commands", () => {
  it("creates independent continuation occurrences without cloning engineering records", () => {
    const model = createFixture();
    const result = createOrSynchronizeConnectedWireScheduleContinuations({
      model,
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const pages = continuationSheets(result.model);

    expect(result.pageCount).toBe(3);
    expect(result.createdSheetIds).toHaveLength(2);
    expect(result.removedSheetIds).toEqual([]);
    expect(pages).toHaveLength(2);
    expect(result.model.assets).toEqual(model.assets);
    expect(result.model.panelWiring).toEqual(model.panelWiring);
    expect(pages.every((sheet) => sheet.connections.length === 0)).toBe(true);
    expect(
      pages.every(
        (sheet) =>
          sheet.panelDrawingContext?.panelAssetId === PANEL_ID &&
          sheet.placements.length === 1 &&
          sheet.placements[0].assetId === SOURCE_ASSET_ID
      )
    ).toBe(true);
    expect(
      pages.every(
        (sheet) =>
          sheet.placements[0].connectionDisplayMode === "external_connected"
      )
    ).toBe(true);
    expect(new Set(pages.flatMap((sheet) => sheet.placements.map((item) => item.id))).size).toBe(2);
    expect(
      pages.map((sheet) => ({
        x: sheet.placements[0].x,
        y: sheet.placements[0].y,
        title: sheet.placements[0].deviceTitlePosition
      }))
    ).toEqual([
      { x: 30, y: 35, title: { x: 30, y: 25 } },
      { x: 30, y: 35, title: { x: 30, y: 25 } }
    ]);
  });

  it("synchronizes one display-mode change across continuation occurrences and schedules", () => {
    const paginated = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const sourceSheet = paginated.model.sheets.find(
      (sheet) => sheet.id === DETAIL_SHEET_ID
    )!;
    const sourceSchedule = sourceSheet.annotations.find(
      isConnectedWireScheduleAnnotation
    )!;
    const updated = updateDrawingConnectionDisplayMode({
      model: paginated.model,
      sheetId: DETAIL_SHEET_ID,
      placementId: sourceSchedule.schedule.sourcePlacementId,
      mode: "sheet_only"
    });
    const linkedSchedules = updated.sheets.flatMap((sheet) =>
      sheet.annotations
        .filter(isConnectedWireScheduleAnnotation)
        .filter(
          (annotation) =>
            annotation.schedule.pagination?.continuationSetId === "set_1"
        )
        .map((annotation) => ({ sheet, annotation }))
    );

    expect(linkedSchedules).toHaveLength(3);
    expect(
      linkedSchedules.every(
        ({ sheet, annotation }) =>
          annotation.schedule.scope === "sheet_routes" &&
          sheet.placements.find(
            (placement) =>
              placement.id === annotation.schedule.sourcePlacementId
          )?.connectionDisplayMode === "sheet_only"
      )
    ).toBe(true);
  });

  it("synchronizes without duplicating existing pages", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const second = createOrSynchronizeConnectedWireScheduleContinuations({
      model: first.model,
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      createId: deterministicIds()
    });

    expect(second.createdSheetIds).toEqual([]);
    expect(second.removedSheetIds).toEqual([]);
    expect(continuationSheets(second.model)).toHaveLength(2);
  });

  it("removes safe surplus pages when rows per sheet increases", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const second = createOrSynchronizeConnectedWireScheduleContinuations({
      model: first.model,
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 13,
      createId: deterministicIds()
    });

    expect(second.pageCount).toBe(2);
    expect(second.removedSheetIds).toHaveLength(1);
    expect(continuationSheets(second.model)).toHaveLength(1);
  });

  it("creates missing continuation pages when rows per sheet decreases", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 13,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const second = createOrSynchronizeConnectedWireScheduleContinuations({
      model: first.model,
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 8,
      createId: deterministicIds()
    });

    expect(second.pageCount).toBe(4);
    expect(second.createdSheetIds).toHaveLength(2);
    expect(continuationSheets(second.model)).toHaveLength(3);
    expect(
      continuationSheets(second.model).map((sheet) =>
        sheet.annotations.find(isConnectedWireScheduleAnnotation)?.schedule
          .pagination?.pageIndex
      )
    ).toEqual([1, 2, 3]);
  });

  it("blocks surplus cleanup when a generated page contains user content", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const edited: DrawingModel = {
      ...first.model,
      sheets: first.model.sheets.map((sheet) =>
        sheet.id === first.createdSheetIds[1]
          ? {
              ...sheet,
              annotations: [
                ...sheet.annotations,
                { id: "note_1", kind: "note", text: "Keep", x: 10, y: 10 }
              ]
            }
          : sheet
      )
    };
    const before = JSON.stringify(edited);

    expect(() =>
      createOrSynchronizeConnectedWireScheduleContinuations({
        model: edited,
        sourceSheetId: DETAIL_SHEET_ID,
        sourceAnnotationId: SCHEDULE_ID,
        rowsPerPage: 13
      })
    ).toThrow(/contains user changes/i);
    expect(JSON.stringify(edited)).toBe(before);
  });

  it("removes pagination and safe generated pages together", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const removed = removeConnectedWireSchedulePagination({
      model: first.model,
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID
    });
    const source = removed.model.sheets.find((sheet) => sheet.id === DETAIL_SHEET_ID)!;
    const schedule = source.annotations.find(isConnectedWireScheduleAnnotation)!;

    expect(removed.removedSheetIds).toHaveLength(2);
    expect(schedule.schedule.pagination).toBeUndefined();
    expect(continuationSheets(removed.model)).toHaveLength(0);
  });

  it("rejects duplicate page indexes without modifying the input", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const duplicatePage = first.model.sheets.find(
      (sheet) => sheet.id === first.createdSheetIds[0]
    )!;
    const duplicateSchedule = duplicatePage.annotations.find(
      isConnectedWireScheduleAnnotation
    )!;
    const invalid: DrawingModel = {
      ...first.model,
      sheets: first.model.sheets.map((sheet) =>
        sheet.id === duplicatePage.id
          ? {
              ...sheet,
              annotations: [
                ...sheet.annotations,
                { ...duplicateSchedule, id: "duplicate_schedule" }
              ]
            }
          : sheet
      )
    };
    const before = JSON.stringify(invalid);

    expect(() =>
      createOrSynchronizeConnectedWireScheduleContinuations({
        model: invalid,
        sourceSheetId: DETAIL_SHEET_ID,
        sourceAnnotationId: SCHEDULE_ID,
        rowsPerPage: 10
      })
    ).toThrow(/duplicate Part 2/i);
    expect(JSON.stringify(invalid)).toBe(before);
  });

  it("blocks pagination removal when a continuation page was customized", () => {
    const first = createOrSynchronizeConnectedWireScheduleContinuations({
      model: createFixture(),
      sourceSheetId: DETAIL_SHEET_ID,
      sourceAnnotationId: SCHEDULE_ID,
      rowsPerPage: 10,
      continuationSetId: "set_1",
      createId: deterministicIds()
    });
    const customized: DrawingModel = {
      ...first.model,
      sheets: first.model.sheets.map((sheet) =>
        sheet.id === first.createdSheetIds[0]
          ? { ...sheet, name: "Reviewed continuation" }
          : sheet
      )
    };

    expect(() =>
      removeConnectedWireSchedulePagination({
        model: customized,
        sourceSheetId: DETAIL_SHEET_ID,
        sourceAnnotationId: SCHEDULE_ID
      })
    ).toThrow(/prevents removing pagination/i);
  });
});
