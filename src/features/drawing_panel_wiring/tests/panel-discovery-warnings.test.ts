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

describe("panel discovery warnings", () => {
  it("disables assets whose electrical terminal metadata is unavailable", () => {
    const source = createGenericPanelWiringSource();
    const targetAssetId = GENERIC_TERMINAL_ASSET_IDS[0];
    const graph = buildPackageConnectivityGraph({
      ...source,
      sheets: source.sheets.map((sheet) => ({
        ...sheet,
        occurrences: sheet.occurrences.map((occurrence) =>
          occurrence.assetId === targetAssetId
            ? {
                ...occurrence,
                terminalResolutionStatus: "missing_metadata" as const,
                terminalResolutionMessage: "No terminal metadata.",
                terminals: []
              }
            : occurrence
        )
      }))
    });
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });

    expect(index.assetsById.get(targetAssetId)).toMatchObject({
      status: "unsupported",
      disabledReason: "No terminal metadata."
    });
    expect(
      index.warnings.some(
        (warning) => warning.code === "panel_asset_unsupported"
      )
    ).toBe(true);
  });

  it("reports conflicting linked occurrence definitions", () => {
    const source = createGenericPanelWiringSource();
    const targetAssetId = GENERIC_TERMINAL_ASSET_IDS[0];
    const graph = buildPackageConnectivityGraph({
      ...source,
      sheets: source.sheets.map((sheet) => ({
        ...sheet,
        occurrences: sheet.occurrences.map((occurrence) =>
          occurrence.assetId === targetAssetId &&
          occurrence.occurrenceKind === "layout"
            ? { ...occurrence, versionId: "conflicting_version" }
            : occurrence
        )
      }))
    });
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      detailedSheetId: "sheet_detail"
    });

    expect(index.assetsById.get(targetAssetId)?.status).toBe("conflicting");
    expect(
      index.warnings.some(
        (warning) => warning.code === "panel_asset_conflicting"
      )
    ).toBe(true);
  });
});
