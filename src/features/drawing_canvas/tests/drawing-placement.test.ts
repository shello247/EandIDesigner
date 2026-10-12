import { describe, expect, it, vi } from "vitest";
import { createDefaultDrawingModel, type DrawingModel, type DrawingPlacement } from "../data/schema";
import { placementCommitInputSchema } from "../data/placement-schema";
import { createPlacementId, nextManualPlacementTag, placementTagAvailable, preparePlacementCandidate,
  resolvePlacementPreview, positionPlacementCandidate, placementBodyBounds, getPlacementTargets, canContinuePlacement, resolvePointerPlacementTarget,
  type PlacementSource } from "../logic/services/drawing-placement";
import { allocateNextTagFromPrefix } from "../logic/services/drawing-asset-identity";
import { toSheetCanvasModel } from "../logic/commands/drawing-sheet-commands";
import { createPanelEnclosurePlacement } from "../logic/services/drawing-asset-containment";
import { createBackplanePlacement } from "../logic/services/drawing-backplane-layouts";
import { createLayoutDimensionPlacement, getLayoutDimensionDisplayGeometry } from "../logic/services/drawing-layout-dimensions";
import { createEmptyDrawingHistory, pushDrawingHistoryEntry, undoDrawingHistory, redoDrawingHistory } from "../logic/services/drawing-model-history";
import { renderDrawingToSvg } from "../logic/services/drawing-svg-renderer";
import type { ApprovedDrawingSymbol } from "../types";

const symbol: ApprovedDrawingSymbol = {
  symbolId: "device", versionId: "device-v1", symbolKey: "device", versionNumber: 1,
  category: "other", displayName: "Device",
  svg: '<svg viewBox="0 0 100 40"><rect width="100" height="40" fill="#eee"/></svg>',
  metadata: { symbolKey: "device", category: "other", displayName: "Device",
    viewBox: { x: 0, y: 0, width: 100, height: 40 }, anchors: [], terminals: [] }
};
function append(model: DrawingModel, placement: DrawingPlacement) {
  return { ...model, sheets: model.sheets.map((s, i) => i ? s : { ...s, placements: [...s.placements, placement] }) };
}
function equipmentSource(model: DrawingModel, overrides: Partial<PlacementSource> = {}): PlacementSource {
  return {
    id: "session", sheetId: model.sheets[0].id, tool: "symbol", label: "Device",
    identity: { mode: "create", tagMode: "automatic" }, canRotate: true, targetKind: "sheet",
    build: ({ model: current, tag }) => {
      const assetId = createPlacementId("asset");
      const nextTag = tag ?? allocateNextTagFromPrefix({ model: current, prefix: "PDB" });
      return append({ ...current, assets: [...current.assets, { id: assetId, tag: nextTag, type: "other",
        title: "Device", symbolId: symbol.symbolId, versionId: symbol.versionId }] }, {
        id: createPlacementId(), assetId, symbolId: symbol.symbolId, versionId: symbol.versionId,
        role: "other", tag: nextTag, x: 0, y: 0, rotation: 0, scale: 0.2
      });
    }, ...overrides
  };
}
function physicalFixture() {
  let model = createDefaultDrawingModel();
  const panel = createPanelEnclosurePlacement({ model, activeSheet: model.sheets[0],
    assetId: "panel", tag: "PDP-101", x: 50, y: 20, width: 900, height: 900 });
  const backplane = createBackplanePlacement({ panelPlacement: panel, sheet: toSheetCanvasModel(model, model.sheets[0].id).sheet, id: "bp" });
  model = append(append(model, panel), backplane);
  const source = equipmentSource(model, { targetKind: "backplane", targetId: backplane.id,
    build: ({ model: current }) => append(current, {
      id: createPlacementId(), assetId: createPlacementId("asset"), symbolId: symbol.symbolId, versionId: symbol.versionId,
      tag: "PDB-101", role: "other", x: 0, y: 0, scale: 1, rotation: 0,
      layoutKind: "layout_helper", layoutParentId: backplane.id, containerAssetId: "panel",
      layoutDimensions: { lengthMm: 100, widthMm: 40 }, layoutPosition: { xMm: 50, yMm: 50 }
    })
  });
  return { model, panel, backplane, source };
}
describe("transient cursor placement", () => {
  it("continues only while Ctrl is held on the accepted click, without persisting a preference", () => {
    const source = equipmentSource(createDefaultDrawingModel());
    expect(canContinuePlacement(source, false)).toBe(false);
    expect(canContinuePlacement(source, true)).toBe(true);
    expect(canContinuePlacement(source, false)).toBe(false);
    expect(canContinuePlacement({ ...source, identity: { mode: "reference", assetId: "existing" } }, true)).toBe(false);
    expect(canContinuePlacement({ ...source, identity: { mode: "create", tagMode: "manual", tag: "SUPPLY" } }, true)).toBe(false);
    expect(canContinuePlacement({ ...source, identity: { mode: "create", tagMode: "manual", tag: "PDB-001A" } }, true)).toBe(true);
  });
  it("targets only the container under the pointer, never a nearby or previously selected one", () => {
    const { model, source } = physicalFixture();
    const first = getPlacementTargets(model, source.sheetId, "backplane")[0];
    const second = { ...first, id: "second", bounds: { x: 350, y: 200, width: 50, height: 50 } };
    expect(resolvePointerPlacementTarget(source, [first, second], { x: 375, y: 225 }).id).toBe("second");
    expect(resolvePointerPlacementTarget(source, [first, second], { x: -5, y: -5 }, first.id).id).toBeUndefined();
    expect(resolvePointerPlacementTarget(source, [first, second], null).id).toBeUndefined();
  });
  it("blocks ambiguous targets without a first-container fallback", () => {
    const { model, source } = physicalFixture();
    const target = getPlacementTargets(model, source.sheetId, "backplane")[0];
    const point = { x: target.bounds.x + 10, y: target.bounds.y + 10 };
    const targets = [target, { ...target, id: "overlapping" }];
    expect(resolvePointerPlacementTarget({ ...source, targetId: undefined }, targets, point).reason).toContain("overlap");
    expect(resolvePointerPlacementTarget(source, targets, point).id).toBe(target.id);
  });
  it("retains reference ownership and a dimension target when moving its offset outside", () => {
    const { model, source } = physicalFixture();
    const targets = getPlacementTargets(model, source.sheetId, "backplane");
    const point = { x: -5, y: -5 };
    expect(resolvePointerPlacementTarget({ ...source, identity: { mode: "reference", assetId: "a" } }, targets, point).id).toBe(source.targetId);
    expect(resolvePointerPlacementTarget({ ...source, tool: "dimension" }, targets, point, targets[0].id).id).toBe(targets[0].id);
    expect(resolvePointerPlacementTarget({ ...source, identity: { mode: "reference", assetId: "a" } }, [], point).reason).toContain("no longer");
  });
  it("validates commit coordinates and orientation", () => {
    const valid = { sessionId: "s", sheetId: "sheet", point: { x: 10, y: 20 }, rotation: 90 };
    expect(placementCommitInputSchema.safeParse(valid).success).toBe(true);
    expect(placementCommitInputSchema.safeParse({ ...valid, rotation: 45 }).success).toBe(false);
    expect(placementCommitInputSchema.safeParse({ ...valid, point: { x: Infinity, y: 0 } }).success).toBe(false);
  });
  it("preview, rotation, invalid attempts and cancellation never mutate the source model", () => {
    const model = createDefaultDrawingModel(), before = JSON.stringify(model);
    const source = equipmentSource(model);
    for (const rotation of [0, 90, 180, 270]) {
      const candidate = preparePlacementCandidate(source, model, [symbol], undefined, rotation);
      expect(resolvePlacementPreview(candidate, { x: -10, y: -10 }).valid).toBe(false);
    }
    expect(JSON.stringify(model)).toBe(before);
    expect(allocateNextTagFromPrefix({ model, prefix: "PDB" })).toBe("PDB-101");
  });
  it("reuses package-wide gaps, including tags reserved by unplaced assets and other sheets", () => {
    let model = createDefaultDrawingModel();
    model = { ...model, assets: [
      { id: "a", tag: "PDB-101", title: "Unplaced", type: "other" },
      { id: "b", tag: "PDB-103", title: "Unplaced", type: "other" }
    ] };
    const source = equipmentSource(model);
    const first = preparePlacementCandidate(source, model, [symbol]);
    expect(first.tag).toBe("PDB-102");
    model = positionPlacementCandidate(first, resolvePlacementPreview(first, { x: 100, y: 100 }));
    model = { ...model, sheets: [...model.sheets, { ...model.sheets[0], id: "other-sheet", placements: model.sheets[0].placements }] };
    expect(preparePlacementCandidate(source, model, [symbol]).tag).toBe("PDB-104");
    expect(placementTagAvailable(model, "pdb-102")).toBe(false);
  });
  it("creates independent IDs, retains pinned versions and advances only accepted placements", () => {
    let model = createDefaultDrawingModel();
    const source = equipmentSource(model);
    for (let i = 0; i < 3; i++) {
      const candidate = preparePlacementCandidate(source, model, [symbol], undefined, 0, "commit");
      model = positionPlacementCandidate(candidate, resolvePlacementPreview(candidate, { x: 80 + i * 30, y: 80 }));
    }
    expect(model.assets.map(a => a.tag)).toEqual(["PDB-101", "PDB-102", "PDB-103"]);
    expect(new Set(model.assets.map(a => a.id)).size).toBe(3);
    expect(new Set(model.sheets[0].placements.map(p => p.id)).size).toBe(3);
    expect(model.assets.every(a => a.versionId === "device-v1")).toBe(true);
    expect(model.sheets[0].connections).toEqual([]);
  });
  it("preserves padding and suffixes in custom sequences and skips occupied tags", () => {
    const model = createDefaultDrawingModel();
    model.assets.push({ id: "a", tag: "PDB-00102A", title: "Reserved", type: "other" });
    expect(nextManualPlacementTag(model, "PDB-00101A")).toBe("PDB-00103A");
    expect(nextManualPlacementTag(model, "SUPPLY")).toBeNull();
  });
  it.each([0, 90, 180, 270])("matches preview and final rotated body at %s degrees", rotation => {
    const model = createDefaultDrawingModel();
    const candidate = preparePlacementCandidate(equipmentSource(model), model, [symbol], undefined, rotation);
    const resolution = resolvePlacementPreview(candidate, { x: 100.123, y: 80.456 });
    expect(resolution.valid).toBe(true);
    const next = positionPlacementCandidate(candidate, resolution);
    const bounds = placementBodyBounds(next.sheets[0].placements[0], toSheetCanvasModel(next, next.sheets[0].id), [symbol], next);
    expect(bounds.x).toBeCloseTo(resolution.bounds.x, 3);
    expect(bounds.y).toBeCloseTo(resolution.bounds.y, 3);
    expect(bounds.width).toBeCloseTo(resolution.bounds.width, 3);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(100.123, 2);
  });
  it("does no creation, normalization or SVG generation on repeated pointer resolutions", () => {
    const model = createDefaultDrawingModel(), source = equipmentSource(model);
    source.build = vi.fn(source.build);
    const candidate = preparePlacementCandidate(source, model, [symbol]);
    for (let i = 0; i < 2000; i++) resolvePlacementPreview(candidate, { x: 50 + i / 100, y: 60 });
    expect(source.build).toHaveBeenCalledTimes(1);
    expect(model.assets).toEqual([]);
  });
  it("rejects missing targets and non-working sheets", () => {
    const { model, source } = physicalFixture();
    expect(() => preparePlacementCandidate(source, model, [symbol], "deleted")).toThrow("Choose a backplane");
    const title = createDefaultDrawingModel({ withTitleSheet: true });
    expect(() => preparePlacementCandidate(equipmentSource(title), title, [symbol])).toThrow("working drawing sheet");
  });
  it.each([0, 90, 180, 270])("uses physical millimetres and panel scale at rotation %s", rotation => {
    const { model, backplane, source } = physicalFixture();
    const candidate = preparePlacementCandidate(source, model, [symbol], backplane.id, rotation);
    const target = candidate.target!.usable;
    const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const preview = resolvePlacementPreview(candidate, point);
    expect(preview.valid).toBe(true);
    const next = positionPlacementCandidate(candidate, preview);
    const p = next.sheets[0].placements.at(-1)!;
    const bounds = placementBodyBounds(p, toSheetCanvasModel(next, next.sheets[0].id), [symbol], next);
    expect(bounds.x).toBeCloseTo(preview.bounds.x, 2);
    expect(bounds.y).toBeCloseTo(preview.bounds.y, 2);
    expect(p.layoutDimensions).toEqual({ lengthMm: 100, widthMm: 40 });
  });
  it("constrains full-span helpers rather than moving them along their spanned axis", () => {
    const { model, source, backplane } = physicalFixture();
    const candidate = preparePlacementCandidate({ ...source, tool: "helper", autoSpan: true }, model, [symbol], backplane.id);
    const target = candidate.target!.usable;
    const a = resolvePlacementPreview(candidate, { x: target.x + 20, y: target.y + 30 });
    const b = resolvePlacementPreview(candidate, { x: target.x + 50, y: target.y + 30 });
    expect(a.delta.x).toBe(b.delta.x);
    expect(a.bounds.x).toBeCloseTo(target.x, 3);
  });
  it("rejects oversized equipment rather than silently relocating or shrinking it", () => {
    const { model, source, backplane } = physicalFixture();
    const candidate = preparePlacementCandidate(source, model, [symbol], backplane.id);
    const huge = { ...candidate, bounds: { ...candidate.bounds, width: 2000 } };
    expect(resolvePlacementPreview(huge, { x: 120, y: 100 }).valid).toBe(false);
  });
  it("keeps fixed linked coordinates regardless of pointer position", () => {
    const { model, source, backplane } = physicalFixture();
    const candidate = preparePlacementCandidate({ ...source, fixedPosition: true }, model, [symbol], backplane.id);
    const target = candidate.target!.usable;
    const preview = resolvePlacementPreview(candidate, { x: target.x + 50, y: target.y + 50 });
    expect(preview.delta).toEqual({ x: 0, y: 0 });
  });
  it.each(["horizontal", "vertical"] as const)("moves only the %s dimension line offset", orientation => {
    const { model, source, backplane } = physicalFixture();
    const dimensionSource: PlacementSource = { ...source, tool: "dimension", canRotate: false,
      build: ({ model: current }) => append(current, createLayoutDimensionPlacement({
        backplane, sheet: toSheetCanvasModel(current, source.sheetId).sheet, orientation, id: createPlacementId("dim")
      }))
    };
    const candidate = preparePlacementCandidate(dimensionSource, model, [], backplane.id);
    const old = candidate.placements[0].layoutDimension!;
    const preview = resolvePlacementPreview(candidate, { x: 150, y: 150 });
    const next = positionPlacementCandidate(candidate, preview);
    const p = next.sheets[0].placements.at(-1)!;
    expect(p.layoutDimension!.startMm).toBe(old.startMm);
    expect(p.layoutDimension!.endMm).toBe(old.endMm);
    const geometry = getLayoutDimensionDisplayGeometry({ model: toSheetCanvasModel(next, source.sheetId), placement: p, backplane })!;
    expect(orientation === "horizontal" ? geometry.dimensionStart.y : geometry.dimensionStart.x).toBeCloseTo(150, 2);
    expect(preview.bounds).toEqual(geometry.bounds);
  });
  it("preserves specialist spacing while allowing equipment on a DIN rail", () => {
    const { model, source, backplane } = physicalFixture();
    const existing = source.build({ model, phase: "commit", rotation: 0 });
    const candidate = preparePlacementCandidate({ ...source, tool: "terminal-strip" }, existing, [symbol], backplane.id);
    const old = placementBodyBounds(existing.sheets[0].placements.at(-1)!, candidate.canvas, [symbol], existing);
    expect(resolvePlacementPreview(candidate, { x: old.x + old.width / 2, y: old.y + old.height / 2 }).valid).toBe(false);
    const railSymbol = { ...symbol, technicalKind: "rail" as const };
    const onRail = preparePlacementCandidate({ ...source, tool: "terminal-strip" }, existing, [railSymbol], backplane.id);
    expect(onRail.obstacles).toEqual([]);
  });
  it("undo/redo restores exactly the committed asset IDs and tags, one insertion at a time", () => {
    let model = createDefaultDrawingModel(), history = createEmptyDrawingHistory();
    const source = equipmentSource(model);
    const entry = () => ({ model, activeSheetId: source.sheetId, selection: { placementIds: [], annotationIds: [] } });
    for (let i = 0; i < 3; i++) {
      history = pushDrawingHistoryEntry(history, entry());
      const candidate = preparePlacementCandidate(source, model, [symbol]);
      model = positionPlacementCandidate(candidate, resolvePlacementPreview(candidate, { x: 80, y: 80 }));
    }
    const last = entry(), undo = undoDrawingHistory(history, last);
    expect(undo.entry!.model.assets).toHaveLength(2);
    const redo = redoDrawingHistory(undo.history, undo.entry!);
    expect(redo.entry!.model).toBe(last.model);
  });
  it("renders only the temporary objects, retaining real artwork and excluding title blocks", () => {
    const model = createDefaultDrawingModel();
    const candidate = preparePlacementCandidate(equipmentSource(model), model, [symbol]);
    const svg = renderDrawingToSvg({ model: candidate.canvas, approvedSymbols: [symbol], assets: candidate.model.assets,
      showAnchors: false, showConnections: false, renderOnly: { placementIds: new Set(candidate.selection.placementIds), annotationIds: new Set() } });
    expect(svg).toContain('fill="#eee"');
    expect(svg).not.toContain("title-block");
  });
  it("lists all targets, without selecting the first backplane implicitly", () => {
    const { model, backplane, source } = physicalFixture();
    const multiple = append(model, { ...backplane, id: "bp2" });
    expect(getPlacementTargets(multiple, source.sheetId, "backplane")).toHaveLength(2);
    expect(() => preparePlacementCandidate(source, multiple, [symbol])).toThrow("Choose a backplane");
  });
});
