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
      panelInternalWires: [
        {
          id: "wire_record_1",
          wireNumber: 7,
          wireId: "K-101:T(007)"
        }
      ],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain('data-panel-wire-id="wire_record_1"');
    expect(svg).toContain(">K-101:T(007)</text>");
    expect(svg).not.toContain(">007</text>");
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
      placementWireContextRows: [
        {
          placementId: "p1",
          anchorKey: "T",
          physicalPosition: "right",
          canonicalKind: "field_connection",
          canonicalId: "field_sheet_1:field_connection_1",
          fieldConnectionId: "field_connection_1",
          externalTerminationId: "external_termination_1",
          direction: "incoming",
          wireId: "FIELD-W101",
          cableTag: "CBL-101",
          conductorKey: "1",
          oppositeEndpoint: { assetTag: "FIELD-K101", terminalKey: "T" },
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

  it("renders connected-wiring context as non-interactive field and internal stubs", () => {
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
        scale: 1,
        connectionDisplayMode: "all_connected"
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      placementWireContextRows: [
        {
          placementId: "p1",
          anchorKey: "T",
          physicalPosition: "right",
          canonicalKind: "field_connection",
          canonicalId: "sheet_2:field_1",
          direction: "incoming",
          wireId: "FIELD-101",
          oppositeEndpoint: { assetTag: "JB-101", terminalKey: "3" },
          sourceSheet: { id: "sheet_2", number: 2, name: "Field Wiring" }
        },
        {
          placementId: "p1",
          anchorKey: "T",
          physicalPosition: "left",
          canonicalKind: "internal_wire",
          canonicalId: "wire_1",
          direction: "outgoing",
          wireId: "K-101:T(001)",
          oppositeEndpoint: { assetTag: "PLC-101", terminalKey: "I-00" }
        }
      ]
    });

    expect(svg).toContain('data-placement-wire-context="true"');
    expect(svg).toContain('pointer-events="none"');
    expect(svg).toContain('data-field-connection-key="sheet_2:field_1"');
    expect(svg).toContain('data-panel-wire-id="wire_1"');
    expect(svg).toContain("Incoming FIELD-101 / From JB-101:3");
    expect(svg).toContain("Outgoing K-101:T(001) / To PLC-101:I-00");
    expect(svg).toContain('stroke="#0f766e"');
    expect(svg).toContain('stroke="#1f4e79"');
  });

  it("rotates physical stub direction without changing canonical wire identity", () => {
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
        rotation: 90,
        scale: 1,
        connectionDisplayMode: "internal_connected"
      }
    ];

    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      placementWireContextRows: [
        {
          placementId: "p1",
          anchorKey: "T",
          physicalPosition: "right",
          canonicalKind: "internal_wire",
          canonicalId: "wire_rotated",
          direction: "outgoing",
          wireId: "K-101:T(001)",
          oppositeEndpoint: { assetTag: "PLC-101", terminalKey: "I-00" }
        }
      ]
    });

    expect(svg).toContain('data-panel-wire-id="wire_rotated"');
    expect(svg).toContain('x1="70" y1="100" x2="70" y2="132"');
  });
});
