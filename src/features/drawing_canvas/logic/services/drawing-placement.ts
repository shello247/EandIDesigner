import type { DrawingAnnotation, DrawingModel, DrawingPlacement, DrawingSheetCanvasModel } from "../../data/schema";
import type { PlacementIdentity, PlacementTargetKind, PlacementTool } from "../../data/placement-schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { toSheetCanvasModel, replaceSheetFromCanvasModel } from "../commands/drawing-sheet-commands";
import { getDetailedPanelUsableDrawingRect } from "../commands/drawing-panel-occurrence-commands";
import { getRotatedPlacementBounds, type PlacementBounds } from "./drawing-geometry";
import { getRenderableSymbolForPlacement, buildRenderableDrawingSymbols } from "./drawing-generated-symbols";
import { getPanelEnclosureDisplayBounds, isGeneratedPanelEnclosurePlacement } from "./drawing-asset-containment";
import { isBackplanePlacement, isLayoutHelperPlacement } from "./drawing-backplane-layouts";
import { getBackplaneDisplayBounds, getBackplanePhysicalUsableBounds, getParentPanelForBackplane,
  physicalRectToSheetRect, resolveLayoutHelperDisplayPlacement, moveLayoutHelperByDisplayDelta,
  resolveBackplaneLayoutScale } from "./drawing-backplane-scale";
import { getPanelConnectionViewBounds, getPanelConnectionViewInnerBounds, isPanelConnectionViewPlacement } from "./drawing-panel-connection-views";
import { getLayoutDimensionDisplayGeometry, updateLayoutDimensionPlacement } from "./drawing-layout-dimensions";
import { getAnnotationSize } from "./drawing-annotations";
import { getComponentCompositionBounds } from "@/features/symbol_components/api/public";
import { normalizeAssetTag, parseSteppableTag, stepEngineeringTag } from "./drawing-asset-identity";
import type { DrawingCanvasSelection } from "./drawing-selection";
import { isDinRailSymbol } from "./drawing-layout-labels";
import { isConnectedWireScheduleAnnotation, createConnectedWireScheduleLayout,
  type ConnectedWireScheduleIndex } from "@/features/drawing_connected_wire_schedule/api/public";

export type PlacementPoint = { x: number; y: number };
export type PlacementBuildContext = {
  model: DrawingModel; targetId?: string; tag?: string; rotation: number;
  phase: "preview" | "commit";
};
export type PlacementSource = {
  id: string; sheetId: string; tool: PlacementTool; label: string;
  identity: PlacementIdentity; canRotate: boolean;
  targetKind: PlacementTargetKind; targetId?: string;
  fixedPosition?: boolean; autoSpan?: boolean;
  scheduleProjections?: (model: DrawingModel, annotations: DrawingAnnotation[]) => ConnectedWireScheduleIndex;
  build: (context: PlacementBuildContext) => DrawingModel;
  /** Queue advancement is independent of repeated new-asset creation. */
  next?: () => PlacementSource | null;
};
export type PlacementTarget = { id: string; bounds: PlacementBounds; usable: PlacementBounds };
export type PlacementCandidate = {
  sourceModel: DrawingModel; model: DrawingModel; source: PlacementSource;
  canvas: DrawingSheetCanvasModel; symbols: ApprovedDrawingSymbol[];
  selection: DrawingCanvasSelection; placements: DrawingPlacement[]; annotations: DrawingAnnotation[];
  bounds: PlacementBounds; target?: PlacementTarget; tag: string; rotation: number;
  obstacles: PlacementBounds[];
  scheduleProjections: ConnectedWireScheduleIndex;
};
export type PlacementResolution = {
  valid: boolean; reason?: string; delta: PlacementPoint; bounds: PlacementBounds;
  dimensionOffset?: number;
};
const round = (value: number) => Number(value.toFixed(2));
export function createPlacementId(prefix = "pl") {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`.replaceAll("-", "_");
}
export function nextManualPlacementTag(model: DrawingModel, previous: string): string | null {
  if (!parseSteppableTag(previous)) return null;
  const used = new Set([...model.assets.map(a => a.tag), ...model.sheets.flatMap(s => s.placements.map(p => p.tag))].map(normalizeAssetTag));
  let next = stepEngineeringTag(previous, 1);
  while (next && used.has(normalizeAssetTag(next))) next = stepEngineeringTag(next, 1);
  return next;
}
export function placementTagAvailable(model: DrawingModel, tag: string, allowedAssetId?: string): boolean {
  const key = normalizeAssetTag(tag);
  return !model.assets.some(a => normalizeAssetTag(a.tag) === key && a.id !== allowedAssetId) &&
    !model.sheets.some(s => s.placements.some(p => normalizeAssetTag(p.tag) === key && (!allowedAssetId || p.assetId !== allowedAssetId)));
}
export function containsPlacementPoint(bounds: PlacementBounds, point: PlacementPoint) {
  return point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.width && point.y <= bounds.y + bounds.height;
}
/** Ctrl is a property of this accepted click, never a persistent tool preference. */
export function canContinuePlacement(source: PlacementSource, ctrlKey: boolean): boolean {
  return ctrlKey && source.identity.mode !== "reference" &&
    !(source.identity.mode === "create" && source.identity.tagMode === "manual" && !parseSteppableTag(source.identity.tag ?? ""));
}

/** Select only the container at the pointer. Never search for nearby free space. */
export function resolvePointerPlacementTarget(source: PlacementSource, targets: PlacementTarget[], point: PlacementPoint | null, previousId?: string): { id?: string; reason?: string } {
  if (source.targetKind === "sheet") return {};
  // References retain their configured ownership; dimensions can be offset
  // outside the measured backplane after the pointer identifies it.
  const retainedId = source.identity.mode === "reference" ? source.targetId
    : source.tool === "dimension" ? previousId ?? source.targetId : undefined;
  const hits = point ? targets.filter(target => containsPlacementPoint(target.bounds, point)) : [];
  if (retainedId && (source.identity.mode === "reference" || (source.tool === "dimension" && !hits.length))) {
    return targets.some(target => target.id === retainedId) ? { id: retainedId } : { reason: "The original target is no longer available." };
  }
  if (hits.length === 1) return { id: hits[0].id };
  if (hits.length > 1) {
    // A preselected container may disambiguate, but cannot attract a click
    // from outside its bounds or reposition the object.
    if (source.targetId && hits.some(target => target.id === source.targetId)) return { id: source.targetId };
    return { reason: "Containers overlap here. Move to an unambiguous area, or press Esc and select the intended container first." };
  }
  return { reason: `Move onto a ${source.targetKind.replaceAll("-", " ")} to preview placement.` };
}
function fits(inner: PlacementBounds, outer: PlacementBounds) {
  const tolerance = 0.03; // existing physical/display rounding is to hundredths
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;
}
export function getPlacementTargets(model: DrawingModel, sheetId: string, kind: PlacementTargetKind): PlacementTarget[] {
  if (kind === "sheet") return [];
  const canvas = toSheetCanvasModel(model, sheetId);
  return canvas.placements.flatMap(p => {
    if (kind === "backplane" && isBackplanePlacement(p)) {
      const parentPanel = getParentPanelForBackplane(canvas.placements, p);
      return [{ id: p.id,
        bounds: getBackplaneDisplayBounds(canvas.sheet, p, parentPanel),
        usable: physicalRectToSheetRect({ sheet: canvas.sheet, backplane: p, parentPanel, rect: getBackplanePhysicalUsableBounds(p) }) }];
    }
    if (kind === "panel" && isGeneratedPanelEnclosurePlacement(p)) {
      const bounds = getPanelEnclosureDisplayBounds(canvas.sheet, p);
      return [{ id: p.id, bounds, usable: bounds }];
    }
    if (kind === "connection-view" && isPanelConnectionViewPlacement(p)) {
      return [{ id: p.id, bounds: getPanelConnectionViewBounds(p), usable: getPanelConnectionViewInnerBounds(p) }];
    }
    return [];
  });
}
export function unionPlacementBounds(bounds: PlacementBounds[]): PlacementBounds {
  if (!bounds.length) throw new Error("This insertion has no visible objects.");
  const x = Math.min(...bounds.map(b => b.x)), y = Math.min(...bounds.map(b => b.y));
  return { x, y, width: Math.max(...bounds.map(b => b.x + b.width)) - x, height: Math.max(...bounds.map(b => b.y + b.height)) - y };
}
export function placementBodyBounds(p: DrawingPlacement, canvas: DrawingSheetCanvasModel, symbols: ApprovedDrawingSymbol[], model: DrawingModel): PlacementBounds {
  if (isGeneratedPanelEnclosurePlacement(p)) return getPanelEnclosureDisplayBounds(canvas.sheet, p);
  if (isPanelConnectionViewPlacement(p)) return getPanelConnectionViewBounds(p);
  const parent = canvas.placements.find(b => b.id === p.layoutParentId && isBackplanePlacement(b));
  if (isBackplanePlacement(p)) return getBackplaneDisplayBounds(canvas.sheet, p, getParentPanelForBackplane(canvas.placements, p));
  if (parent && p.layoutDimension) {
    const geometry = getLayoutDimensionDisplayGeometry({ model: canvas, placement: p, backplane: parent });
    if (geometry) return geometry.bounds;
  }
  const symbol = getRenderableSymbolForPlacement(p, symbols, model.assets);
  if (!symbol) throw new Error(`Artwork for ${p.tag} is unavailable.`);
  const display = parent ? resolveLayoutHelperDisplayPlacement({ sheet: canvas.sheet, placement: p, backplane: parent, parentPanel: getParentPanelForBackplane(canvas.placements, parent) }) : p;
  const body = getRotatedPlacementBounds(display, symbol.metadata);
  const asset = model.assets.find(a => a.id === p.assetId);
  if (!asset?.componentSelections?.length || !isLayoutHelperPlacement(p)) return body;
  const composition = getComponentCompositionBounds({ parentPlacement: display, parentSymbol: symbol, selections: asset.componentSelections, symbols });
  return unionPlacementBounds([body, composition]);
}
/** Runs creation logic only when configuration/target changes, never on mouse move. */
export function preparePlacementCandidate(source: PlacementSource, model: DrawingModel, symbols: ApprovedDrawingSymbol[], targetId?: string, rotation = 0, phase: "preview" | "commit" = "preview"): PlacementCandidate {
  const sheet = model.sheets.find(s => s.id === source.sheetId);
  if (!sheet || sheet.kind !== "drawing") throw new Error("Choose a working drawing sheet before placing objects.");
  const target = getPlacementTargets(model, source.sheetId, source.targetKind).find(t => t.id === targetId);
  if (source.targetKind !== "sheet" && !target) throw new Error(`Choose a ${source.targetKind.replaceAll("-", " ")} for this placement.`);
  const candidateModel = source.build({ model, targetId, rotation, phase, tag: source.identity.mode === "create" ? source.identity.tag : undefined });
  let canvas = toSheetCanvasModel(candidateModel, source.sheetId);
  const originalPlacements = new Set(sheet.placements.map(p => p.id));
  const originalAnnotations = new Set(sheet.annotations.map(a => a.id));
  const placementIds = canvas.placements.filter(p => !originalPlacements.has(p.id)).map(p => p.id);
  const annotationIds = canvas.annotations.filter(a => !originalAnnotations.has(a.id)).map(a => a.id);
  if (source.canRotate && rotation) {
    canvas = { ...canvas, placements: canvas.placements.map(p => placementIds.includes(p.id) ? { ...p, rotation: (p.rotation + rotation) % 360 } : p) };
  }
  const nextModel = replaceSheetFromCanvasModel(candidateModel, source.sheetId, canvas);
  const resolvedSymbols = buildRenderableDrawingSymbols({ placements: canvas.placements, approvedSymbols: symbols, assets: nextModel.assets });
  const placements = canvas.placements.filter(p => placementIds.includes(p.id));
  const annotations = canvas.annotations.filter(a => annotationIds.includes(a.id));
  const scheduleProjections = source.scheduleProjections?.(nextModel, annotations) ?? new Map();
  const bounds = unionPlacementBounds([
    ...placements.map(p => placementBodyBounds(p, canvas, resolvedSymbols, nextModel)),
    ...annotations.map(a => {
      const projection = scheduleProjections.get(a.id);
      const size = isConnectedWireScheduleAnnotation(a) && projection
        ? createConnectedWireScheduleLayout({ annotation: a, projection, sheet: canvas.sheet })
        : getAnnotationSize(a);
      return { x: a.x, y: a.y, width: size.width, height: size.height };
    })
  ]);
  // Preserve specialist collision rules without making rails obstacles to
  // equipment. These bounds are cached once, not recomputed on pointer moves.
  const backplane = canvas.placements.find(p => p.id === targetId && isBackplanePlacement(p));
  const stripOnBackplane = source.tool === "terminal-strip" && backplane;
  const connectionView = source.targetKind === "connection-view";
  const detailedOccurrence = source.tool === "reference" && Boolean(sheet.panelDrawingContext);
  const gap = stripOnBackplane
    ? 5 * resolveBackplaneLayoutScale(canvas.sheet, backplane, getParentPanelForBackplane(canvas.placements, backplane)).factor
    : detailedOccurrence ? Math.max(5, sheet.page.gridSize) : 4;
  const obstacles = stripOnBackplane || connectionView || detailedOccurrence ? sheet.placements
    .filter(p => detailedOccurrence || (p.layoutParentId === targetId && (connectionView || Boolean(p.assetId))))
    .filter(p => !isDinRailSymbol(getRenderableSymbolForPlacement(p, resolvedSymbols, model.assets)))
    .map(p => {
      const body = placementBodyBounds(p, canvas, resolvedSymbols, model);
      return { x: body.x - gap, y: body.y - gap, width: body.width + gap * 2, height: body.height + gap * 2 };
    }) : [];
  return { sourceModel: model, model: nextModel, source, canvas, symbols: resolvedSymbols, selection: { placementIds, annotationIds }, placements, annotations, bounds, target,
    tag: placements[0]?.tag ?? source.label, rotation, obstacles, scheduleProjections };
}
/** Pure, bounded geometry only: no IDs, model copies, command execution or history. */
export function resolvePlacementPreview(candidate: PlacementCandidate, point: PlacementPoint): PlacementResolution {
  const { source, bounds, target, canvas } = candidate;
  let delta = { x: round(point.x - bounds.x - bounds.width / 2), y: round(point.y - bounds.y - bounds.height / 2) };
  let dimensionOffset: number | undefined;
  if (source.fixedPosition || source.tool === "backplane") delta = { x: 0, y: 0 };
  if (source.autoSpan && target) {
    if (candidate.rotation % 180 === 0) delta.x = round(target.usable.x - bounds.x);
    else delta.y = round(target.usable.y - bounds.y);
  }
  const p = candidate.placements[0];
  if (source.tool === "dimension" && p?.layoutDimension) {
    const backplane = canvas.placements.find(b => b.id === p.layoutParentId)!;
    const geometry = getLayoutDimensionDisplayGeometry({ model: canvas, placement: p, backplane });
    if (geometry) {
      const horizontal = p.layoutDimension.orientation === "horizontal";
      delta = horizontal ? { x: 0, y: point.y - geometry.dimensionStart.y } : { x: point.x - geometry.dimensionStart.x, y: 0 };
      const factor = resolveBackplaneLayoutScale(canvas.sheet, backplane, getParentPanelForBackplane(canvas.placements, backplane)).factor;
      dimensionOffset = round(p.layoutDimension.offsetMm + (horizontal ? delta.y : delta.x) / factor);
    }
  }
  let moved = { ...bounds, x: round(bounds.x + delta.x), y: round(bounds.y + delta.y) };
  if (dimensionOffset !== undefined && p?.layoutDimension) {
    const backplane = canvas.placements.find(b => b.id === p.layoutParentId)!;
    const dimension = updateLayoutDimensionPlacement({ placement: p, backplane, sheet: canvas.sheet, updates: { offsetMm: dimensionOffset } });
    moved = getLayoutDimensionDisplayGeometry({ model: canvas, placement: dimension, backplane })?.bounds ?? moved;
  }
  const fail = (reason: string): PlacementResolution => ({ valid: false, reason, delta, bounds: moved, dimensionOffset });
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return fail("Move the pointer onto the drawing.");
  if (target && !containsPlacementPoint(target.bounds, point) && source.tool !== "dimension") return fail("Move onto the highlighted container to place here.");
  if (!fits(moved, { x: 0, y: 0, width: canvas.sheet.width, height: canvas.sheet.height }) && source.tool !== "dimension") return fail("The complete object must fit on the drawing sheet.");
  if (target && source.tool !== "dimension" && source.tool !== "backplane" && !fits(moved, target.usable)) return fail("The complete object must fit inside the selected target.");
  const packageSheet = candidate.model.sheets.find(sheet => sheet.id === source.sheetId)!;
  if (source.tool === "reference" && packageSheet.panelDrawingContext && !fits(moved, getDetailedPanelUsableDrawingRect(packageSheet))) return fail("Keep equipment inside the Detailed Panel drawing area, clear of its title block.");
  if (candidate.obstacles.some(b => moved.x < b.x + b.width && moved.x + moved.width > b.x &&
    moved.y < b.y + b.height && moved.y + moved.height > b.y)) return fail("This position overlaps equipment or its required placement spacing.");
  if (source.tool === "dimension" && (point.x < 0 || point.y < 0 || point.x > canvas.sheet.width || point.y > canvas.sheet.height)) return fail("Place the dimension line on the drawing sheet.");
  return { valid: true, delta, bounds: moved, dimensionOffset };
}

/** Applies the same resolution displayed by the ghost, without clamping or auto-positioning. */
export function positionPlacementCandidate(candidate: PlacementCandidate, resolution: PlacementResolution): DrawingModel {
  if (!resolution.valid) throw new Error(resolution.reason ?? "This placement is not valid.");
  const { canvas, selection, model, source } = candidate;
  const selected = new Set(selection.placementIds), annotations = new Set(selection.annotationIds);
  const translate = (p: PlacementPoint) => ({ x: round(p.x + resolution.delta.x), y: round(p.y + resolution.delta.y) });
  const placements = canvas.placements.map(p => {
    if (!selected.has(p.id)) return p;
    const parent = canvas.placements.find(b => b.id === p.layoutParentId && isBackplanePlacement(b));
    if (p.layoutDimension && parent && resolution.dimensionOffset !== undefined) return updateLayoutDimensionPlacement({ placement: p, backplane: parent, sheet: canvas.sheet, updates: { offsetMm: resolution.dimensionOffset } });
    if (parent && !selected.has(parent.id)) return moveLayoutHelperByDisplayDelta({ placement: p, backplane: parent, sheet: canvas.sheet, delta: resolution.delta, parentPanel: getParentPanelForBackplane(canvas.placements, parent) });
    return { ...p, ...translate(p), labelPosition: p.labelPosition ? translate(p.labelPosition) : undefined, deviceTitlePosition: p.deviceTitlePosition ? translate(p.deviceTitlePosition) : undefined };
  });
  return replaceSheetFromCanvasModel(model, source.sheetId, { ...canvas, placements, annotations: canvas.annotations.map(a => {
    if (!annotations.has(a.id)) return a;
    const positioned = { ...a, ...translate(a) };
    return !isConnectedWireScheduleAnnotation(a) && a.leader
      ? { ...positioned, leader: { ...a.leader, targetX: round(a.leader.targetX + resolution.delta.x), targetY: round(a.leader.targetY + resolution.delta.y) } }
      : positioned;
  }) });
}
