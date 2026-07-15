import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel } from "../data/schema";
import {
  containsDetailedPanelDrawings,
  hasDetailedPanelMutation
} from "../logic/services/drawing-detailed-panel-release";

function modelWithDetailedPanel() {
  const model = createDefaultDrawingModel();
  return {
    ...model,
    assets: [
      ...(model.assets ?? []),
      {
        id: "panel_asset",
        tag: "P-001",
        title: "Panel 001",
        type: "panel" as const
      }
    ],
    sheets: model.sheets.map((sheet) => ({
      ...sheet,
      panelDrawingContext: {
        kind: "detailed_panel_wiring" as const,
        panelAssetId: "panel_asset"
      }
    }))
  };
}

describe("Detailed Panel release control", () => {
  it("allows unrelated field-sheet changes while protecting panel data", () => {
    const detailed = modelWithDetailedPanel();
    const fieldSheet = {
      ...detailed.sheets[0],
      id: "field_sheet",
      name: "Field Sheet",
      panelDrawingContext: undefined
    };
    const previous = { ...detailed, sheets: [...detailed.sheets, fieldSheet] };
    const fieldEdit = {
      ...previous,
      sheets: previous.sheets.map((sheet) =>
        sheet.id === fieldSheet.id ? { ...sheet, description: "Edited" } : sheet
      )
    };
    const panelEdit = {
      ...previous,
      sheets: previous.sheets.map((sheet) =>
        sheet.panelDrawingContext ? { ...sheet, description: "Blocked" } : sheet
      )
    };

    expect(containsDetailedPanelDrawings(previous)).toBe(true);
    expect(hasDetailedPanelMutation(previous, fieldEdit)).toBe(false);
    expect(hasDetailedPanelMutation(previous, panelEdit)).toBe(true);
  });

  it("protects canonical panel wiring and referenced asset identity", () => {
    const previous = modelWithDetailedPanel();
    const assetEdit = {
      ...previous,
      assets: previous.assets?.map((asset) =>
        asset.id === "panel_asset" ? { ...asset, tag: "P-999" } : asset
      )
    };
    const wiringEdit = {
      ...previous,
      panelWiring: {
        schemaVersion: 1 as const,
        terminalMappings: [],
        internalWires: [],
        bridges: [],
        bonds: []
      }
    };

    expect(hasDetailedPanelMutation(previous, assetEdit)).toBe(true);
    expect(hasDetailedPanelMutation(previous, wiringEdit)).toBe(true);
  });
});
