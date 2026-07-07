import type {
  DrawingAnnotation,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getPlacementBounds } from "./drawing-geometry";
import { getAnnotationSize } from "./drawing-annotations";
import {
  getPanelEnclosureBounds,
  isGeneratedPanelEnclosurePlacement
} from "./drawing-asset-containment";
import { getSymbolForPlacement } from "./drawing-connections";

export type DrawingCanvasSelection = {
  placementIds: string[];
  annotationIds: string[];
};

export type SelectionKind = "placement" | "annotation";

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const EMPTY_CANVAS_SELECTION: DrawingCanvasSelection = {
  placementIds: [],
  annotationIds: []
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sortedByModelOrder<T extends { id: string }>(
  ids: string[],
  items: T[]
): string[] {
  const selected = new Set(ids);

  return items.filter((item) => selected.has(item.id)).map((item) => item.id);
}

export function normalizeCanvasSelection(
  selection: DrawingCanvasSelection,
  model: DrawingSheetCanvasModel
): DrawingCanvasSelection {
  return {
    placementIds: sortedByModelOrder(unique(selection.placementIds), model.placements),
    annotationIds: sortedByModelOrder(
      unique(selection.annotationIds),
      model.annotations
    )
  };
}

export function isCanvasSelectionEmpty(
  selection: DrawingCanvasSelection
): boolean {
  return selection.placementIds.length === 0 && selection.annotationIds.length === 0;
}

export function canvasSelectionCount(selection: DrawingCanvasSelection): number {
  return selection.placementIds.length + selection.annotationIds.length;
}

export function primaryPlacementId(
  selection: DrawingCanvasSelection
): string | undefined {
  return selection.placementIds.length === 1 &&
    selection.annotationIds.length === 0
    ? selection.placementIds[0]
    : undefined;
}

export function primaryAnnotationId(
  selection: DrawingCanvasSelection
): string | undefined {
  return selection.annotationIds.length === 1 &&
    selection.placementIds.length === 0
    ? selection.annotationIds[0]
    : undefined;
}

export function createSingleSelection(
  kind: SelectionKind,
  id: string | undefined
): DrawingCanvasSelection {
  if (!id) {
    return { ...EMPTY_CANVAS_SELECTION };
  }

  return kind === "placement"
    ? { placementIds: [id], annotationIds: [] }
    : { placementIds: [], annotationIds: [id] };
}

export function toggleCanvasSelection(
  selection: DrawingCanvasSelection,
  kind: SelectionKind,
  id: string
): DrawingCanvasSelection {
  const targetKey = kind === "placement" ? "placementIds" : "annotationIds";
  const current = new Set(selection[targetKey]);

  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }

  return {
    placementIds:
      kind === "placement" ? [...current] : [...selection.placementIds],
    annotationIds:
      kind === "annotation" ? [...current] : [...selection.annotationIds]
  };
}

export function replaceCanvasSelection(
  selection: DrawingCanvasSelection,
  kind: SelectionKind,
  id: string,
  additive: boolean
): DrawingCanvasSelection {
  return additive
    ? toggleCanvasSelection(selection, kind, id)
    : createSingleSelection(kind, id);
}

function normalizeRect(rect: {
  start: { x: number; y: number };
  end: { x: number; y: number };
}): SelectionRect {
  const x = Math.min(rect.start.x, rect.end.x);
  const y = Math.min(rect.start.y, rect.end.y);

  return {
    x,
    y,
    width: Math.abs(rect.end.x - rect.start.x),
    height: Math.abs(rect.end.y - rect.start.y)
  };
}

function rectsIntersect(first: SelectionRect, second: SelectionRect): boolean {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

function placementRect(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): SelectionRect | null {
  if (isGeneratedPanelEnclosurePlacement(placement)) {
    return getPanelEnclosureBounds(placement);
  }

  const symbol = getSymbolForPlacement(placement, symbols);

  if (!symbol) {
    return null;
  }

  return getPlacementBounds(placement, symbol.metadata);
}

function annotationRect(annotation: DrawingAnnotation): SelectionRect {
  const size = getAnnotationSize(annotation);

  return {
    x: annotation.x,
    y: annotation.y,
    width: size.width,
    height: size.height
  };
}

export function getMarqueeSelection(params: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  start: { x: number; y: number };
  end: { x: number; y: number };
}): DrawingCanvasSelection {
  const marquee = normalizeRect({ start: params.start, end: params.end });

  if (marquee.width < 1 || marquee.height < 1) {
    return { ...EMPTY_CANVAS_SELECTION };
  }

  return {
    placementIds: params.model.placements
      .filter((placement) => {
        const bounds = placementRect(placement, params.symbols);

        return bounds ? rectsIntersect(marquee, bounds) : false;
      })
      .map((placement) => placement.id),
    annotationIds: params.model.annotations
      .filter((annotation) => annotation.kind !== "title")
      .filter((annotation) => rectsIntersect(marquee, annotationRect(annotation)))
      .map((annotation) => annotation.id)
  };
}

export function getSelectionBounds(params: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  selection: DrawingCanvasSelection;
}): SelectionRect | null {
  const placementIds = new Set(params.selection.placementIds);
  const annotationIds = new Set(params.selection.annotationIds);
  const rects = [
    ...params.model.placements
      .filter((placement) => placementIds.has(placement.id))
      .map((placement) => placementRect(placement, params.symbols))
      .filter((rect): rect is SelectionRect => Boolean(rect)),
    ...params.model.annotations
      .filter((annotation) => annotationIds.has(annotation.id))
      .map(annotationRect)
  ];

  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}
