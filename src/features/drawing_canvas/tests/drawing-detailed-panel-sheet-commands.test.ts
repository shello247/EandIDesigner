import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingModel
} from "../data/schema";
import { createDetailedPanelDrawingSheet } from "../logic/commands/drawing-detailed-panel-sheet-commands";

function modelWithPanel(): DrawingModel {
  const model = createDefaultDrawingModel("Panel Test");

  return {
    ...model,
    assets: [
      {
        id: "asset_jb_001",
        tag: "JB001",
        type: "junction_box",
        title: "Field Junction Box"
      }
    ]
  };
}

describe("detailed panel sheet commands", () => {
  it("references an existing panel without creating another asset", () => {
    const model = modelWithPanel();
    const result = createDetailedPanelDrawingSheet(model, {
      mode: "reference",
      panelAssetId: "asset_jb_001"
    });
    const sheet = result.model.sheets.find(
      (candidate) => candidate.id === result.sheetId
    );

    expect(result.model.assets).toEqual(model.assets);
    expect(sheet).toMatchObject({
      name: "JB001 Detailed Panel Drawing",
      description: "Detailed electrical connectivity for JB001",
      panelDrawingContext: {
        kind: "detailed_panel_wiring",
        panelAssetId: "asset_jb_001"
      },
      placements: [],
      connections: [],
      annotations: []
    });
  });

  it("creates exactly one unplaced enclosure asset and references it", () => {
    const model = createDefaultDrawingModel("Panel Test");
    const result = createDetailedPanelDrawingSheet(model, {
      mode: "create",
      panelType: "panel",
      tag: "PDP-101",
      title: "Power Distribution Panel"
    });
    const createdAsset = result.model.assets.find(
      (asset) => asset.id === result.panelAssetId
    );
    const sheet = result.model.sheets.find(
      (candidate) => candidate.id === result.sheetId
    );

    expect(result.model.assets).toHaveLength(1);
    expect(createdAsset).toMatchObject({
      tag: "PDP-101",
      type: "panel",
      title: "Power Distribution Panel"
    });
    expect(sheet?.placements).toEqual([]);
    expect(sheet?.panelDrawingContext?.panelAssetId).toBe(createdAsset?.id);
  });

  it("blocks incompatible references and duplicate asset tags", () => {
    const model = modelWithPanel();

    expect(() =>
      createDetailedPanelDrawingSheet(model, {
        mode: "reference",
        panelAssetId: "asset_missing"
      })
    ).toThrow(/compatible panel/i);

    expect(() =>
      createDetailedPanelDrawingSheet(model, {
        mode: "create",
        panelType: "junction_box",
        tag: "JB001",
        title: "Duplicate"
      })
    ).toThrow(/already used/i);
  });
});
