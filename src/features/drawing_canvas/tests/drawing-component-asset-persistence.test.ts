import { describe, expect, it } from "vitest";
import {
  createDefaultDrawingModel,
  createStablePlacementAssetId,
  parseDrawingModelJson,
  stringifyDrawingModel,
  type DrawingModel
} from "../data/schema";
import { roleFromSymbol } from "../logic/services/drawing-asset-identity";
import { createDrawingModelPreparationCache } from "../logic/services/drawing-model-preparation";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import { buildManagedAssetCatalog } from "@/features/drawing_asset_manager/logic/use_cases/drawing-asset-manager-use-cases";
import { validateDrawingComponentSelections } from "@/features/symbol_components/api/public";
import type { ApprovedDrawingSymbol } from "../types";

const processor: ApprovedDrawingSymbol = {
  symbolId: "processor", versionId: "processor-v1", versionNumber: 1,
  symbolKey: "processor", displayName: "Processor", category: "controller",
  svg: '<svg viewBox="0 0 20 60"><rect width="20" height="60"/></svg>',
  metadata: {
    symbolKey: "processor", displayName: "Processor", category: "controller",
    viewBox: { x: 0, y: 0, width: 20, height: 60 }, anchors: [], terminals: [],
    physicalWidthMm: 20, physicalHeightMm: 60
  }
};
const chassis: ApprovedDrawingSymbol = {
  ...processor, symbolId: "chassis", versionId: "chassis-v1",
  symbolKey: "chassis", displayName: "Four-slot chassis",
  metadata: {
    ...processor.metadata, symbolKey: "chassis", displayName: "Four-slot chassis",
    layoutUsage: "panel_layout", physicalWidthMm: 173, physicalHeightMm: 136.2,
    componentPositions: [{
      key: "processor", label: "Processor", required: true,
      components: [{
        key: "processor", label: "Processor", allowedSymbolIds: [processor.symbolId],
        box: { centerX: 10, centerY: 30, width: 20, height: 60, rotationDeg: 0 }
      }]
    }]
  }
};
const symbols = [chassis, processor];
const selections = [{
  positionKey: "processor", componentKey: "processor",
  symbolId: processor.symbolId, versionId: processor.versionId, children: []
}];

function wizardResult(): DrawingModel {
  const model = createDefaultDrawingModel();
  model.assets = [{
    id: "chosen-asset", tag: "EQ-101", type: "other", title: chassis.displayName,
    symbolId: chassis.symbolId, versionId: chassis.versionId, componentSelections: selections
  }];
  model.sheets[0].placements = [{
    id: "chassis-placement", assetId: "chosen-asset", tag: "EQ-101",
    title: chassis.displayName, symbolId: chassis.symbolId, versionId: chassis.versionId,
    role: roleFromSymbol(chassis), layoutKind: "layout_helper",
    layoutParentId: "backplane", containerAssetId: "panel",
    x: 72, y: 45, rotation: 0, scale: 1,
    layoutDimensions: { lengthMm: 173, widthMm: 136.2 }
  }];
  return model;
}

describe("component-bearing panel layout asset persistence", () => {
  it("retains wizard choices through editor preparation, save and reload", () => {
    const initial = wizardResult();
    const cache = createDrawingModelPreparationCache({ symbols });
    const prepared = cache.prepare(initial).model;
    const reloaded = cache.prepare(parseDrawingModelJson(stringifyDrawingModel(prepared))).model;
    expect(reloaded.assets).toContainEqual(expect.objectContaining({
      id: "chosen-asset", tag: "EQ-101", componentSelections: selections
    }));
    expect(reloaded.sheets[0].placements[0]).toEqual(initial.sheets[0].placements[0]);
    expect(buildManagedAssetCatalog(reloaded, symbols)[0]).toMatchObject({
      id: "chosen-asset", occurrenceCount: 1, componentSelections: selections
    });
    expect(renderDrawingToSvg({
      model: toSheetCanvasModel(reloaded, reloaded.sheets[0].id),
      approvedSymbols: symbols, assets: reloaded.assets
    })).toContain('data-component-symbol-id="processor"');
  });

  it("preserves saved selections from a legacy role=other placement before schema cleanup", () => {
    const legacy = wizardResult();
    legacy.sheets[0].placements[0].role = "other";
    const loaded = parseDrawingModelJson(JSON.stringify(legacy));
    expect(loaded.assets[0]).toMatchObject({ id: "chosen-asset", componentSelections: selections });
    expect(loaded.sheets[0].placements[0]).toMatchObject({ assetId: "chosen-asset", role: "device" });
  });

  it("recovers an affected placement without inventing lost component selections", () => {
    const legacy = wizardResult();
    legacy.assets = [];
    const placement = legacy.sheets[0].placements[0];
    placement.role = "other";
    delete placement.assetId;
    const cache = createDrawingModelPreparationCache({ symbols });
    const recovered = cache.prepare(parseDrawingModelJson(JSON.stringify(legacy))).model;
    const assetId = createStablePlacementAssetId(placement.id);
    expect(recovered.sheets[0].placements[0]).toEqual({ ...placement, assetId, role: "device" });
    expect(recovered.assets).toHaveLength(1);
    expect(recovered.assets[0]).toMatchObject({ id: assetId, tag: "EQ-101" });
    expect(recovered.assets[0].componentSelections).toBeUndefined();
    expect(validateDrawingComponentSelections({ parent: chassis, symbols, selections: [] }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "COMPONENT_SELECTION_REQUIRED" })]));
    const again = cache.prepare(parseDrawingModelJson(stringifyDrawingModel(recovered))).model;
    expect(again.assets).toEqual(recovered.assets);
    expect(again.sheets).toEqual(recovered.sheets);
  });

  it("keeps ordinary layout helpers and generated references out of Asset Manager", () => {
    const model = wizardResult();
    model.assets = [];
    model.sheets[0].placements = [
      { ...model.sheets[0].placements[0], assetId: undefined, role: "other",
        symbolId: "rail", versionId: "rail-v1" },
      { ...model.sheets[0].placements[0], id: "legend", assetId: undefined,
        role: "other", panelPatternLegend: { visible: true } }
    ];
    expect(createDrawingModelPreparationCache({ symbols }).prepare(model).model.assets).toEqual([]);
  });

  it("preserves pinned and nested choices across linked sheet occurrences", () => {
    const model = wizardResult();
    const chosen = [{ ...selections[0], versionId: "processor-older-version",
      children: [{ ...selections[0], positionKey: "accessory", symbolId: "accessory" }] }];
    model.assets[0].componentSelections = chosen;
    model.sheets.push({ ...model.sheets[0], id: "second-sheet", name: "Second View",
      placements: [{ ...model.sheets[0].placements[0], id: "second-occurrence" }] });
    const prepared = createDrawingModelPreparationCache({ symbols }).prepare(model).model;
    const reloaded = parseDrawingModelJson(stringifyDrawingModel(prepared));
    expect(reloaded.assets).toHaveLength(1);
    expect(reloaded.assets[0].componentSelections).toEqual(chosen);
    expect(buildManagedAssetCatalog(reloaded, symbols)[0].occurrenceCount).toBe(2);
  });

  it("does not infer component selections from a different symbol version", () => {
    const model = wizardResult();
    model.assets = [];
    model.sheets[0].placements[0] = {
      ...model.sheets[0].placements[0], assetId: undefined,
      role: "other", versionId: "unavailable-version"
    };
    expect(createDrawingModelPreparationCache({ symbols }).prepare(model).model.assets).toEqual([]);
  });
});
