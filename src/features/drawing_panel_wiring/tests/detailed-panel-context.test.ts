import { describe, expect, it } from "vitest";
import {
  buildCompatiblePanelOptions,
  getDetailedPanelDrawingContext,
  updateDetailedPanelDrawingContext,
  validatePanelDrawingContext
} from "../api/public";
import {
  createGenericPanelWiringSource,
  GENERIC_PANEL_ASSET_ID
} from "./fixtures";

describe("detailed panel drawing context", () => {
  it("builds compatible panel options with source-sheet traceability", () => {
    const source = createGenericPanelWiringSource();
    const options = buildCompatiblePanelOptions(source);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      assetId: GENERIC_PANEL_ASSET_ID,
      tag: "ENC-001",
      title: "Field Enclosure",
      type: "panel"
    });
    expect(options[0]?.sourceSheets.map((sheet) => sheet.sheetNumber)).toEqual([
      1, 2, 3, 4, 5
    ]);
  });

  it("resolves, validates, and updates an explicit panel context", () => {
    const source = createGenericPanelWiringSource();
    const targetSheet = source.sheets[0];
    const updated = {
      ...source,
      sheets: source.sheets.map((sheet) =>
        sheet.id === targetSheet.id
          ? {
              ...sheet,
              panelDrawingContext: {
                kind: "detailed_panel_wiring" as const,
                panelAssetId: GENERIC_PANEL_ASSET_ID
              }
            }
          : sheet
      )
    };

    expect(validatePanelDrawingContext(updated, targetSheet.id)).toEqual([]);
    expect(getDetailedPanelDrawingContext(updated, targetSheet.id)).toMatchObject({
      sheetId: targetSheet.id,
      panelAssetId: GENERIC_PANEL_ASSET_ID,
      purpose: "detailed_panel_wiring"
    });

    expect(
      updateDetailedPanelDrawingContext(source, {
        sheetId: targetSheet.id,
        panelAssetId: GENERIC_PANEL_ASSET_ID
      }).mutations
    ).toEqual([
      {
        kind: "set-panel-context",
        sheetId: targetSheet.id,
        context: {
          kind: "detailed_panel_wiring",
          panelAssetId: GENERIC_PANEL_ASSET_ID
        }
      }
    ]);
  });

  it("reports missing and incompatible panel contexts without guessing", () => {
    const source = createGenericPanelWiringSource();
    const sheet = source.sheets[0];
    const invalid = {
      ...source,
      sheets: source.sheets.map((candidate) =>
        candidate.id === sheet.id
          ? {
              ...candidate,
              panelDrawingContext: {
                kind: "detailed_panel_wiring" as const,
                panelAssetId: "asset_missing"
              }
            }
          : candidate
      )
    };

    expect(validatePanelDrawingContext(source, sheet.id)[0]?.code).toBe(
      "missing_detailed_panel_context"
    );
    expect(validatePanelDrawingContext(invalid, sheet.id)[0]?.code).toBe(
      "invalid_detailed_panel_asset"
    );
  });
});
