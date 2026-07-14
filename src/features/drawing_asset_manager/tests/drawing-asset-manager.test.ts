import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  type DrawingConnection,
  type DrawingModel,
  type DrawingPlacement
} from "@/features/drawing_canvas/data/schema";
import type { ApprovedDrawingSymbol } from "@/features/drawing_canvas/types";
import {
  buildManagedAssetCatalog,
  createManagedAsset,
  deleteManagedAsset,
  getAssetDeletionBlockers,
  reconcileDrawingAssets,
  updateManagedAsset
} from "../logic/use_cases/drawing-asset-manager-use-cases";
import { renameDrawingAssetTag } from "@/features/drawing_canvas/logic/services/drawing-asset-identity";
import { relinkPlacementsToNewAsset } from "@/features/drawing_canvas/logic/services/drawing-asset-resolution";

function symbol(input: {
  id: string;
  key: string;
  name: string;
  category: ApprovedDrawingSymbol["category"];
  model?: string;
}): ApprovedDrawingSymbol {
  return {
    symbolId: input.id,
    symbolKey: input.key,
    displayName: input.name,
    model: input.model,
    category: input.category,
    versionId: `${input.id}_v1`,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="40"/></svg>',
    metadata: {
      symbolKey: input.key,
      displayName: input.name,
      model: input.model,
      category: input.category,
      viewBox: { x: 0, y: 0, width: 100, height: 40 },
      anchors: [
        { key: "A", x: 0, y: 20, kind: "terminal" },
        { key: "B", x: 100, y: 20, kind: "terminal" }
      ],
      terminals: []
    }
  };
}

const cableSymbol = symbol({
  id: "sym_cable",
  key: "clx_cable_1_pair",
  name: "CLX Cable 1 Pair",
  category: "cable_assembly"
});

const levelSymbol = symbol({
  id: "sym_level",
  key: "fmp51_guided_wave_radar",
  name: "FMP51 Guided Wave Radar",
  category: "instrument",
  model: "FMP51"
});

const controllerSymbol = symbol({
  id: "sym_controller",
  key: "nrf81_tank_side_monitor",
  name: "NRF81 Tank Side Monitor",
  category: "monitor",
  model: "NRF81"
});

const symbols = [cableSymbol, levelSymbol, controllerSymbol];

function placement(
  overrides: Partial<DrawingPlacement> = {}
): DrawingPlacement {
  return {
    id: "lit_101",
    assetId: "asset_lit_101",
    symbolId: levelSymbol.symbolId,
    versionId: levelSymbol.versionId,
    role: "device",
    tag: "LIT-101",
    title: "Tank 1 Level Transmitter",
    x: 20,
    y: 30,
    rotation: 0,
    scale: 0.34,
    ...overrides
  };
}

function modelWithAssets(): DrawingModel {
  const defaultModel = createDefaultDrawingModel();
  const sheet = defaultModel.sheets[0];
  const cable = placement({
    id: "c_101",
    assetId: "asset_c_101",
    symbolId: cableSymbol.symbolId,
    versionId: cableSymbol.versionId,
    role: "cable_assembly",
    tag: "C-101",
    title: "CLX Cable 1 Pair"
  });
  const connection: DrawingConnection = {
    id: "conn_1",
    from: { placementId: "lit_101", anchorKey: "A" },
    to: { placementId: "lit_101", anchorKey: "B" },
    cablePlacementId: "c_101",
    conductorKey: "WHT",
    wireId: "C-101-WHT"
  };

  return {
    ...defaultModel,
    sheets: [
      {
        ...sheet,
        name: "Tank 1 Field Wiring",
        placements: [placement(), cable],
        connections: [connection]
      }
    ]
  };
}

describe("drawing asset manager use cases", () => {
  it("builds a catalog from legacy placement-only models", () => {
    const model = modelWithAssets();
    const legacyModel = { ...model } as Partial<DrawingModel>;
    delete legacyModel.assets;

    const catalog = buildManagedAssetCatalog(legacyModel as DrawingModel, symbols);

    expect(catalog.map((asset) => asset.tag)).toEqual(["C-101", "LIT-101"]);
    expect(catalog[1]?.sheetRefs[0]).toMatchObject({
      sheetNumber: 1,
      sheetName: "Tank 1 Field Wiring",
      placementId: "lit_101"
    });
  });

  it("reconciles explicit unplaced assets with placement-derived assets", () => {
    const model = {
      ...modelWithAssets(),
      assets: [
        {
          id: "asset_jb_001",
          tag: "JB-001",
          type: "junction_box" as const,
          title: "Field Junction Box"
        }
      ]
    };

    const reconciled = reconcileDrawingAssets(model, symbols);
    const catalog = buildManagedAssetCatalog(reconciled, symbols);

    expect(catalog.find((asset) => asset.tag === "JB-001")?.occurrenceCount).toBe(
      0
    );
    expect(catalog.find((asset) => asset.tag === "LIT-101")?.occurrenceCount).toBe(
      1
    );
  });

  it("allocates type-specific tags when creating assets", () => {
    const withJunctionBox = createManagedAsset(modelWithAssets(), {
      type: "junction_box",
      title: "Field Junction Box"
    }, symbols);
    const withCable = createManagedAsset(withJunctionBox, {
      type: "cable",
      title: "Spare Cable"
    }, symbols);

    expect(withJunctionBox.assets.some((asset) => asset.tag === "JB-001")).toBe(
      true
    );
    expect(withCable.assets.some((asset) => asset.tag === "C-102")).toBe(true);
  });

  it("updates asset tags and titles across linked placements", () => {
    const model = reconcileDrawingAssets(modelWithAssets(), symbols);
    const updated = updateManagedAsset(
      model,
      "asset_lit_101",
      { tag: "LIT-102", title: "Tank 2 Level Transmitter" },
      symbols
    );
    const updatedPlacement = updated.sheets[0]?.placements.find(
      (item) => item.id === "lit_101"
    );

    expect(updated.assets.find((asset) => asset.id === "asset_lit_101")).toMatchObject({
      tag: "LIT-102",
      title: "Tank 2 Level Transmitter"
    });
    expect(updatedPlacement).toMatchObject({
      tag: "LIT-102",
      title: "Tank 2 Level Transmitter"
    });
  });

  it("blocks creating or renaming to a tag used by another asset", () => {
    const model = reconcileDrawingAssets(modelWithAssets(), symbols);

    expect(() =>
      createManagedAsset(
        model,
        {
          type: "controller",
          tag: "LIT-101",
          title: "Duplicate Controller"
        },
        symbols
      )
    ).toThrow(/already used by another asset/);

    expect(() =>
      updateManagedAsset(model, "asset_c_101", { tag: "LIT-101" }, symbols)
    ).toThrow(/already used by another asset/);

    expect(() =>
      renameDrawingAssetTag(model, "asset_c_101", "LIT-101", symbols)
    ).toThrow(/already used by another asset/);
  });

  it("blocks splitting a placement into a new asset with the old tag", () => {
    const model = reconcileDrawingAssets(modelWithAssets(), symbols);

    expect(() =>
      relinkPlacementsToNewAsset(model, ["lit_101"], "LIT-101", symbols)
    ).toThrow(/already used by another asset/);
  });

  it("regenerates derived cable wire ids on cable tag edits", () => {
    const model = reconcileDrawingAssets(modelWithAssets(), symbols);
    const updated = updateManagedAsset(
      model,
      "asset_c_101",
      { tag: "C-102" },
      symbols
    );

    expect(updated.sheets[0]?.connections[0]?.wireId).toBe("C-102-WHT");
  });

  it("blocks deleting placed or container-referenced assets", () => {
    const model = reconcileDrawingAssets(
      {
        ...modelWithAssets(),
        assets: [
          {
            id: "asset_jb_001",
            tag: "JB-001",
            type: "junction_box",
            title: "Field Junction Box"
          }
        ],
        sheets: [
          {
            ...modelWithAssets().sheets[0],
            placements: [
              placement({ containerAssetId: "asset_jb_001" })
            ]
          }
        ]
      },
      symbols
    );

    expect(getAssetDeletionBlockers(model, "asset_lit_101")[0]?.code).toBe(
      "placement"
    );
    expect(getAssetDeletionBlockers(model, "asset_jb_001")[0]?.code).toBe(
      "containment"
    );
    expect(() => deleteManagedAsset(model, "asset_jb_001")).toThrow(
      /container/
    );
  });

  it("tracks and protects panel assets referenced by detailed panel sheets", () => {
    const base = modelWithAssets();
    const model = reconcileDrawingAssets(
      {
        ...base,
        assets: [
          ...base.assets,
          {
            id: "asset_jb_001",
            tag: "JB001",
            type: "junction_box",
            title: "Field Junction Box"
          }
        ],
        sheets: [
          {
            ...base.sheets[0],
            id: "sheet_panel_detail",
            name: "JB001 Detailed Panel Drawing",
            placements: [],
            connections: [],
            panelDrawingContext: {
              kind: "detailed_panel_wiring",
              panelAssetId: "asset_jb_001"
            }
          }
        ]
      },
      symbols
    );
    const catalogItem = buildManagedAssetCatalog(model, symbols).find(
      (asset) => asset.id === "asset_jb_001"
    );

    expect(catalogItem?.occurrenceCount).toBe(0);
    expect(catalogItem?.sheetRefs).toEqual([
      {
        sheetId: "sheet_panel_detail",
        sheetName: "JB001 Detailed Panel Drawing",
        sheetNumber: 1,
        referenceKind: "panel_context"
      }
    ]);
    expect(getAssetDeletionBlockers(model, "asset_jb_001")[0]?.code).toBe(
      "panel_context"
    );
    expect(() => deleteManagedAsset(model, "asset_jb_001")).toThrow(
      /Detailed Panel Drawing/
    );
  });

  it("deletes unplaced assets and warns on duplicate tags", () => {
    const model = reconcileDrawingAssets(
      {
        ...modelWithAssets(),
        assets: [
          {
            id: "asset_spare_controller",
            tag: "LIT-101",
            type: "controller",
            title: "Spare Monitor"
          },
          {
            id: "asset_jb_001",
            tag: "JB-001",
            type: "junction_box",
            title: "Field Junction Box"
          }
        ]
      },
      symbols
    );
    const catalog = buildManagedAssetCatalog(model, symbols);
    const duplicate = catalog.find(
      (asset) => asset.id === "asset_spare_controller"
    );
    const deleted = deleteManagedAsset(model, "asset_jb_001");

    expect(duplicate?.warnings).toContain("Duplicate tag is used by another asset.");
    expect(deleted.assets.some((asset) => asset.id === "asset_jb_001")).toBe(
      false
    );
  });

  it("excludes generated panel references and legends from physical assets", () => {
    const base = createDefaultDrawingModel();
    const legend = placement({
      id: "pattern_legend",
      assetId: undefined,
      symbolId: "__generated_panel_pattern_legend__",
      versionId: "generated_panel_pattern_legend_v1",
      role: "other",
      tag: "Connection Pattern Legend",
      panelPatternLegend: { visible: true }
    });
    const model: DrawingModel = {
      ...base,
      assets: [
        {
          id: "asset_pattern_legend",
          tag: legend.tag,
          type: "other",
          title: legend.tag
        }
      ],
      sheets: base.sheets.map((sheet) => ({
        ...sheet,
        placements: [legend]
      }))
    };

    expect(buildManagedAssetCatalog(model, symbols)).toEqual([]);
    expect(reconcileDrawingAssets(model, symbols).assets).toEqual([]);
  });
});
