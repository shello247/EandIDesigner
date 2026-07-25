import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingAssetRecord,
  type DrawingModel,
  type DrawingPlacement
} from "@/features/drawing_canvas/data/schema";
import { createPanelEnclosurePlacement } from "@/features/drawing_canvas/logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "@/features/drawing_canvas/logic/services/drawing-backplane-layouts";
import { getBackplaneDisplayUsableBounds } from "@/features/drawing_canvas/logic/services/drawing-backplane-scale";
import { buildManagedAssetCatalog } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import { getComponentCompositionBounds } from "@/features/symbol_components/api/public";
import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  buildAssociatedPanelAssetCatalog,
  placeAssociatedPanelAssetOnBackplane,
  removePanelAssetLayoutOccurrence
} from "../logic/services/panel-associated-assets";

const terminalBlockLayoutSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_terminal_block_single_scaled",
  symbolKey: "terminal_block_single_scaled",
  displayName: "Terminal Block Single Scaled",
  category: "terminal_block",
  versionId: "sym_terminal_block_single_scaled_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 20 178" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="178"/></svg>',
  metadata: {
    symbolKey: "terminal_block_single_scaled",
    displayName: "Terminal Block Single Scaled",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    panelCategory: "termination",
    mountingType: "din_rail",
    resizable: false,
    physicalWidthMm: 5.2,
    physicalHeightMm: 50,
    viewBox: { x: 0, y: 0, width: 20, height: 178 },
    anchors: [],
    terminals: []
  }
};

const railSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_din_rail",
  symbolKey: "standard_th35_din_rail",
  displayName: "Standard TH35 DIN Rail",
  category: "terminal_block",
  versionId: "sym_din_rail_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 300 35" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="35"/></svg>',
  metadata: {
    symbolKey: "standard_th35_din_rail",
    displayName: "Standard TH35 DIN Rail",
    category: "terminal_block",
    layoutUsage: "panel_layout",
    panelCategory: "rail",
    mountingType: "backplate",
    resizable: true,
    physicalWidthMm: 300,
    physicalHeightMm: 35,
    viewBox: { x: 0, y: 0, width: 300, height: 35 },
    anchors: [],
    terminals: []
  }
};

const componentChildSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_component_child",
  symbolKey: "component_child",
  displayName: "Component Child",
  category: "other",
  versionId: "sym_component_child_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 60 20" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="20"/></svg>',
  metadata: {
    symbolKey: "component_child",
    displayName: "Component Child",
    category: "other",
    layoutUsage: "panel_layout",
    physicalWidthMm: 60,
    physicalHeightMm: 20,
    viewBox: { x: 0, y: 0, width: 60, height: 20 },
    anchors: [],
    terminals: []
  }
};

const componentParentSymbol: ApprovedDrawingSymbol = {
  symbolId: "sym_component_parent",
  symbolKey: "component_parent",
  displayName: "Component Parent",
  category: "other",
  versionId: "sym_component_parent_v1",
  versionNumber: 1,
  svg: '<svg viewBox="0 0 27 89" xmlns="http://www.w3.org/2000/svg"><rect width="27" height="89"/></svg>',
  metadata: {
    symbolKey: "component_parent",
    displayName: "Component Parent",
    category: "other",
    layoutUsage: "panel_layout",
    physicalWidthMm: 27,
    physicalHeightMm: 40,
    viewBox: { x: 0, y: 0, width: 27, height: 89 },
    anchors: [],
    terminals: [],
    componentPositions: [
      {
        key: "1",
        label: "Position 1",
        required: true,
        components: [
          {
            key: "relay",
            label: "Relay",
            box: {
              centerX: 0,
              centerY: 20,
              width: 23,
              height: 40,
              rotationDeg: 0
            },
            allowedSymbolIds: [componentChildSymbol.symbolId]
          }
        ]
      }
    ]
  }
};

function terminalSourcePlacement(): DrawingPlacement {
  return {
    id: "tb_104_source",
    assetId: "asset_tb_104",
    containerAssetId: "asset_jb_001",
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    role: "terminal_block",
    tag: "TB-104",
    title: "Modular Terminal Block",
    x: 120,
    y: 80,
    rotation: 0,
    scale: 0.34,
    terminalBlock: {
      kind: "modular_terminal_strip",
      count: 5,
      startNumber: 1,
      orientation: "horizontal",
      modulePitch: 20,
      moduleWidth: 20,
      moduleHeight: 178
    }
  };
}

function modelWithJbTerminalAssets(): {
  model: DrawingModel;
  backplaneId: string;
} {
  const base = createDefaultDrawingModel();
  const layoutSheet = {
    ...base.sheets[0],
    id: "sheet_layout",
    name: "JB001 Panel Layout"
  };
  const panel = createPanelEnclosurePlacement({
    model: base,
    activeSheet: layoutSheet,
    assetId: "asset_jb_001",
    tag: "JB001",
    title: "Field Junction Box",
    kind: "junction_box",
    x: 20,
    y: 22
  });
  const backplane = createBackplanePlacement({ panelPlacement: panel });
  const assets: DrawingAssetRecord[] = [
    {
      id: "asset_jb_001",
      tag: "JB001",
      type: "junction_box",
      title: "Field Junction Box",
      symbolId: panel.symbolId,
      versionId: panel.versionId
    },
    {
      id: "asset_tb_104",
      tag: "TB-104",
      type: "terminal_block",
      title: "Modular Terminal Block",
      symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
      versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID
    }
  ];

  return {
    backplaneId: backplane.id,
    model: {
      ...base,
      assets,
      sheets: [
        {
          ...base.sheets[0],
          id: "sheet_wiring",
          name: "Wiring Sheet",
          placements: [terminalSourcePlacement()]
        },
        {
          ...layoutSheet,
          placements: [panel, backplane]
        }
      ]
    }
  };
}

describe("associated panel assets", () => {
  it("lists existing terminal blocks associated with a junction box", () => {
    const { model, backplaneId } = modelWithJbTerminalAssets();
    const catalog = buildAssociatedPanelAssetCatalog(
      model,
      [terminalBlockLayoutSymbol],
      "asset_jb_001",
      backplaneId
    );

    expect(catalog).toMatchObject([
      {
        assetId: "asset_tb_104",
        tag: "TB-104",
        status: "available",
        sourcePlacementRefs: [
          {
            sheetName: "Wiring Sheet",
            placementId: "tb_104_source"
          }
        ]
      }
    ]);
  });

  it("places an associated terminal block without creating a new terminal asset", () => {
    const { model, backplaneId } = modelWithJbTerminalAssets();
    const result = placeAssociatedPanelAssetOnBackplane({
      model,
      sheetId: "sheet_layout",
      backplaneId,
      assetId: "asset_tb_104",
      symbols: [terminalBlockLayoutSymbol],
      placementId: "layout_tb_104"
    });

    expect(result.placement).toMatchObject({
      id: "layout_tb_104",
      assetId: "asset_tb_104",
      containerAssetId: "asset_jb_001",
      layoutKind: "layout_helper",
      layoutParentId: backplaneId,
      tag: "TB-104",
      terminalBlock: {
        count: 5
      },
      layoutDimensions: {
        lengthMm: 26,
        widthMm: 50
      }
    });
    expect(result.model.assets.map((asset) => asset.tag)).toEqual([
      "JB001",
      "TB-104"
    ]);

    const afterCatalog = buildAssociatedPanelAssetCatalog(
      result.model,
      [terminalBlockLayoutSymbol],
      "asset_jb_001",
      backplaneId
    );

    expect(afterCatalog[0]).toMatchObject({
      assetId: "asset_tb_104",
      status: "placed",
      placedPlacementId: "layout_tb_104"
    });
  });

  it("returns an asset to the available list when its layout occurrence is removed", () => {
    const { model, backplaneId } = modelWithJbTerminalAssets();
    const placed = placeAssociatedPanelAssetOnBackplane({
      model,
      sheetId: "sheet_layout",
      backplaneId,
      assetId: "asset_tb_104",
      symbols: [terminalBlockLayoutSymbol],
      placementId: "layout_tb_104"
    });
    const removed = removePanelAssetLayoutOccurrence({
      model: placed.model,
      sheetId: "sheet_layout",
      placementId: "layout_tb_104"
    });
    const catalog = buildAssociatedPanelAssetCatalog(
      removed,
      [terminalBlockLayoutSymbol],
      "asset_jb_001",
      backplaneId
    );

    expect(catalog[0]).toMatchObject({
      assetId: "asset_tb_104",
      status: "available"
    });
  });

  it("keeps the actual child envelope inside the backplane on placement", () => {
    const fixture = modelWithJbTerminalAssets();
    const parentAsset: DrawingAssetRecord = {
      id: "asset_component_parent",
      tag: "K-101",
      type: "relay",
      title: "Relay assembly",
      symbolId: componentParentSymbol.symbolId,
      versionId: componentParentSymbol.versionId,
      componentSelections: [
        {
          positionKey: "1",
          componentKey: "relay",
          symbolId: componentChildSymbol.symbolId,
          versionId: componentChildSymbol.versionId
        }
      ]
    };
    const sourcePlacement: DrawingPlacement = {
      id: "component_parent_source",
      assetId: parentAsset.id,
      containerAssetId: "asset_jb_001",
      symbolId: componentParentSymbol.symbolId,
      versionId: componentParentSymbol.versionId,
      role: "device",
      tag: parentAsset.tag,
      x: 20,
      y: 20,
      rotation: 0,
      scale: 0.34
    };
    const model: DrawingModel = {
      ...fixture.model,
      assets: [...fixture.model.assets, parentAsset],
      sheets: fixture.model.sheets.map((sheet) =>
        sheet.id === "sheet_wiring"
          ? { ...sheet, placements: [...sheet.placements, sourcePlacement] }
          : sheet
      )
    };
    const symbols = [componentParentSymbol, componentChildSymbol];
    const result = placeAssociatedPanelAssetOnBackplane({
      model,
      sheetId: "sheet_layout",
      backplaneId: fixture.backplaneId,
      assetId: parentAsset.id,
      symbols,
      placementId: "layout_component_parent"
    });
    const layoutSheet = result.model.sheets.find(
      (sheet) => sheet.id === "sheet_layout"
    )!;
    const backplane = layoutSheet.placements.find(
      (placement) => placement.id === fixture.backplaneId
    )!;
    const sheetGeometry = {
      ...layoutSheet.page,
      titleBlock: result.model.titleBlock
    };
    const usable = getBackplaneDisplayUsableBounds(sheetGeometry, backplane);
    const bounds = getComponentCompositionBounds({
      parentPlacement: result.placement,
      parentSymbol: componentParentSymbol,
      selections: parentAsset.componentSelections,
      symbols
    });

    expect(bounds.x).toBeGreaterThanOrEqual(usable.x - 0.01);
    expect(bounds.y).toBeGreaterThanOrEqual(usable.y - 0.01);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      usable.x + usable.width + 0.01
    );
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(
      usable.y + usable.height + 0.01
    );
  });

  it("counts asset-backed layout occurrences but not DIN rail helpers in Asset Manager", () => {
    const { model, backplaneId } = modelWithJbTerminalAssets();
    const placed = placeAssociatedPanelAssetOnBackplane({
      model,
      sheetId: "sheet_layout",
      backplaneId,
      assetId: "asset_tb_104",
      symbols: [terminalBlockLayoutSymbol],
      placementId: "layout_tb_104"
    });
    const withRail: DrawingModel = {
      ...placed.model,
      assets: [
        ...placed.model.assets,
        {
          id: "asset_rail",
          tag: "Standard TH35 DIN Rail",
          type: "other",
          title: "Standard TH35 DIN Rail",
          symbolId: railSymbol.symbolId,
          versionId: railSymbol.versionId
        }
      ],
      sheets: placed.model.sheets.map((sheet) =>
        sheet.id === "sheet_layout"
          ? {
              ...sheet,
              placements: [
                ...sheet.placements,
                {
                  id: "rail_layout",
                  assetId: "asset_rail",
                  containerAssetId: "asset_jb_001",
                  symbolId: railSymbol.symbolId,
                  versionId: railSymbol.versionId,
                  role: "other",
                  tag: "Standard TH35 DIN Rail",
                  x: 50,
                  y: 60,
                  rotation: 0,
                  scale: 1,
                  layoutKind: "layout_helper",
                  layoutParentId: backplaneId,
                  layoutDimensions: {
                    lengthMm: 200,
                    widthMm: 35
                  }
                }
              ]
            }
          : sheet
      )
    };
    const managedCatalog = buildManagedAssetCatalog(withRail, [
      terminalBlockLayoutSymbol,
      railSymbol
    ]);
    const terminal = managedCatalog.find((item) => item.id === "asset_tb_104");
    const rail = managedCatalog.find((item) => item.id === "asset_rail");

    expect(terminal?.occurrenceCount).toBe(2);
    expect(terminal?.sheetRefs.map((ref) => ref.sheetName)).toEqual([
      "Wiring Sheet",
      "JB001 Panel Layout"
    ]);
    expect(rail).toBeUndefined();
  });
});
