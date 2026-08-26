import type { DrawingCanvasSelection } from "./drawing-selection";
import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  isBackplanePlacement,
  shouldAutosizeLayoutSymbolToBackplane
} from "./drawing-backplane-layouts";
import { isLayoutDimensionPlacement } from "./drawing-layout-dimensions";

export type DrawingInspectorContext =
  | { kind: "empty" }
  | {
      kind: "multiple";
      placementCount: number;
      annotationCount: number;
    }
  | { kind: "placement"; placementId: string }
  | { kind: "annotation"; annotationId: string }
  | { kind: "connection"; connectionId: string };

export function isInspectorLayoutOnlyPlacement(
  placement: DrawingPlacement | undefined,
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  return Boolean(
    isBackplanePlacement(placement) ||
      isLayoutDimensionPlacement(placement) ||
      (symbol &&
        (shouldAutosizeLayoutSymbolToBackplane(symbol) ||
          (symbol.technicalKind ?? symbol.category) === "label"))
  );
}

export function resolveDrawingInspectorContext(input: {
  selection: DrawingCanvasSelection;
  selectedConnectionId?: string;
}): DrawingInspectorContext {
  const placementCount = input.selection.placementIds.length;
  const annotationCount = input.selection.annotationIds.length;
  const selectedObjectCount = placementCount + annotationCount;

  if (selectedObjectCount > 1) {
    return {
      kind: "multiple",
      placementCount,
      annotationCount
    };
  }

  if (input.selectedConnectionId) {
    return {
      kind: "connection",
      connectionId: input.selectedConnectionId
    };
  }

  if (placementCount === 1) {
    return {
      kind: "placement",
      placementId: input.selection.placementIds[0]
    };
  }

  if (annotationCount === 1) {
    return {
      kind: "annotation",
      annotationId: input.selection.annotationIds[0]
    };
  }

  return { kind: "empty" };
}
