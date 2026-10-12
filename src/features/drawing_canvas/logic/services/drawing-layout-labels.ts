import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { isGeneratedWireTraySymbolReference } from "./drawing-wire-tray-layouts";
import { getPlacementBounds, type WorldPoint } from "./drawing-geometry";

export const layoutLabelSizes = { compact: 2, standard: 2.5, large: 3 } as const;
export const layoutLabelStyle = {
  fontFamily: "Inter, Poppins, Arial, Helvetica, sans-serif",
  fontWeight: 400,
  letterSpacing: 0,
  fill: "#1f2937",
  leaderStroke: "#64748b",
  leaderWidth: 0.15,
  leaderClearance: 0.6
} as const;

export type LayoutLabelSize = keyof typeof layoutLabelSizes;
export type LayoutLabelGeometry = ResolvedLayoutLabel & {
  point: LayoutLabelPoint;
  size: LayoutLabelSize;
  fontSize: number;
  rotation: 0 | 90 | 270;
  textCorners: WorldPoint[];
  leader?: { from: WorldPoint; to: WorldPoint };
};

function rotatePoint(point: WorldPoint, center: WorldPoint, degrees: number): WorldPoint {
  const angle = degrees * Math.PI / 180;
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: center.y + x * Math.sin(angle) + y * Math.cos(angle) };
}

// Stored manual points carry the placement's original sheet offset, not the
// backplane's projected display offset. Never scale the annotation font.
export function layoutLabelDisplayToStored(
  point: WorldPoint, placement: DrawingPlacement, displayed: DrawingPlacement
): WorldPoint {
  return { x: Number((point.x - displayed.x + placement.x).toFixed(2)),
    y: Number((point.y - displayed.y + placement.y).toFixed(2)) };
}

export function resolveLayoutLabelGeometry({
  placement, symbol
}: { placement: DrawingPlacement; symbol: ApprovedDrawingSymbol | undefined }): LayoutLabelGeometry {
  const label = resolveLayoutLabel({ placement, symbol });
  const point = getLayoutLabelPoint({ placement, position: label.position });
  const size = placement.layoutLabel?.size ?? "compact";
  const fontSize = layoutLabelSizes[size];
  const deviceRotation = ((placement.rotation % 360) + 360) % 360;
  const automaticRotation = label.alignWithRotation &&
    (Math.abs(deviceRotation - 90) < 1 || Math.abs(deviceRotation - 270) < 1) ? 90 : 0;
  const rotation = placement.layoutLabel?.rotation ?? automaticRotation;
  // Deliberately conservative, deterministic em bounds; not DOM measurement,
  // tag fitting or collision avoidance. Allow wide glyphs and descenders.
  const textWidth = Array.from(label.text).length * fontSize;
  const left = point.x - (point.textAnchor === "middle" ? textWidth / 2 : point.textAnchor === "end" ? textWidth : 0);
  const top = point.y - fontSize;
  const height = fontSize * 1.3;
  const textCenter = rotatePoint({ x: left + textWidth / 2, y: top + height / 2 }, point, rotation);
  const textCorners = [
    { x: left, y: top }, { x: left + textWidth, y: top },
    { x: left + textWidth, y: top + height }, { x: left, y: top + height }
  ].map(corner => rotatePoint(corner, point, rotation));
  const result: LayoutLabelGeometry = { ...label, point, size, fontSize, rotation, textCorners };
  if (!label.visible || !placement.layoutLabel?.leader) return result;
  const body = symbol ? getPlacementBounds(placement, symbol.metadata) : {
    x: placement.x, y: placement.y,
    width: placement.layoutDimensions?.lengthMm ?? 0,
    height: placement.layoutDimensions?.widthMm ?? 0
  };
  if (body.width <= 0 || body.height <= 0) return result;
  const bodyCenter = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
  const localAnchor = rotatePoint(point, bodyCenter, -deviceRotation);
  if (localAnchor.x >= body.x && localAnchor.x <= body.x + body.width &&
      localAnchor.y >= body.y && localAnchor.y <= body.y + body.height) return result;
  const distance = Math.hypot(textCenter.x - bodyCenter.x, textCenter.y - bodyCenter.y);
  if (distance < 0.001) return result;
  const direction = { x: (textCenter.x - bodyCenter.x) / distance, y: (textCenter.y - bodyCenter.y) / distance };
  const rayExtent = (width: number, rectHeight: number, angle: number) => {
    const local = rotatePoint(direction, { x: 0, y: 0 }, -angle);
    return Math.min(Math.abs(local.x) < 1e-9 ? Infinity : width / 2 / Math.abs(local.x),
      Math.abs(local.y) < 1e-9 ? Infinity : rectHeight / 2 / Math.abs(local.y));
  };
  const start = rayExtent(body.width, body.height, deviceRotation);
  const end = distance - rayExtent(textWidth, height, rotation) - layoutLabelStyle.leaderClearance;
  if (end <= start + 0.001) return result;
  result.leader = {
    from: { x: bodyCenter.x + direction.x * start, y: bodyCenter.y + direction.y * start },
    to: { x: bodyCenter.x + direction.x * end, y: bodyCenter.y + direction.y * end }
  };
  return result;
}

const xml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

export function renderLayoutLabelText(id: string, label: LayoutLabelGeometry): string {
  if (!label.visible) return "";
  const p = label.point;
  return `<g data-layout-helper-label-id="${xml(id)}" transform="rotate(${label.rotation} ${p.x} ${p.y})"><text data-placement-tag="${xml(id)}" x="${p.x}" y="${p.y}" text-anchor="${p.textAnchor}" font-family="${layoutLabelStyle.fontFamily}" font-size="${label.fontSize}" font-weight="${layoutLabelStyle.fontWeight}" letter-spacing="${layoutLabelStyle.letterSpacing}" fill="${layoutLabelStyle.fill}">${xml(label.text)}</text></g>`;
}

export function renderLayoutLabelLeader(id: string, label: LayoutLabelGeometry): string {
  if (!label.visible || !label.leader) return "";
  const { from, to } = label.leader;
  return `<line data-layout-label-leader-id="${xml(id)}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${layoutLabelStyle.leaderStroke}" stroke-width="${layoutLabelStyle.leaderWidth}" fill="none" pointer-events="none"/>`;
}

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
