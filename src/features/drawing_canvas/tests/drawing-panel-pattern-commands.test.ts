import { describe, expect, it } from "vitest";
import {
  createEarthTermination,
  createTerminalJumper
} from "@/features/drawing_panel_wiring/api/public";
import type { ApprovedDrawingSymbol } from "../types";
import {
  createDefaultDrawingModel,
  createDefaultDrawingSheet,
  drawingPackageModelSchema
} from "../data/schema";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import {
  addPanelPatternRouteOccurrence,
  createPanelPatternWithRoutes,
  deletePanelPatternAndRoutes,
  removePanelPatternRouteOccurrence,
  restorePanelPatternLegend,
  setPanelPatternLegendVisibility
} from "../logic/commands/drawing-panel-pattern-commands";
import {
  isGeneratedPanelPatternLegendPlacement,
  isGeneratedPanelReferencePlacement
} from "../logic/services/drawing-panel-reference-symbols";
import {
  applySheetDuplicatePlan,
  buildSheetDuplicatePlan
} from "../logic/services/drawing-sheet-duplication";

const PANEL_ID = "asset_panel";
const ASSET_A = "asset_device_a";
const ASSET_B = "asset_device_b";
const SHEET_A = "sheet_detail_a";
const SHEET_B = "sheet_detail_b";

function symbol(): ApprovedDrawingSymbol {
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
          electricalDomains: ["signal", "protective_earth"],
          requiredForWiring: true
        },
        {
          key: "OUT",
          label: "Output",
          anchorKey: "OUT",
          panelSide: "single",
          electricalDomains: ["signal", "protective_earth"],
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

function detailedSheet(id: string, suffix: string) {
  return {
    ...createDefaultDrawingSheet({ id, name: `Detail ${suffix}` }),
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
    sheets: [detailedSheet(SHEET_A, "a"), detailedSheet(SHEET_B, "b")]
  });
}

describe("Detailed Panel pattern commands", () => {
  it("creates a jumper, its visual route, and one generated legend atomically", () => {
    const model = fixture();
    const symbols = [symbol()];
    const domain = createTerminalJumper(createPanelWiringSource(model, symbols), {
      panelAssetId: PANEL_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
        { assetId: ASSET_B, terminalKey: "IN", side: "single" }
      ],
      createdOnSheetId: SHEET_A
    });
    const created = createPanelPatternWithRoutes({
      model,
      symbols,
      sheetId: SHEET_A,
      result: domain
    });
    const sheet = created.model.sheets.find((candidate) => candidate.id === SHEET_A)!;

    expect(created.model.panelWiring?.bridges).toHaveLength(1);
    expect(created.model.panelWiring?.internalWires).toHaveLength(0);
    expect(sheet.connections).toEqual([
      expect.objectContaining({
        panelPatternId: domain.pattern?.record.id,
        panelConnectionId: undefined
      })
    ]);
    expect(sheet.placements.filter(isGeneratedPanelPatternLegendPlacement)).toHaveLength(1);
  });

  it("removes and restores one representation without changing physical identity", () => {
    const model = fixture();
    const symbols = [symbol()];
    const domain = createTerminalJumper(createPanelWiringSource(model, symbols), {
      panelAssetId: PANEL_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
        { assetId: ASSET_B, terminalKey: "IN", side: "single" }
      ]
    });
    const created = createPanelPatternWithRoutes({ model, symbols, sheetId: SHEET_A, result: domain });
    const withoutRoute = removePanelPatternRouteOccurrence({
      model: created.model,
      sheetId: SHEET_A,
      patternId: domain.pattern!.record.id
    });
    const represented = addPanelPatternRouteOccurrence({
      model: withoutRoute,
      symbols,
      sheetId: SHEET_B,
      patternId: domain.pattern!.record.id
    });

    expect(withoutRoute.panelWiring?.bridges[0].id).toBe(domain.pattern?.record.id);
    expect(represented.connections).toHaveLength(1);
    expect(represented.model.panelWiring?.bridges).toHaveLength(1);
  });

  it("creates and reuses a generated PE reference without a physical asset", () => {
    const model = fixture();
    const symbols = [symbol()];
    const domain = createEarthTermination(createPanelWiringSource(model, symbols), {
      panelAssetId: PANEL_ID,
      kind: "protective_earth",
      source: { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
      target: {
        kind: "panel_reference",
        panelAssetId: PANEL_ID,
        referenceKind: "protective_earth"
      },
      targetDomain: "protective_earth"
    });
    const created = createPanelPatternWithRoutes({ model, symbols, sheetId: SHEET_A, result: domain });
    const sheet = created.model.sheets.find((candidate) => candidate.id === SHEET_A)!;
    const reference = sheet.placements.find(isGeneratedPanelReferencePlacement);

    expect(reference?.assetId).toBeUndefined();
    expect(reference?.panelReference?.referenceKind).toBe("protective_earth");
    expect(sheet.connections[0]).toMatchObject({ panelPatternId: domain.pattern?.record.id });
    expect(created.model.assets).toHaveLength(model.assets.length);
  });

  it("hides and restores the generated legend without replacing it", () => {
    const model = fixture();
    const withLegend = restorePanelPatternLegend({ model, sheetId: SHEET_A });
    const legendId = withLegend.sheets
      .find((sheet) => sheet.id === SHEET_A)!
      .placements.find(isGeneratedPanelPatternLegendPlacement)!.id;
    const hidden = setPanelPatternLegendVisibility({
      model: withLegend,
      sheetId: SHEET_A,
      visible: false
    });
    const restored = restorePanelPatternLegend({ model: hidden, sheetId: SHEET_A });
    const legends = restored.sheets
      .find((sheet) => sheet.id === SHEET_A)!
      .placements.filter(isGeneratedPanelPatternLegendPlacement);
    const sourceLegend = createPanelWiringSource(restored, [symbol()])
      .sheets.find((sheet) => sheet.id === SHEET_A)!
      .occurrences.find((occurrence) => occurrence.placementId === legendId);

    expect(legends).toHaveLength(1);
    expect(legends[0].id).toBe(legendId);
    expect(legends[0].panelPatternLegend.visible).toBe(true);
    expect(sourceLegend?.assetId).toBeUndefined();
  });

  it("deletes the canonical pattern and every route but keeps unrelated assets", () => {
    const model = fixture();
    const symbols = [symbol()];
    const domain = createTerminalJumper(createPanelWiringSource(model, symbols), {
      panelAssetId: PANEL_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
        { assetId: ASSET_B, terminalKey: "IN", side: "single" }
      ]
    });
    const created = createPanelPatternWithRoutes({ model, symbols, sheetId: SHEET_A, result: domain });
    const deleted = deletePanelPatternAndRoutes({
      model: created.model,
      symbols,
      patternId: domain.pattern!.record.id
    });

    expect(deleted.panelWiring?.bridges).toHaveLength(0);
    expect(deleted.sheets.flatMap((sheet) => sheet.connections)).toHaveLength(0);
    expect(deleted.assets).toEqual(model.assets);
  });

  it("duplicates visual routes while preserving canonical pattern identity", () => {
    const model = fixture();
    const symbols = [symbol()];
    const domain = createTerminalJumper(createPanelWiringSource(model, symbols), {
      panelAssetId: PANEL_ID,
      topology: "terminal_jumper",
      domain: "signal",
      members: [
        { assetId: ASSET_A, terminalKey: "OUT", side: "single" },
        { assetId: ASSET_B, terminalKey: "IN", side: "single" }
      ]
    });
    const created = createPanelPatternWithRoutes({
      model,
      symbols,
      sheetId: SHEET_A,
      result: domain
    });
    const sourceConnection = created.connections[0];
    const plan = buildSheetDuplicatePlan({
      model: created.model,
      symbols,
      sourceSheetId: SHEET_A
    });
    const duplicated = applySheetDuplicatePlan({
      model: created.model,
      symbols,
      plan
    });
    const duplicateSheet = duplicated.model.sheets.find(
      (sheet) => sheet.id === duplicated.sheetId
    );

    expect(duplicated.model.panelWiring?.bridges).toHaveLength(1);
    expect(duplicateSheet?.connections[0].panelPatternId).toBe(
      domain.pattern?.record.id
    );
    expect(duplicateSheet?.connections[0].id).not.toBe(sourceConnection.id);
  });
});
