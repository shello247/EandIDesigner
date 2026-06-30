import type { DrawingModel } from "../../../data/schema";
import type { ViewportSize } from "../../../logic/services/viewport-transform";
import type { AnchorHotspot } from "../types";

export const MIN_PLACEMENT_SCALE = 0.05;
export const MAX_PLACEMENT_SCALE = 6;

export function packageKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

export function toSvgPoint(
  event: {
    currentTarget: SVGElement;
    clientX: number;
    clientY: number;
  },
  sheet: DrawingModel["sheet"]
) {
  const svgElement = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svgElement.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * sheet.width,
    y: ((event.clientY - rect.top) / rect.height) * sheet.height
  };
}

export function snap(value: number, gridSize: number): number {
  return Number((Math.round(value / gridSize) * gridSize).toFixed(2));
}

export function clampPlacementScale(scale: number): number {
  return Math.min(MAX_PLACEMENT_SCALE, Math.max(MIN_PLACEMENT_SCALE, scale));
}

export function getViewportSize(element: HTMLDivElement): ViewportSize {
  const rect = element.getBoundingClientRect();

  return {
    width: rect.width,
    height: rect.height
  };
}

export function getTooltipPosition(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
) {
  const left = Math.max(0, Math.min(100, (point.x / sheet.width) * 100));
  const top = Math.max(0, Math.min(100, (point.y / sheet.height) * 100));
  const translateX = left > 68 ? "-100%" : "12px";
  const translateY = top > 72 ? "-100%" : "12px";

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${translateX}, ${translateY})`
  };
}

export function getAnchorLabel(hotspot: AnchorHotspot): string {
  if (hotspot.terminal) {
    return `Show data for ${hotspot.placementTag} terminal ${hotspot.terminal.key}`;
  }

  return `Show data for ${hotspot.placementTag} anchor ${hotspot.anchor.key}`;
}
