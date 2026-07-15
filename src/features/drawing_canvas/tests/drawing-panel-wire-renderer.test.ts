import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";

const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_panel_device",
  versionId: "version_panel_device",
  versionNumber: 1,
  symbolKey: "panel_device",
  displayName: "Panel device",
  category: "instrument",
  svg: '<svg viewBox="0 0 40 40"><rect width="40" height="40"/></svg>',
  metadata: {
    symbolKey: "panel_device",
    displayName: "Panel device",
    category: "instrument",
    viewBox: { x: 0, y: 0, width: 40, height: 40 },
    anchors: [
      { key: "T", x: 40, y: 20, kind: "terminal" }
    ],
    terminals: [
      {
        key: "T",
        label: "Terminal",
        anchorKey: "T",
        panelSide: "single",
        requiredForWiring: true
      }
    ]
  }
};

describe("Detailed Panel internal-wire renderer", () => {
  it("uses the canonical wire label and dedicated engineering style", () => {
    const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
    model.placements = [
      {
        id: "p1",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device",
        tag: "K-101",
        x: 50,
        y: 60,
        rotation: 0,
        scale: 1
      },
      {
        id: "p2",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device",
        tag: "K-102",
        x: 150,
        y: 60,
        rotation: 0,
        scale: 1
      }
    ];
    model.connections = [
      {
        id: "route_1",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        panelConnectionId: "wire_record_1"
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelInternalWires: [{ id: "wire_record_1", wireId: "JB001-W007" }],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain('data-panel-wire-id="wire_record_1"');
    expect(svg).toContain("JB001-W007");
    expect(svg).toContain('stroke="#1f4e79"');
  });

  it("excludes ordinary field connections in panel-only visibility", () => {
    const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
    model.placements = [
      {
        id: "p1",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device",
        tag: "K-101",
        x: 50,
        y: 60,
        rotation: 0,
        scale: 1
      },
      {
        id: "p2",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device",
        tag: "K-102",
        x: 150,
        y: 60,
        rotation: 0,
        scale: 1
      }
    ];
    model.connections = [
      {
        id: "field_route",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        wireId: "FIELD-001"
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      connectionVisibility: "panel_internal"
    });

    expect(svg).not.toContain("FIELD-001");
    expect(svg).not.toContain('data-connection-id="field_route"');
  });

  it("renders derived external field terminations as straight incoming stubs", () => {
    const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
    model.placements = [
      {
        id: "p1",
        assetId: "asset_k101",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device",
        tag: "K-101",
        x: 50,
        y: 60,
        rotation: 0,
        scale: 1
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelExternalTerminations: [
        {
          terminationId: "external_termination_1",
          panelAssetId: "panel_1",
          detailedSheetId: "sheet_1",
          placementId: "p1",
          anchorKey: "T",
          physicalPosition: "right",
          target: {
            assetId: "asset_k101",
            terminalKey: "T",
            side: "single"
          },
          wireId: "FIELD-W101",
          cableTag: "CBL-101",
          conductorKey: "1",
          source: {
            sheetId: "field_sheet_1",
            connectionId: "field_connection_1",
            endpointRole: "to",
            placementId: "field_k101",
            anchorKey: "T"
          },
          sourceSheet: {
            id: "field_sheet_1",
            number: 5,
            name: "K-101 Field Wiring"
          }
        }
      ],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain(
      'data-external-termination-id="external_termination_1"'
    );
    expect(svg).toContain('data-field-connection-id="field_connection_1"');
    expect(svg).toContain('x1="90" y1="80" x2="122" y2="80"');
    expect(svg).toContain("FIELD-W101");
    expect(svg).toContain("Source Sheet 5 - K-101 Field Wiring");
  });
});
