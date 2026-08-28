import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { isGeneratedWireTraySymbolReference } from "./drawing-wire-tray-layouts";

export const layoutLabelPositions = [
  "center",
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
] as const;

export type LayoutLabelPosition = (typeof layoutLabelPositions)[number];

export const layoutLabelPositionLabels: Record<LayoutLabelPosition, string> = {
  center: "Center",
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right"
};

export type ResolvedLayoutLabel = {
  visible: boolean;
  position: LayoutLabelPosition;
  text: string;
  alignWithRotation: boolean;
};

export type LayoutLabelPoint = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export function getLayoutLabelPoint({
  placement,
  position
}: {
  placement: DrawingPlacement;
  position: LayoutLabelPosition;
}): LayoutLabelPoint {
  if (placement.labelPosition) {
    return {
      x: placement.labelPosition.x,
      y: placement.labelPosition.y,
      textAnchor: "middle"
    };
  }

  const width = placement.layoutDimensions?.lengthMm ?? 0;
  const height = placement.layoutDimensions?.widthMm ?? 0;
  const left = placement.x;
  const top = placement.y;
  const right = placement.x + width;
  const bottom = placement.y + height;
  const inset = 1.2;
  const outsideOffset = 1.35;
  const baselineCenterOffset = 0.75;
  const baselineBottomOffset = 3;

  switch (position) {
    case "center":
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((top + height / 2 + baselineCenterOffset).toFixed(2)),
        textAnchor: "middle"
      };
    case "top-left":
      return {
        x: Number((left + inset).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "start"
      };
    case "top-right":
      return {
        x: Number((right - inset).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "end"
      };
    case "bottom-left":
      return {
        x: Number((left + inset).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "start"
      };
    case "bottom-center":
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "middle"
      };
    case "bottom-right":
      return {
        x: Number((right - inset).toFixed(2)),
        y: Number((bottom + baselineBottomOffset).toFixed(2)),
        textAnchor: "end"
      };
    case "top-center":
    default:
      return {
        x: Number((left + width / 2).toFixed(2)),
        y: Number((top - outsideOffset).toFixed(2)),
        textAnchor: "middle"
      };
  }
}

export function isDinRailSymbol(
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  if (!symbol) {
    return false;
  }

  const descriptor = `${symbol.symbolKey} ${symbol.displayName} ${
    symbol.model ?? ""
  }`.toLowerCase();

  return (
    (symbol.technicalKind ?? symbol.category) === "rail" ||
    symbol.metadata.panelCategory === "rail" ||
    descriptor.includes("din rail") ||
    descriptor.includes("din_rail")
  );
}

export function defaultLayoutLabelPosition({
  placement,
  symbol
}: {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol | undefined;
}): LayoutLabelPosition {
  if (isGeneratedWireTraySymbolReference(placement)) {
    return "center";
  }

  if (isDinRailSymbol(symbol)) {
    return "top-right";
  }

  if (placement.assetId) {
    return "top-center";
  }

  return "top-center";
}

function defaultLayoutLabelVisible({
  placement,
  symbol
}: {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol | undefined;
}): boolean {
  if (placement.layoutKind !== "layout_helper" || !placement.layoutParentId) {
    return false;
  }

  if (
    isGeneratedWireTraySymbolReference(placement) ||
    isDinRailSymbol(symbol)
  ) {
    return false;
  }

  return Boolean(placement.assetId);
}

export function resolveLayoutLabel({
  placement,
  symbol
}: {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol | undefined;
}): ResolvedLayoutLabel {
  const text = placement.tag.trim();
  const defaultVisible = defaultLayoutLabelVisible({ placement, symbol });
  const visible = (placement.layoutLabel?.visible ?? defaultVisible) && text.length > 0;
  const position =
    placement.layoutLabel?.position ??
    defaultLayoutLabelPosition({ placement, symbol });

  return {
    visible,
    position,
    text,
    alignWithRotation:
      position === "center" && isGeneratedWireTraySymbolReference(placement)
  };
}
