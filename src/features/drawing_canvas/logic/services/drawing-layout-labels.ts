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

function isDinRailSymbol(symbol: ApprovedDrawingSymbol | undefined): boolean {
  if (!symbol) {
    return false;
  }

  const descriptor = `${symbol.symbolKey} ${symbol.displayName} ${
    symbol.model ?? ""
  }`.toLowerCase();

  return (
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

  return Boolean(
    placement.assetId ||
      isGeneratedWireTraySymbolReference(placement) ||
      isDinRailSymbol(symbol)
  );
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
