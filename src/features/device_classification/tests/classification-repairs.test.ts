import { describe, expect, it } from "vitest";
import { resolveAssetClassification, classificationGroup, type ClassifiedAsset } from "../logic/services/asset-classification";
import { previewClassificationRepair } from "../logic/use_cases/preview-classification-repairs";
import { applyDrawingClassificationRepair } from "@/features/drawing_canvas/logic/services/drawing-classification-repair";
import { createDefaultDrawingModel, type DrawingAssetRecord } from "@/features/drawing_canvas/data/schema";
import { classificationContentToken } from "../logic/services/classification-token";

const asset: DrawingAssetRecord = { id: "a1", tag: "EQ-101", title: "Chassis", type: "other", symbolId: "s1", versionId: "v1" };
const batch = { symbols: { v1: { state: "available" as const, source: { kind: "symbol_version" as const, recordId: "s1", revisionId: "v1", deviceType: "chassis_rack" as const } } }, items: {} };
const generated: ClassifiedAsset[] = [
  { id: "p1", type: "panel", symbolId: "__generated_panel_enclosure__", versionId: "generated_panel_enclosure_v1", metadata: { generatedKind: "power_distribution_panel" } },
  { id: "p2", type: "junction_box", symbolId: "__generated_panel_enclosure__", versionId: "generated_panel_enclosure_v1", metadata: { generatedKind: "generic_enclosure" } },
  { id: "tb1", type: "terminal_block", symbolId: "__generated_terminal_block__", versionId: "generated_terminal_block_v1" },
  { id: "ts1", type: "terminal_block", symbolId: "__generated_structured_terminal_strip__:ts1", versionId: "generated_structured_terminal_strip_v1:ts1", terminalStrip: {} }
];
describe("classification-only drawing repair", () => {
  it.each(generated)("resolves generated $id from its exact built-in identity without mutation", value => {
    const before = structuredClone(value);
    const resolution = resolveAssetClassification(value, { symbols: {}, items: {} });
    expect(resolution.status).toBe("resolved");
    expect(classificationGroup(resolution)).toBe(value.type);
    expect(resolution.source?.kind).toBe("managed_asset");
    expect(resolution.issues).toEqual([]);
    expect(value).toEqual(before);
  });
  it("keeps unsupported generated identities and metadata-only claims unresolved", () => {
    const invalid = [
      { ...generated[0], versionId: "generated_panel_enclosure_v2" },
      { ...generated[0], type: "other" as const },
      { ...generated[3], id: "different-owner" },
      { ...generated[3], terminalStrip: undefined },
      { ...asset, metadata: { generatedKind: "panel" } }
    ];
    for (const value of invalid) {
      expect(resolveAssetClassification(value, { symbols: {}, items: {} }).status).toBe("unavailable");
    }
  });
  it("does not bypass a generated asset's pinned Item revision", () => {
    const value: ClassifiedAsset = { ...generated[0], productSelection: { status: "selected", itemId: "i1", itemEngineeringRevisionId: "r1" } };
    expect(resolveAssetClassification(value, { symbols: {}, items: {} }).status).toBe("unavailable");
    const resolution = resolveAssetClassification(value, { symbols: {}, items: { r1: { state: "available", source: { kind: "item_revision", recordId: "i1", revisionId: "r1", deviceType: "panel" } } } });
    expect(resolution.source?.kind).toBe("item_revision");
    expect(resolution.status).toBe("resolved");
  });
  it("previews without mutation and changes only the reviewed asset snapshot", () => {
    const model = { ...createDefaultDrawingModel(), assets: [asset, { ...asset, id: "a2" }] };
    const before = JSON.stringify(model);
    const resolved = resolveAssetClassification(asset, batch);
    expect(classificationGroup(resolved)).toBe("chassis_rack");
    const preview = previewClassificationRepair(asset, resolved)!;
    expect(JSON.stringify(model)).toBe(before);
    const result = applyDrawingClassificationRepair(model, "draft", preview);
    expect(result.sheets).toBe(model.sheets);
    expect(result.assets[1]).toBe(model.assets[1]);
    expect(result.assets[0]).toEqual({ ...asset, type: "chassis_rack" });
    expect(model.assets[0].type).toBe("other");
  });
  it("blocks approved/archived and stale asset previews", () => {
    const model = { ...createDefaultDrawingModel(), assets: [asset] };
    const preview = previewClassificationRepair(asset, resolveAssetClassification(asset, batch))!;
    expect(() => applyDrawingClassificationRepair(model, "approved", preview)).toThrow("review-only");
    expect(() => applyDrawingClassificationRepair(model, "archived", preview)).toThrow("review-only");
    expect(() => applyDrawingClassificationRepair({ ...model, assets: [{ ...asset, versionId: "different" }] }, "draft", preview)).toThrow("changed");
  });
  it("separates unlinked Other from linked missing or unavailable records", () => {
    expect(classificationGroup(resolveAssetClassification({ id: "unlinked", type: "other" }, batch))).toBe("other");
    expect(classificationGroup(resolveAssetClassification(asset, { symbols: {}, items: {} }))).toBe("needs_classification");
    expect(previewClassificationRepair(asset, resolveAssetClassification(asset, { symbols: {}, items: {} }))).toBeNull();
  });
  it("refuses mismatched source identities and does not fall back from a selected missing Item", () => {
    expect(resolveAssetClassification({ ...asset, symbolId: "different" }, batch).status).toBe("unavailable");
    const selected: DrawingAssetRecord = { ...asset, productSelection: { status: "selected", version: 1, configurationId: "c1", itemId: "i1", itemEngineeringRevisionId: "old" } };
    expect(resolveAssetClassification(selected, batch).status).toBe("unavailable");
  });
  it("allows an explicit snapshot review but not a conflicting Item/Symbol correction", () => {
    const differentSnapshot = { ...asset, type: "controller" as const };
    const resolution = resolveAssetClassification(differentSnapshot, batch);
    expect(resolution.status).toBe("conflicting");
    expect(previewClassificationRepair(differentSnapshot, resolution)?.after).toBe("chassis_rack");
    const selected = { ...asset, productSelection: { status: "selected" as const, itemId: "i1", itemEngineeringRevisionId: "r1" } };
    const disagreement = resolveAssetClassification(selected, { ...batch, items: { r1: { state: "available", source: { kind: "item_revision", recordId: "i1", revisionId: "r1", deviceType: "controller" } } } });
    expect(previewClassificationRepair(selected, disagreement)).toBeNull();
  });
  it("changes content tokens for a concurrent classification or metadata change", () => {
    const row = { id: "v1", symbolId: "s1", versionNumber: 1, status: "approved", deviceType: null, svg: "<svg/>", metadataJson: "{}" };
    const token = classificationContentToken(row);
    expect(token).toHaveLength(64);
    expect(classificationContentToken({ ...row, deviceType: "ups" })).not.toBe(token);
    expect(classificationContentToken({ ...row, metadataJson: '{"changed":true}' })).not.toBe(token);
  });
});
