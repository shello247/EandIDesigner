import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelQualityIndex,
  runPanelDrawingQualityChecks
} from "@/features/drawing_panel_wiring/api/public";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema
} from "../data/schema";
import {
  applyApprovedPanelRepair,
  navigateToPanelFinding
} from "../logic/commands/drawing-panel-review-commands";
import type { ApprovedDrawingSymbol } from "../types";

const PANEL_ID = "asset_panel_review";
const SHEET_ID = "sheet_panel_review";

const symbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_review_device",
  versionId: "version_review_device",
  versionNumber: 1,
  symbolKey: "review_device",
  displayName: "Review Device",
  category: "instrument",
  svg: '<svg viewBox="0 0 100 50"><rect width="100" height="50"/></svg>',
  metadata: {
    symbolKey: "review_device",
    displayName: "Review Device",
    category: "instrument",
    viewBox: { x: 0, y: 0, width: 100, height: 50 },
    anchors: [
      { key: "T1", x: 0, y: 25, kind: "terminal" },
      { key: "T2", x: 100, y: 25, kind: "terminal" }
    ],
    terminals: [
      {
        key: "T1",
        label: "1",
        anchorKey: "T1",
        panelSide: "single",
        requiredForWiring: false
      },
      {
        key: "T2",
        label: "2",
        anchorKey: "T2",
        panelSide: "single",
        requiredForWiring: false
      }
    ]
  }
};

function fixture() {
  const base = createDefaultDrawingModel();
  const sheet = {
    ...createDefaultDrawingSheet({ id: SHEET_ID, name: "Panel Review" }),
    panelDrawingContext: {
      kind: "detailed_panel_wiring" as const,
      panelAssetId: PANEL_ID
    },
    placements: [
      {
        id: "placement_review_a",
        assetId: "asset_review_a",
        containerAssetId: PANEL_ID,
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device" as const,
        tag: "K-101",
        x: 80,
        y: 80,
        rotation: 0,
        scale: 0.5
      },
      {
        id: "placement_review_b",
        assetId: "asset_review_b",
        containerAssetId: PANEL_ID,
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "device" as const,
        tag: "K-102",
        x: 220,
        y: 80,
        rotation: 0,
        scale: 0.5
      }
    ],
    connections: [
      {
        id: "connection_orphan",
        from: { placementId: "placement_review_a", anchorKey: "T2" },
        to: { placementId: "placement_review_b", anchorKey: "T1" },
        panelConnectionId: "internal_wire_missing"
      }
    ]
  };
  return drawingPackageModelSchema.parse({
    ...base,
    assets: [
      { id: PANEL_ID, tag: "JB001", type: "junction_box", title: "JB001" },
      {
        id: "asset_review_a",
        tag: "K-101",
        type: "relay",
        title: "Relay A",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId
      },
      {
        id: "asset_review_b",
        tag: "K-102",
        type: "relay",
        title: "Relay B",
        symbolId: symbol.symbolId,
        versionId: symbol.versionId
      }
    ],
    sheets: [sheet]
  });
}

function orphanFinding(model = fixture()) {
  const graph = buildPackageConnectivityGraph(
    createPanelWiringSource(model, [symbol])
  );
  return runPanelDrawingQualityChecks(
    buildPanelQualityIndex({ graph, panelAssetId: PANEL_ID })
  ).findings.find((finding) => finding.code === "orphan_panel_route")!;
}

describe("panel review commands", () => {
  it("removes an explicitly approved orphan route without changing assets", () => {
    const model = fixture();
    const finding = orphanFinding(model);
    const result = applyApprovedPanelRepair({
      model,
      symbols: [symbol],
      finding
    });

    expect(result.model.sheets[0].connections).toEqual([]);
    expect(result.model.assets).toEqual(model.assets);
    expect(result.affectedIds).toContain("connection_orphan");
  });

  it("rejects a stale repair proposal", () => {
    const model = fixture();
    const finding = orphanFinding(model);
    const alreadyRepaired = {
      ...model,
      sheets: [{ ...model.sheets[0], connections: [] }]
    };

    expect(() =>
      applyApprovedPanelRepair({
        model: alreadyRepaired,
        symbols: [symbol],
        finding
      })
    ).toThrow("stale");
  });

  it("removes a stale terminal mapping without changing field routes", () => {
    const base = fixture();
    const model = drawingPackageModelSchema.parse({
      ...base,
      panelWiring: {
        schemaVersion: 1,
        terminalMappings: [
          {
            id: "mapping_stale_review",
            panelAssetId: PANEL_ID,
            source: {
              sheetId: SHEET_ID,
              connectionId: "missing_field_connection",
              endpointRole: "to",
              placementId: "placement_review_a",
              anchorKey: "T1"
            },
            target: {
              assetId: "asset_review_a",
              terminalKey: "T1",
              side: "single"
            },
            origin: "engineer"
          }
        ],
        internalWires: [],
        bridges: [],
        bonds: []
      }
    });
    const graph = buildPackageConnectivityGraph(
      createPanelWiringSource(model, [symbol])
    );
    const finding = runPanelDrawingQualityChecks(
      buildPanelQualityIndex({ graph, panelAssetId: PANEL_ID })
    ).findings.find(
      (candidate) => candidate.code === "stale_terminal_mapping_source"
    )!;
    const result = applyApprovedPanelRepair({
      model,
      symbols: [symbol],
      finding
    });

    expect(result.model.panelWiring?.terminalMappings ?? []).toEqual([]);
    expect(result.model.sheets[0].connections).toEqual(
      model.sheets[0].connections
    );
  });

  it("returns direct sheet-object navigation", () => {
    expect(navigateToPanelFinding(orphanFinding())).toEqual(
      expect.objectContaining({
        kind: "sheet_object",
        location: expect.objectContaining({
          sheetId: SHEET_ID,
          objectId: "connection_orphan"
        })
      })
    );
  });
});
