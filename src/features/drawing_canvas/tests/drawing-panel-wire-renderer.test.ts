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
});
