import { describe, expect, it } from "vitest";
import type { PanelConnectionPatternRecord } from "@/features/drawing_panel_wiring/api/public";
import { createDefaultDrawingModel } from "../data/schema";
import type { ApprovedDrawingSymbol } from "../types";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import { createPanelPatternLegendPlacement } from "../logic/services/drawing-panel-reference-symbols";

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
    anchors: [{ key: "T", x: 40, y: 20, kind: "terminal" }],
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

const terminal = (assetId: string) => ({
  assetId,
  terminalKey: "T",
  side: "single" as const
});

function jumper(): PanelConnectionPatternRecord {
  return {
    recordType: "bridge",
    record: {
      id: "pattern_jumper",
      patternCode: "JMP-001",
      panelAssetId: "panel_1",
      kind: "jumper",
      members: [terminal("asset_a"), terminal("asset_b")],
      domain: "signal",
      definition: {
        topology: "terminal_jumper",
        orderedMembers: [terminal("asset_a"), terminal("asset_b")]
      },
      origin: "engineer"
    }
  };
}

function shield(): PanelConnectionPatternRecord {
  return {
    recordType: "bond",
    record: {
      id: "pattern_shield",
      patternCode: "SH-001",
      panelAssetId: "panel_1",
      kind: "shield",
      endpoints: [
        { kind: "terminal", terminal: terminal("asset_a") },
        {
          kind: "panel_reference",
          panelAssetId: "panel_1",
          referenceKind: "protective_earth"
        }
      ],
      source: terminal("asset_a"),
      target: {
        kind: "panel_reference",
        panelAssetId: "panel_1",
        referenceKind: "protective_earth"
      },
      targetDomain: "protective_earth",
      origin: "engineer"
    }
  };
}

function canvasModel() {
  const model = toSheetCanvasModel(createDefaultDrawingModel(), "sheet_1");
  model.placements = [
    {
      id: "p1",
      assetId: "asset_a",
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
      assetId: "asset_b",
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
  return model;
}

describe("Detailed Panel pattern renderer", () => {
  it("renders a jumper with a canonical pattern label and endpoint bars", () => {
    const model = canvasModel();
    model.connections = [
      {
        id: "route_1",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        panelPatternId: "pattern_jumper",
        panelPatternSegmentId: "pattern_jumper:segment:1"
      }
    ];
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelConnectionPatterns: [jumper()],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain('data-panel-pattern-id="pattern_jumper"');
    expect(svg).toContain("JMP-001");
    expect(svg).toContain('stroke="#172554"');
    expect(svg).toContain('data-route-style="panel-pattern"');
  });

  it("renders the complete Wire ID for a numbered pattern-owned wire", () => {
    const model = canvasModel();
    model.connections = [
      {
        id: "route_1",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        panelConnectionId: "wire_7",
        panelPatternId: "pattern_jumper",
        panelPatternSegmentId: "pattern_jumper:segment:1"
      }
    ];
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelConnectionPatterns: [jumper()],
      panelInternalWires: [
        {
          id: "wire_7",
          wireNumber: 7,
          wireId: "K-101:T(007)"
        }
      ],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain(">K-101:T(007)</text>");
    expect(svg).not.toContain(">007</text>");
  });

  it("renders shield bonds with a dashed technical style", () => {
    const model = canvasModel();
    model.connections = [
      {
        id: "route_1",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        panelPatternId: "pattern_shield",
        panelPatternSegmentId: "pattern_shield:segment:1"
      }
    ];
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelConnectionPatterns: [shield()],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain('stroke-dasharray="3 1.6"');
    expect(svg).toContain("SH-001");
    expect(svg).toContain(">SH</text>");
  });

  it("renders a dynamic legend from represented pattern types", () => {
    const model = canvasModel();
    model.placements.push(createPanelPatternLegendPlacement(model.sheet));
    model.connections = [
      {
        id: "route_1",
        from: { placementId: "p1", anchorKey: "T" },
        to: { placementId: "p2", anchorKey: "T" },
        panelPatternId: "pattern_jumper"
      },
      {
        id: "route_2",
        from: { placementId: "p2", anchorKey: "T" },
        to: { placementId: "p1", anchorKey: "T" },
        panelPatternId: "pattern_shield"
      }
    ];
    const svg = renderDrawingToSvg({
      model,
      approvedSymbols: [symbol],
      panelConnectionPatterns: [jumper(), shield()],
      connectionVisibility: "panel_internal"
    });

    expect(svg).toContain('data-panel-pattern-legend="true"');
    expect(svg).toContain("Terminal jumper");
    expect(svg).toContain("Shield bond");
  });
});
