import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelConnectionPatternCatalog,
  buildPanelDiscoveryIndex,
  buildPanelGuidedWorkflowSnapshot,
  buildPanelInternalWireCatalog,
  filterPanelWorkflowRecordsByAsset,
  updatePanelWorkflowFocus
} from "../api/public";
import {
  panelWiringSourcePackageSchema,
  type PanelWiringSourcePackage
} from "../data/schema";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

const DETAIL_SHEET_ID = "sheet_detailed_panel";

function sourceWithDetailedSheet(
  representedAssetIds: string[] = []
): PanelWiringSourcePackage {
  const source = createGenericPanelWiringSource();
  const occurrences = representedAssetIds.map((assetId, index) => {
    const sourceOccurrence = source.sheets
      .flatMap((sheet) => sheet.occurrences)
      .find(
        (occurrence) =>
          occurrence.assetId === assetId && occurrence.occurrenceKind === "wiring"
      )!;

    return {
      ...sourceOccurrence,
      sheetId: DETAIL_SHEET_ID,
      placementId: `detail_strip_${index + 1}`,
      containerAssetId: GENERIC_PANEL_ASSET_ID
    };
  });

  return panelWiringSourcePackageSchema.parse({
    ...source,
    sheets: [
      ...source.sheets,
      {
        id: DETAIL_SHEET_ID,
        sheetNumber: source.sheets.length + 1,
        name: "ENC-001 Detailed Panel Drawing",
        kind: "drawing",
        panelDrawingContext: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID
        },
        occurrences,
        connections: []
      }
    ]
  });
}

function workflow(source: PanelWiringSourcePackage, focusAssetId?: string) {
  const graph = buildPackageConnectivityGraph(source);
  const index = buildPanelDiscoveryIndex({
    graph,
    panelAssetId: GENERIC_PANEL_ASSET_ID,
    detailedSheetId: DETAIL_SHEET_ID
  });
  const internalWires = buildPanelInternalWireCatalog({
    graph,
    panelAssetId: GENERIC_PANEL_ASSET_ID
  });
  const connectionPatterns = buildPanelConnectionPatternCatalog({
    graph,
    panelAssetId: GENERIC_PANEL_ASSET_ID
  });
  return {
    graph,
    index,
    internalWires,
    connectionPatterns,
    snapshot: buildPanelGuidedWorkflowSnapshot({
      index,
      internalWires,
      connectionPatterns,
      persistedFocusAssetId: focusAssetId
    })
  };
}

describe("panel guided workflow", () => {
  it("parses legacy contexts and persists a validated focused asset", () => {
    const source = sourceWithDetailedSheet();
    expect(
      source.sheets.find((sheet) => sheet.id === DETAIL_SHEET_ID)
        ?.panelDrawingContext
    ).toEqual({
      kind: "detailed_panel_wiring",
      panelAssetId: GENERIC_PANEL_ASSET_ID
    });

    const result = updatePanelWorkflowFocus(source, {
      sheetId: DETAIL_SHEET_ID,
      assetId: GENERIC_TERMINAL_ASSET_IDS[0]
    });

    expect(result.warnings).toEqual([]);
    expect(result.mutations).toEqual([
      {
        kind: "set-panel-context",
        sheetId: DETAIL_SHEET_ID,
        context: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID,
          workflowFocusAssetId: GENERIC_TERMINAL_ASSET_IDS[0]
        }
      }
    ]);
  });

  it("rejects a focused asset outside the panel", () => {
    const source = sourceWithDetailedSheet();
    const result = updatePanelWorkflowFocus(source, {
      sheetId: DETAIL_SHEET_ID,
      assetId: `asset_cable_1`
    });

    expect(result.mutations).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      severity: "error",
      code: "focus_asset_outside_panel"
    });
  });

  it("moves an asset from not placed to needs internal wiring", () => {
    const unplaced = workflow(
      sourceWithDetailedSheet(),
      GENERIC_TERMINAL_ASSET_IDS[0]
    ).snapshot;
    const represented = workflow(
      sourceWithDetailedSheet([GENERIC_TERMINAL_ASSET_IDS[0]]),
      GENERIC_TERMINAL_ASSET_IDS[0]
    ).snapshot;

    expect(unplaced.assets[0].status).toBe("not_placed");
    expect(unplaced.nextAction).toEqual({
      kind: "open_step",
      stepId: "place-representation"
    });
    expect(unplaced.steps[0]).toMatchObject({
      id: "place-representation",
      label: "Add Equipment"
    });
    expect(unplaced.steps[1]).toMatchObject({
      id: "review-terminations",
      label: "Review Terminals"
    });
    expect(unplaced.steps.map((step) => step.label)).toEqual([
      "Add Equipment",
      "Review Terminals",
      "Internal Wiring",
      "Review",
      "Deliverables"
    ]);
    expect(unplaced.steps).toHaveLength(5);
    expect(unplaced.steps.map((step) => step.id)).not.toContain(
      "add-connection-patterns"
    );
    expect(represented.assets[0]).toMatchObject({
      status: "needs_internal_wiring",
      terminationCount: 3,
      unresolvedMappingCount: 0,
      requiredConnectionCount: 3,
      missingRequiredConnectionCount: 3
    });
  });

  it("treats layout-only equipment with resolved terminals as not placed", () => {
    const source = sourceWithDetailedSheet();
    const layoutOnlySource = panelWiringSourcePackageSchema.parse({
      ...source,
      sheets: source.sheets.filter((sheet) => sheet.id !== "sheet_field_1")
    });
    const snapshot = workflow(
      layoutOnlySource,
      GENERIC_TERMINAL_ASSET_IDS[0]
    ).snapshot;

    expect(snapshot.assets[0]).toMatchObject({
      assetId: GENERIC_TERMINAL_ASSET_IDS[0],
      status: "not_placed"
    });
    expect(snapshot.assets[0].disabledReason).toBeUndefined();
    expect(snapshot.nextAction).toEqual({
      kind: "open_step",
      stepId: "place-representation"
    });
  });

  it("filters focused records without hiding panel-wide advanced data", () => {
    const state = workflow(
      sourceWithDetailedSheet([
        GENERIC_TERMINAL_ASSET_IDS[0],
        GENERIC_TERMINAL_ASSET_IDS[1]
      ]),
      GENERIC_TERMINAL_ASSET_IDS[0]
    );
    const focused = filterPanelWorkflowRecordsByAsset({
      index: state.index,
      internalWires: state.internalWires,
      connectionPatterns: state.connectionPatterns,
      assetId: GENERIC_TERMINAL_ASSET_IDS[0]
    });

    expect(focused.terminations).toHaveLength(3);
    expect(focused.terminals).toHaveLength(5);
    expect(focused.terminals.every((row) => row.terminal.assetId === GENERIC_TERMINAL_ASSET_IDS[0])).toBe(true);
    expect(state.index.mappingRowsByTerminationId.size).toBe(12);
  });

  it("falls back deterministically when a persisted focus is stale", () => {
    const snapshot = workflow(sourceWithDetailedSheet(), "missing_asset").snapshot;

    expect(snapshot.staleFocusAssetId).toBe("missing_asset");
    expect(snapshot.focusAssetId).toBe(GENERIC_TERMINAL_ASSET_IDS[0]);
    expect(snapshot.nextAction).toEqual({
      kind: "open_step",
      stepId: "place-representation"
    });
  });
});
