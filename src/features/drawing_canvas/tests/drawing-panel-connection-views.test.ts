import { describe, expect, it } from "vitest";
import { createDefaultDrawingModel, type DrawingModel } from "../data/schema";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import {
  createPanelConnectionView,
  getPanelConnectionViewInnerBounds,
  listPanelConnectionViewSources
} from "../logic/services/drawing-panel-connection-views";

function fixture(): DrawingModel {
  const base = createDefaultDrawingModel();
  const sourceSheet = {
    ...base.sheets[0],
    id: "layout",
    name: "PLC001 Panel Layout"
  };
  const targetSheet = {
    ...base.sheets[0],
    id: "connection",
    name: "PLC001 to JB001 Connection",
    placements: []
  };
  const panel = createPanelEnclosurePlacement({
    model: base,
    activeSheet: sourceSheet,
    assetId: "asset_plc",
    tag: "PLC-001",
    title: "Main PLC Panel",
    width: 610,
    height: 610,
    x: 18,
    y: 20
  });
  const backplane = createBackplanePlacement({
    panelPlacement: panel,
    sheet: { ...sourceSheet.page, titleBlock: base.titleBlock },
    id: "bp_plc"
  });
  return {
    ...base,
    assets: [
      {
        id: "asset_plc",
        tag: "PLC-001",
        title: "Main PLC Panel",
        type: "panel",
        symbolId: panel.symbolId,
        versionId: panel.versionId
      }
    ],
    sheets: [
      { ...sourceSheet, placements: [panel, backplane] },
      targetSheet
    ]
  };
}

describe("schematic panel connection views", () => {
  it("projects the authoritative physical backplane without cloning geometry", () => {
    const model = fixture();
    const sources = listPanelConnectionViewSources(model, "asset_plc");
    expect(sources.map((source) => source.placementId)).toEqual(["bp_plc"]);

    const view = createPanelConnectionView({
      model,
      activeSheet: model.sheets[1],
      assetId: "asset_plc",
      tag: "PLC-001",
      title: "Main PLC Panel",
      sourceBackplanePlacementId: "bp_plc",
      preferredPosition: { x: 24, y: 20 }
    });

    expect(view).toMatchObject({
      assetId: "asset_plc",
      role: "enclosure",
      x: 24,
      y: 20,
      panelConnectionView: {
        kind: "schematic_reference",
        sourceBackplanePlacementId: "bp_plc",
        displayWidth: 110,
        displayHeight: 120
      }
    });
    expect(view.enclosure).toBeUndefined();
    expect(view.layoutDimensions).toBeUndefined();
    expect(view.layoutPosition).toBeUndefined();
    expect(view.layoutScale).toBeUndefined();
    expect(getPanelConnectionViewInnerBounds(view)).toEqual({
      x: 30,
      y: 36,
      width: 98,
      height: 98
    });
  });

  it("rejects panels without an authoritative physical backplane", () => {
    const model = fixture();
    expect(() =>
      createPanelConnectionView({
        model,
        activeSheet: model.sheets[1],
        assetId: "asset_plc",
        tag: "PLC-001",
        title: "Main PLC Panel",
        sourceBackplanePlacementId: "missing"
      })
    ).toThrow(/authoritative backplane/i);
  });

  it("uses the same schematic size for differently sized physical panels", () => {
    const model = fixture();
    const first = createPanelConnectionView({
      model,
      activeSheet: model.sheets[1],
      assetId: "asset_plc",
      tag: "PLC-001",
      title: "Main PLC Panel",
      sourceBackplanePlacementId: "bp_plc"
    });
    const changedPhysicalModel: DrawingModel = {
      ...model,
      sheets: model.sheets.map((sheet) => ({
        ...sheet,
        placements: sheet.placements.map((placement) =>
          placement.enclosure
            ? {
                ...placement,
                enclosure: { ...placement.enclosure, width: 300, height: 250 }
              }
            : placement
        )
      }))
    };
    const second = createPanelConnectionView({
      model: changedPhysicalModel,
      activeSheet: changedPhysicalModel.sheets[1],
      assetId: "asset_plc",
      tag: "PLC-001",
      title: "Main PLC Panel",
      sourceBackplanePlacementId: "bp_plc"
    });
    expect(second.panelConnectionView).toEqual(first.panelConnectionView);
  });
});
