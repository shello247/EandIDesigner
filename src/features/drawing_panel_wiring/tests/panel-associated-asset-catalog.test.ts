import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID,
  GENERIC_TERMINAL_ASSET_IDS
} from "./fixtures";

describe("panel associated asset catalog", () => {
  it("discovers associated terminal assets without cables or layout helpers", () => {
    const graph = buildPackageConnectivityGraph(
      createGenericPanelWiringSource()
    );
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });
    const rows = [...index.assetsById.values()];

    expect(rows.map((row) => row.assetId)).toEqual(
      GENERIC_TERMINAL_ASSET_IDS
    );
    expect(rows.every((row) => row.status === "available")).toBe(true);
    expect(rows.every((row) => row.terminalCount === 5)).toBe(true);
    expect(
      rows.every(
        (row) =>
          row.terminalUsage.used === 3 &&
          row.terminalUsage.unused === 7 &&
          row.terminalUsage.total === 10
      )
    ).toBe(true);
    expect(rows.every((row) => row.representationSource?.occurrenceKind === "wiring")).toBe(true);
    expect(rows.flatMap((row) => row.sourceOccurrences)).not.toContainEqual(
      expect.objectContaining({ placementId: "layout_rail" })
    );
  });

  it("uses a resolved panel-layout occurrence when no wiring occurrence exists", () => {
    const source = createGenericPanelWiringSource();
    const targetAssetId = GENERIC_TERMINAL_ASSET_IDS[0];
    const graph = buildPackageConnectivityGraph({
      ...source,
      sheets: source.sheets.filter((sheet) => sheet.id !== "sheet_field_1")
    });
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });

    expect(index.assetsById.get(targetAssetId)).toMatchObject({
      status: "available",
      terminalCount: 5,
      terminalUsage: {
        used: 0,
        unused: 10,
        total: 10
      },
      representationSource: {
        sheetId: "sheet_layout",
        placementId: "layout_strip_1",
        occurrenceKind: "layout"
      }
    });
  });

  it("marks an existing detailed-panel occurrence as represented", () => {
    const source = createGenericPanelWiringSource();
    const sourceOccurrence = source.sheets[0].occurrences.find(
      (occurrence) => occurrence.assetId === GENERIC_TERMINAL_ASSET_IDS[0]
    );
    const graph = buildPackageConnectivityGraph({
      ...source,
      sheets: [
        ...source.sheets,
        {
          id: "sheet_detail",
          sheetNumber: source.sheets.length + 1,
          name: "Detailed Panel",
          kind: "drawing",
          panelDrawingContext: {
            kind: "detailed_panel_wiring",
            panelAssetId: GENERIC_PANEL_ASSET_ID
          },
          occurrences: sourceOccurrence
            ? [
                {
                  ...sourceOccurrence,
                  sheetId: "sheet_detail",
                  placementId: "detail_strip_a"
                }
              ]
            : [],
          connections: []
        }
      ]
    });
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });

    expect(index.assetsById.get(GENERIC_TERMINAL_ASSET_IDS[0])).toMatchObject({
      status: "represented",
      representedPlacementId: "detail_strip_a"
    });
  });
});
