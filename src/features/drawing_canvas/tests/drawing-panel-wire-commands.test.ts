import { describe, expect, it } from "vitest";
import type { ApprovedDrawingSymbol } from "../types";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema
} from "../data/schema";
import {
  addInternalWireRouteOccurrence,
  createInternalPanelWireRoute,
  deleteInternalWireAndRoutes,
  deleteInternalWireRouteOccurrence,
  updateInternalPanelWireCommand
} from "../logic/commands/drawing-panel-wire-commands";

const PANEL_ID = "asset_panel";
const ASSET_A = "asset_device_a";
const ASSET_B = "asset_device_b";
const SHEET_A = "sheet_detail_a";
const SHEET_B = "sheet_detail_b";

function deviceSymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: "symbol_device",
    versionId: "version_device",
    versionNumber: 1,
    symbolKey: "panel_device",
    displayName: "Panel Device",
    category: "instrument",
    svg: '<svg viewBox="0 0 100 80"><rect width="100" height="80"/></svg>',
    metadata: {
      symbolKey: "panel_device",
      displayName: "Panel Device",
      category: "instrument",
      viewBox: { x: 0, y: 0, width: 100, height: 80 },
      anchors: [
        { key: "IN", x: 0, y: 40, kind: "terminal" },
        { key: "OUT", x: 100, y: 40, kind: "terminal" }
      ],
      terminals: [
        {
          key: "IN",
          label: "Input",
          anchorKey: "IN",
          panelSide: "single",
          requiredForWiring: true
        },
        {
          key: "OUT",
          label: "Output",
          anchorKey: "OUT",
          panelSide: "single",
          requiredForWiring: true
        }
      ],
      panelWiring: { assetType: "relay", tagPrefix: "K" }
    }
  };
}

function placement(id: string, assetId: string, tag: string, x: number) {
  return {
    id,
    assetId,
    containerAssetId: PANEL_ID,
    symbolId: "symbol_device",
    versionId: "version_device",
    role: "device" as const,
    tag,
    title: tag,
    x,
    y: 70,
    rotation: 0,
    scale: 0.5
  };
}

function detailedSheet(id: string, name: string, suffix: string) {
  return {
    ...createDefaultDrawingSheet({ id, name }),
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: PANEL_ID
    },
    placements: [
      placement(`placement_a_${suffix}`, ASSET_A, "K-101", 50),
      placement(`placement_b_${suffix}`, ASSET_B, "K-102", 170)
    ]
  };
}

function fixture() {
  const base = createDefaultDrawingModel();
  return drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: PANEL_ID, tag: "JB001", type: "junction_box", title: "JB001" },
      {
        id: ASSET_A,
        tag: "K-101",
        type: "relay",
        title: "Relay 1",
        symbolId: "symbol_device",
        versionId: "version_device"
      },
      {
        id: ASSET_B,
        tag: "K-102",
        type: "relay",
        title: "Relay 2",
        symbolId: "symbol_device",
        versionId: "version_device"
      }
    ],
    sheets: [
      detailedSheet(SHEET_A, "Panel Detail A", "a"),
      detailedSheet(SHEET_B, "Panel Detail B", "b")
    ]
  });
}

describe("Detailed Panel internal-wire commands", () => {
  it("creates one physical wire and one visual route atomically", () => {
    const symbol = deviceSymbol();
    const result = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [symbol],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" }
    });

    expect(result.wire.wireId).toBe("JB001-W001");
    expect(result.model.panelWiring?.internalWires).toEqual([result.wire]);
    expect(
      result.model.sheets.find((sheet) => sheet.id === SHEET_A)?.connections
    ).toEqual([
      expect.objectContaining({ panelConnectionId: result.wire.id })
    ]);
    expect(result.connection.wireId).toBeUndefined();
  });

  it("persists engineer-authored Detailed Panel waypoints as one manual route", () => {
    const symbol = deviceSymbol();
    const waypoints = [
      { id: "bend_1", x: 110, y: 130 },
      { id: "bend_2", x: 150, y: 130 }
    ];
    const result = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [symbol],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" },
      routeWaypoints: waypoints
    });

    expect(result.connection.route?.mode).toBe("manual");
    expect(result.connection.route?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 110, y: 130 }),
        expect.objectContaining({ x: 150, y: 130 })
      ])
    );
    expect(result.model.panelWiring?.internalWires).toEqual([result.wire]);
    expect(
      result.model.sheets.find((sheet) => sheet.id === SHEET_A)?.connections
    ).toEqual([result.connection]);
  });

  it("keeps Detailed Panel routes automatic when no waypoint is authored", () => {
    const result = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [deviceSymbol()],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" },
      routeWaypoints: []
    });

    expect(result.connection.route?.mode).toBe("auto");
  });

  it("updates canonical properties and keeps route occurrences lightweight", () => {
    const symbol = deviceSymbol();
    const created = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [symbol],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" }
    });
    const updated = updateInternalPanelWireCommand({
      model: created.model,
      symbols: [symbol],
      id: created.wire.id,
      wireId: "JB001-W050",
      attributes: { color: "BU", size: "1.5 mm2" }
    });

    expect(updated.panelWiring?.internalWires[0]).toMatchObject({
      wireId: "JB001-W050",
      attributes: { color: "BU", size: "1.5 mm2" }
    });
    expect(
      updated.sheets.find((sheet) => sheet.id === SHEET_A)?.connections[0]
    ).not.toHaveProperty("wireId");
  });

  it("removes a route without deleting the physical wire, then re-represents it", () => {
    const symbol = deviceSymbol();
    const created = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [symbol],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" }
    });
    const withoutRoute = deleteInternalWireRouteOccurrence({
      model: created.model,
      sheetId: SHEET_A,
      connectionId: created.connection.id
    });
    const represented = addInternalWireRouteOccurrence({
      model: withoutRoute,
      symbols: [symbol],
      sheetId: SHEET_B,
      wireRecordId: created.wire.id
    });

    expect(withoutRoute.panelWiring?.internalWires).toHaveLength(1);
    expect(
      represented.model.sheets.find((sheet) => sheet.id === SHEET_B)?.connections
    ).toEqual([
      expect.objectContaining({ panelConnectionId: created.wire.id })
    ]);
  });

  it("deletes the physical wire and every route occurrence", () => {
    const symbol = deviceSymbol();
    const created = createInternalPanelWireRoute({
      model: fixture(),
      symbols: [symbol],
      sheetId: SHEET_A,
      from: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      to: { assetId: ASSET_B, terminalKey: "IN", side: "single" }
    });
    const represented = addInternalWireRouteOccurrence({
      model: created.model,
      symbols: [symbol],
      sheetId: SHEET_B,
      wireRecordId: created.wire.id
    });
    const deleted = deleteInternalWireAndRoutes({
      model: represented.model,
      symbols: [symbol],
      wireRecordId: created.wire.id
    });

    expect(deleted.panelWiring?.internalWires).toHaveLength(0);
    expect(deleted.sheets.flatMap((sheet) => sheet.connections)).toHaveLength(0);
  });

});
