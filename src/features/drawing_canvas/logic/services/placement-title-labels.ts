import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

const PLACEMENT_LABEL_LINE_GAP = 5.2;

export function getPlacementDisplayTitle(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): string {
  return placement.title?.trim() || symbol.displayName.trim();
}

export function shouldShowPlacementTitle(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): boolean {
  return Boolean(getPlacementDisplayTitle(placement, symbol));
}

export function getPlacementTitlePoint(
  placement: DrawingPlacement
): { x: number; y: number } {
  if (placement.labelPosition) {
    return placement.labelPosition;
  }

  if (placement.deviceTitlePosition) {
    return placement.deviceTitlePosition;
  }

  return {
    x: placement.x,
    y: Number((placement.y + 2.2).toFixed(2))
  };
}

export function getPlacementLabelPoints(
  placement: DrawingPlacement
): {
  tagPoint: { x: number; y: number };
  titlePoint: { x: number; y: number };
} {
  const titlePoint = getPlacementTitlePoint(placement);

  return {
    tagPoint: {
      x: titlePoint.x,
      y: Number((titlePoint.y - PLACEMENT_LABEL_LINE_GAP).toFixed(2))
    },
    titlePoint
  };
}
