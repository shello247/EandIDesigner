import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  panelWiringSourcePackageSchema
} from "@/features/drawing_panel_wiring/api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID
} from "@/features/drawing_panel_wiring/tests/fixtures";
import {
  createDefaultDrawingModel,
  drawingAnnotationSchema,
  parseDrawingModelJson,
  stringifyDrawingModel
} from "@/features/drawing_canvas/data/schema";
import { toSheetCanvasModel } from "@/features/drawing_canvas/logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "@/features/drawing_canvas/logic/services/drawing-svg-renderer";
import {
  copySelectionToClipboard,
  pasteClipboardToSheet
} from "@/features/drawing_canvas/logic/services/drawing-clipboard-commands";
import {
  buildConnectedWireScheduleProjection,
  clampConnectedWireScheduleWidth,
  connectedWireScheduleColumnRatiosSchema,
  createConnectedWireScheduleLayout,
  DEFAULT_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIOS,
  defaultConnectedWireSchedulePosition,
  renderConnectedWireScheduleSvg,
  resizeConnectedWireScheduleColumns,
  type ConnectedWireScheduleAnnotation
} from "../api/public";

function terminal(terminalKey: string, side: "single" | "internal") {
  return {
    terminalKey,
    label: terminalKey === "T1" ? "Line 1" : "Load 1",
    function:
      terminalKey === "T1" ? "Supply input" : "Protected output",
    supportedSides: [side],
    anchors: [
      {
        anchorKey: `${terminalKey}_${side}`,
        anchorKind: "terminal" as const,
        sideHint: side,
        physicalPosition: "right" as const
      }
    ],
    status: "resolved" as const
  };
}

function occurrence(input: {
  sheetId: string;
  placementId: string;
  assetId: string;
  tag: string;
}) {
  return {
    ...input,
    role: "device" as const,
    occurrenceKind: "wiring" as const,
    symbolId: `symbol_${input.assetId}`,
    versionId: `version_${input.assetId}`,
    terminalResolutionStatus: "resolved" as const,
    terminals: [terminal("T1", "single"), terminal("T2", "internal")]
  };
}

function createGraph() {
  const source = panelWiringSourcePackageSchema.parse({
    assets: [
      { id: "asset_a", tag: "MCB-101", type: "breaker", title: "Breaker" },
      { id: "asset_b", tag: "PDB-101", type: "terminal_block", title: "Block" },
      { id: "panel_1", tag: "PLC-001", type: "panel", title: "Panel" }
    ],
    sheets: [
      {
        id: "sheet_field",
        sheetNumber: 1,
        name: "Field",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_field",
            placementId: "field_a",
            assetId: "asset_a",
            tag: "MCB-101"
          }),
          occurrence({
            sheetId: "sheet_field",
            placementId: "field_b",
            assetId: "asset_b",
            tag: "PDB-101"
          })
        ],
        connections: [
          {
            id: "field_1",
            sheetId: "sheet_field",
            from: { placementId: "field_a", anchorKey: "T1_single" },
            to: { placementId: "field_b", anchorKey: "T1_single" },
            wireId: "FW-101",
            cableTag: "CBL-101",
            conductorKey: "1",
            label: "Incoming feeder"
          }
        ]
      },
      {
        id: "sheet_overview",
        sheetNumber: 2,
        name: "Overview",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_overview",
            placementId: "overview_a",
            assetId: "asset_a",
            tag: "MCB-101"
          })
        ],
        connections: []
      },
      {
        id: "sheet_internal",
        sheetNumber: 3,
        name: "Internal",
        kind: "drawing",
        occurrences: [
          occurrence({
            sheetId: "sheet_internal",
            placementId: "internal_a",
            assetId: "asset_a",
            tag: "MCB-101"
          }),
          occurrence({
            sheetId: "sheet_internal",
            placementId: "internal_b",
            assetId: "asset_b",
            tag: "PDB-101"
          })
        ],
        connections: [
          {
            id: "internal_route_1",
            sheetId: "sheet_internal",
            from: { placementId: "internal_a", anchorKey: "T2_internal" },
            to: { placementId: "internal_b", anchorKey: "T2_internal" },
            panelConnectionId: "wire_1"
          }
        ]
      }
    ],
    panelWiring: {
      schemaVersion: 1,
      terminalMappings: [],
      internalWires: [
        {
          id: "wire_1",
          panelAssetId: "panel_1",
          wireNumber: 1,
          wireId: "legacy-wire-id",
          from: { assetId: "asset_a", terminalKey: "T2", side: "internal" },
          to: { assetId: "asset_b", terminalKey: "T2", side: "internal" },
          specification: {
            catalogEntryId: "catalog_1",
            catalogEntryName: "Control wire",
            wireType: "MTW",
            size: "18 AWG",
            color: "Blue"
          },
          attributes: { description: "Breaker supply" },
          origin: "engineer"
        }
      ],
      bridges: [],
      bonds: []
    }
  });
  return buildPackageConnectivityGraph(source);
}

function schedule(
  scope: "all_connected" | "sheet_routes" = "all_connected",
  sourcePlacementId = "overview_a"
): ConnectedWireScheduleAnnotation {
  return {
    id: "schedule_1",
    kind: "connected_wire_schedule",
    x: 20,
    y: 30,
    width: 190,
    schedule: {
      assetId: "asset_a",
      sourcePlacementId,
      scope
    }
  };
}

describe("Connected Wire Schedule", () => {
  it("parses additively beside legacy text annotations", () => {
    expect(drawingAnnotationSchema.parse(schedule()).kind).toBe(
      "connected_wire_schedule"
    );
    expect(
      drawingAnnotationSchema.parse({
        id: "note_1",
        kind: "note",
        text: "Legacy note",
        x: 10,
        y: 20
      })
    ).toMatchObject({ kind: "note", text: "Legacy note" });
  });

  it("survives drawing save/load and clipboard duplication without changing its asset link", () => {
    const model = createDefaultDrawingModel();
    model.sheets[0].annotations = [schedule()];
    const reloaded = parseDrawingModelJson(stringifyDrawingModel(model));
    const clipboard = copySelectionToClipboard({
      model: reloaded,
      sheetId: "sheet_1",
      selection: { placementIds: [], annotationIds: ["schedule_1"] }
    });
    expect(clipboard).not.toBeNull();
    const pasted = pasteClipboardToSheet({
      model: reloaded,
      sheetId: "sheet_1",
      clipboard: clipboard!,
      symbols: [],
      idPrefix: "schedule_copy"
    });
    const annotations = pasted.model.sheets[0].annotations;

    expect(annotations).toHaveLength(2);
    expect(annotations[0]).toEqual(schedule());
    expect(annotations[1]).toMatchObject({
      id: "ann_schedule_copy_1",
      kind: "connected_wire_schedule",
      schedule: {
        assetId: "asset_a",
        sourcePlacementId: "overview_a",
        scope: "all_connected"
      }
    });
  });

  it("resizes adjacent columns without changing the total table width", () => {
    const resized = resizeConnectedWireScheduleColumns({
      ratios: DEFAULT_CONNECTED_WIRE_SCHEDULE_COLUMN_RATIOS,
      dividerIndex: 1,
      delta: 9.5,
      tableWidth: 190
    });

    expect(resized.wireNumber).toBe(0.08);
    expect(resized.wireId).toBe(0.21);
    expect(resized.from).toBe(0.11);
    expect(resized.to).toBe(0.16);
    expect(
      Object.values(resized).reduce((total, ratio) => total + ratio, 0)
    ).toBeCloseTo(1, 6);
    expect(connectedWireScheduleColumnRatiosSchema.parse(resized)).toEqual(
      resized
    );

    const minimum = resizeConnectedWireScheduleColumns({
      ratios: resized,
      dividerIndex: 0,
      delta: -1000,
      tableWidth: 190
    });
    expect(minimum.wireNumber).toBeCloseTo(1 / 15, 5);
    expect(minimum.wireId).toBeGreaterThan(1 / 15);
  });

  it("persists custom column proportions and scales them with the complete table", () => {
    const customized = schedule();
    customized.schedule.columnRatios = resizeConnectedWireScheduleColumns({
      dividerIndex: 3,
      delta: 19,
      tableWidth: 190
    });
    const model = createDefaultDrawingModel();
    model.sheets[0].annotations = [customized];
    const reloaded = parseDrawingModelJson(stringifyDrawingModel(model));
    const parsed = reloaded.sheets[0].annotations[0];
    expect(parsed).toEqual(customized);
    if (parsed.kind !== "connected_wire_schedule") {
      throw new Error("Expected a connected wire schedule.");
    }

    const projection = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_overview",
      annotation: parsed
    });
    const first = createConnectedWireScheduleLayout({
      annotation: parsed,
      projection,
      sheet: { width: 420, height: 297 }
    });
    const wider = createConnectedWireScheduleLayout({
      annotation: { ...parsed, width: 250 },
      projection,
      sheet: { width: 420, height: 297 }
    });

    expect(first.columns[3].width / first.width).toBeCloseTo(
      wider.columns[3].width / wider.width,
      2
    );
    expect(first.columns[3].width).toBeGreaterThan(first.columns[2].width);
  });

  it("projects canonical field and internal wires with snapshots and descriptions", () => {
    const projection = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_overview",
      annotation: schedule()
    });

    expect(projection.linkedOccurrenceAvailable).toBe(true);
    expect(projection.unresolvedCount).toBe(0);
    expect(projection.rows).toEqual([
      expect.objectContaining({
        canonicalKind: "internal_wire",
        canonicalId: "wire_1",
        wireNumber: 1,
        wireId: "MCB-101:T2(001)",
        from: {
          assetTag: "MCB-101",
          assetTitle: "Breaker",
          terminalKey: "T2",
          terminalLabel: "Load 1",
          terminalFunction: "Protected output"
        },
        to: {
          assetTag: "PDB-101",
          assetTitle: "Block",
          terminalKey: "T2",
          terminalLabel: "Load 1",
          terminalFunction: "Protected output"
        },
        specification: expect.objectContaining({
          name: "Control wire",
          wireType: "MTW",
          size: "18 AWG",
          color: "Blue"
        }),
        description: "Breaker supply"
      }),
      expect.objectContaining({
        canonicalKind: "field_connection",
        canonicalId: "sheet_field:field_1",
        wireId: "FW-101",
        from: {
          assetTag: "MCB-101",
          assetTitle: "Breaker",
          terminalKey: "T1",
          terminalLabel: "Line 1",
          terminalFunction: "Supply input"
        },
        to: {
          assetTag: "PDB-101",
          assetTitle: "Block",
          terminalKey: "T1",
          terminalLabel: "Line 1",
          terminalFunction: "Supply input"
        },
        specification: { name: "CBL-101 / 1" },
        description: "Incoming feeder"
      })
    ]);
  });

  it("filters schedule rows from the linked occurrence display mode", () => {
    const graph = createGraph();
    const project = (
      displayMode:
        | "sheet_only"
        | "internal_connected"
        | "external_connected"
        | "all_connected"
    ) =>
      buildConnectedWireScheduleProjection({
        graph,
        sheetId: "sheet_overview",
        annotation: schedule(),
        displayMode
      }).rows;

    expect(project("sheet_only")).toEqual([]);
    expect(project("internal_connected").map((row) => row.canonicalKind)).toEqual([
      "internal_wire"
    ]);
    expect(project("external_connected").map((row) => row.canonicalKind)).toEqual([
      "field_connection"
    ]);
    expect(project("all_connected").map((row) => row.canonicalKind)).toEqual([
      "internal_wire",
      "field_connection"
    ]);
  });

  it("projects mapped Detailed Panel field terminations into the external schedule", () => {
    const source = createGenericPanelWiringSource();
    const represented = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.assetId === "asset_strip_a"
    )!;
    const detailed = panelWiringSourcePackageSchema.parse({
      ...source,
      sheets: [
        ...source.sheets,
        {
          id: "sheet_detail",
          sheetNumber: source.sheets.length + 1,
          name: "XT-001 Detailed Wiring",
          kind: "drawing",
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: GENERIC_PANEL_ASSET_ID
          },
          occurrences: [
            {
              ...represented,
              sheetId: "sheet_detail",
              placementId: "detail_strip_a"
            }
          ],
          connections: []
        }
      ]
    });
    const projection = buildConnectedWireScheduleProjection({
      graph: buildPackageConnectivityGraph(detailed),
      sheetId: "sheet_detail",
      annotation: {
        ...schedule(),
        schedule: {
          assetId: "asset_strip_a",
          sourcePlacementId: "detail_strip_a",
          scope: "all_connected"
        }
      },
      displayMode: "external_connected"
    });

    expect(projection.rows).toHaveLength(3);
    expect(
      projection.rows.every(
        (row) => row.canonicalKind === "field_connection"
      )
    ).toBe(true);
    expect(projection.rows[0]).toMatchObject({
      from: { assetTag: "CBL-001", terminalKey: "CH1" },
      to: { assetTag: "XT-001", terminalKey: "T1" }
    });
  });

  it("limits sheet-route scope to routes touching the linked occurrence", () => {
    const overview = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_overview",
      annotation: schedule("sheet_routes")
    });
    const internal = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_internal",
      annotation: schedule("sheet_routes", "internal_a")
    });

    expect(overview.rows).toHaveLength(0);
    expect(internal.rows.map((row) => row.canonicalId)).toEqual(["wire_1"]);
  });

  it("fits beside equipment, clamps width, expands rows, and renders non-interactively", () => {
    const annotation = schedule();
    const projection = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_overview",
      annotation
    });
    const position = defaultConnectedWireSchedulePosition({
      sheet: { width: 420, height: 297 },
      placementBounds: { left: 30, right: 70, top: 40 }
    });
    const layout = createConnectedWireScheduleLayout({
      annotation: { ...annotation, ...position },
      projection,
      sheet: { width: 420, height: 297 }
    });
    const svg = renderConnectedWireScheduleSvg({
      layout,
      assetTag: "MCB-101",
      linkedOccurrenceAvailable: true,
      unresolvedCount: 0
    });

    expect(position).toMatchObject({ x: 80, y: 40, width: 190 });
    expect(clampConnectedWireScheduleWidth(60, 420)).toBe(120);
    expect(layout.height).toBeGreaterThan(22);
    expect(svg).toContain('data-connected-wire-schedule="schedule_1"');
    expect(svg).toContain('pointer-events="none"');
    expect(svg).toContain("MCB-101:T2(001)");
    expect(svg).toContain('data-endpoint-detail="from"');
    expect(svg).toContain("Breaker | Load 1 -");
    expect(svg).toContain("Protected output");
    expect(svg).toContain("Block | Line 1 -");
    expect(svg).toContain("Supply input");
    expect(svg).toContain("Incoming feeder");
  });

  it("uses the same derived schedule renderer in drawing SVG output", () => {
    const packageModel = createDefaultDrawingModel();
    packageModel.assets = [
      {
        id: "asset_a",
        tag: "MCB-101",
        type: "breaker",
        title: "Breaker"
      }
    ];
    packageModel.sheets[0].annotations = [schedule()];
    const projection = buildConnectedWireScheduleProjection({
      graph: createGraph(),
      sheetId: "sheet_overview",
      annotation: schedule()
    });
    const svg = renderDrawingToSvg({
      model: toSheetCanvasModel(packageModel, "sheet_1"),
      approvedSymbols: [],
      assets: packageModel.assets,
      connectedWireScheduleProjections: new Map([
        [projection.annotationId, projection]
      ])
    });

    expect(svg).toContain('data-connected-wire-schedule="schedule_1"');
    expect(svg).toContain("CONNECTED WIRE SCHEDULE");
    expect(svg).toContain("MCB-101:T2(001)");
  });
});
