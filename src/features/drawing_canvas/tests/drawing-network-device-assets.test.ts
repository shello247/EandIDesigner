import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  createStablePlacementAssetId,
  type DrawingModel,
  type DrawingPlacement
} from "../data/schema";
import { createPanelWiringSource } from "../api/panel-wiring-contracts";
import {
  isNetworkDeviceDrawingSymbol,
  normalizeNetworkDeviceDrawingAssets
} from "../logic/services/drawing-network-device-assets";
import type { ApprovedDrawingSymbol } from "../types";
import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex
} from "@/features/drawing_panel_wiring/api/public";

const switchSymbol: ApprovedDrawingSymbol = {
  symbolId: "symbol_switch",
  symbolKey: "phoenix_fl_switch_1108nt",
  displayName: "Industrial Ethernet Switch",
  category: "controller",
  technicalKind: "controller",
  managedCategory: {
    id: "symbol_category_network_device",
    name: "Network Device"
  },
  versionId: "symbol_switch_v1",
  versionNumber: 1,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"/>',
  metadata: {
    symbolKey: "phoenix_fl_switch_1108nt",
    displayName: "Industrial Ethernet Switch",
    category: "other",
    layoutUsage: "panel_layout",
    physicalWidthMm: 22.5,
    physicalHeightMm: 140.4,
    mountingType: "din_rail",
    panelWiring: { assetType: "other", tagPrefix: "SW" },
    viewBox: { x: 0, y: 0, width: 100, height: 200 },
    anchors: [{ key: "US", x: 50, y: 0, kind: "terminal" }],
    terminals: [
      {
        key: "US",
        label: "24 VDC supply",
        anchorKey: "US",
        panelSide: "internal",
        requiredForWiring: true
      }
    ]
  }
};

function legacySwitchPlacement(): DrawingPlacement {
  return {
    id: "placement_switch",
    symbolId: switchSymbol.symbolId,
    versionId: switchSymbol.versionId,
    role: "other",
    tag: "SW-101",
    title: switchSymbol.displayName,
    x: 40,
    y: 30,
    rotation: 0,
    scale: 1,
    layoutKind: "layout_helper",
    layoutParentId: "backplane_1",
    containerAssetId: "asset_panel",
    layoutDimensions: { lengthMm: 22.5, widthMm: 140.4 }
  };
}

function legacyModel(): DrawingModel {
  const model = createDefaultDrawingModel();
  return {
    ...model,
    assets: [
      {
        id: "asset_panel",
        tag: "PLC-001",
        type: "panel",
        title: "PLC Panel 001"
      }
    ],
    sheets: model.sheets.map((sheet) => ({
      ...sheet,
      placements: [legacySwitchPlacement()]
    }))
  };
}

describe("drawing network device asset compatibility", () => {
  it("recognizes the managed Network Device category independently of legacy technical metadata", () => {
    expect(isNetworkDeviceDrawingSymbol(switchSymbol)).toBe(true);
  });

  it("upgrades a legacy layout helper into an idempotent managed network asset", () => {
    const normalized = normalizeNetworkDeviceDrawingAssets(legacyModel(), [
      switchSymbol
    ]);
    const expectedAssetId = createStablePlacementAssetId("placement_switch");

    expect(normalized.sheets[0].placements[0]).toMatchObject({
      assetId: expectedAssetId,
      role: "device",
      layoutKind: "layout_helper",
      containerAssetId: "asset_panel"
    });
    expect(normalized.assets).toContainEqual(
      expect.objectContaining({
        id: expectedAssetId,
        tag: "SW-101",
        type: "network_device",
        symbolId: switchSymbol.symbolId,
        versionId: switchSymbol.versionId
      })
    );
    expect(
      normalizeNetworkDeviceDrawingAssets(normalized, [switchSymbol])
    ).toBe(normalized);
  });

  it("exposes a legacy panel-layout switch to the Panel Equipment catalog", () => {
    const graph = buildPackageConnectivityGraph(
      createPanelWiringSource(legacyModel(), [switchSymbol])
    );
    const index = buildPanelDiscoveryIndex({
      graph,
      panelAssetId: "asset_panel",
      detailedSheetId: "sheet_detail"
    });
    const expectedAssetId = createStablePlacementAssetId("placement_switch");

    expect(index.assetsById.get(expectedAssetId)).toMatchObject({
      assetId: expectedAssetId,
      tag: "SW-101",
      status: "available",
      terminalCount: 1,
      representationSource: {
        placementId: "placement_switch",
        occurrenceKind: "layout"
      }
    });
  });
});
