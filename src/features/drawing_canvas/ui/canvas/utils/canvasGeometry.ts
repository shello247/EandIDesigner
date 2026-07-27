import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import type { ViewportSize } from "../../../logic/services/viewport-transform";
import type {
  AnchorHotspot,
  PlacementResizeState,
  PlacementRotationState
} from "../types";
import {
  MIN_PANEL_ENCLOSURE_HEIGHT,
  MIN_PANEL_ENCLOSURE_WIDTH
} from "../../../logic/services/drawing-asset-containment";

export const MIN_PLACEMENT_SCALE = 0.05;
export const MAX_PLACEMENT_SCALE = 6;

function roundCanvasValue(value: number, precision = 2): number {
  const rounded = Number(value.toFixed(precision));

  return Object.is(rounded, -0) ? 0 : rounded;
}

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

export function normalizeRotation(rotation: number): number {
  const normalized = rotation % 360;

  return Number((normalized < 0 ? normalized + 360 : normalized).toFixed(2));
}

export function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  rotation: number
) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: Number((center.x + dx * cos - dy * sin).toFixed(2)),
    y: Number((center.y + dx * sin + dy * cos).toFixed(2))
  };
}

export function getRotationAngleFromPointer(
  center: { x: number; y: number },
  pointer: { x: number; y: number }
): number {
  return normalizeRotation(
    (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) /
      Math.PI +
      90
  );
}

function shortestRotationDelta(from: number, to: number): number {
  const delta = normalizeRotation(to - from);

  return delta > 180 ? delta - 360 : delta;
}

export function snapPlacementRotation(
  rotation: number,
  snapThreshold = 6
): number {
  const normalized = normalizeRotation(rotation);
  const snapTarget = normalizeRotation(Math.round(normalized / 90) * 90);
  const distance = Math.abs(shortestRotationDelta(normalized, snapTarget));

  return distance <= snapThreshold ? snapTarget : normalized;
}

export function calculatePlacementRotationUpdate(
  rotationState: PlacementRotationState,
  pointer: { x: number; y: number }
) {
  const pointerAngle = getRotationAngleFromPointer(
    rotationState.center,
    pointer
  );
  const nextRotation =
    rotationState.startRotation +
    shortestRotationDelta(rotationState.startPointerAngle, pointerAngle);

  return {
    rotation: snapPlacementRotation(nextRotation)
  };
}

export function calculatePlacementResizeUpdate(
  resizeState: PlacementResizeState,
  pointer: { x: number; y: number }
) {
  const localPointer =
    resizeState.center && resizeState.rotation
      ? rotatePoint(pointer, resizeState.center, -resizeState.rotation)
      : pointer;
  const horizontalDistance =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - localPointer.x
      : localPointer.x - resizeState.fixedPoint.x;
  const verticalDistance =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - localPointer.y
      : localPointer.y - resizeState.fixedPoint.y;
  const nextScale = clampPlacementScale(
    Math.max(
      horizontalDistance / resizeState.baseSize.width,
      verticalDistance / resizeState.baseSize.height
    )
  );
  const nextWidth = resizeState.baseSize.width * nextScale;
  const nextHeight = resizeState.baseSize.height * nextScale;
  const nextX =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - nextWidth
      : resizeState.fixedPoint.x;
  const nextY =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - nextHeight
      : resizeState.fixedPoint.y;

  return {
    x: Number(nextX.toFixed(2)),
    y: Number(nextY.toFixed(2)),
    scale: Number(nextScale.toFixed(3))
  };
}

export function calculatePlacementDimensionResizeUpdate(
  resizeState: PlacementResizeState,
  pointer: { x: number; y: number }
) {
  const localPointer =
    resizeState.center && resizeState.rotation
      ? rotatePoint(pointer, resizeState.center, -resizeState.rotation)
      : pointer;
  const rawWidth =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - localPointer.x
      : localPointer.x - resizeState.fixedPoint.x;
  const rawHeight =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - localPointer.y
      : localPointer.y - resizeState.fixedPoint.y;
  const width = Math.max(5, rawWidth);
  const height = Math.max(5, rawHeight);
  const x =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - width
      : resizeState.fixedPoint.x;
  const y =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - height
      : resizeState.fixedPoint.y;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    layoutDimensions: {
      lengthMm: Number(width.toFixed(2)),
      widthMm: Number(height.toFixed(2))
    }
  };
}

export function calculatePlacementLengthResizeUpdate(
  resizeState: PlacementResizeState,
  pointer: { x: number; y: number }
) {
  const rotationRadians = ((resizeState.rotation ?? 0) * Math.PI) / 180;
  const axis = {
    x: Math.cos(rotationRadians),
    y: Math.sin(rotationRadians)
  };
  const pointerDelta =
    resizeState.handle === "length-start"
      ? {
          x: resizeState.fixedPoint.x - pointer.x,
          y: resizeState.fixedPoint.y - pointer.y
        }
      : {
          x: pointer.x - resizeState.fixedPoint.x,
          y: pointer.y - resizeState.fixedPoint.y
        };
  const length = Math.max(
    5,
    pointerDelta.x * axis.x + pointerDelta.y * axis.y
  );
  const direction = resizeState.handle === "length-start" ? -1 : 1;
  const center = {
    x: resizeState.fixedPoint.x + axis.x * (length / 2) * direction,
    y: resizeState.fixedPoint.y + axis.y * (length / 2) * direction
  };
  const width = resizeState.baseSize.height;

  return {
    x: roundCanvasValue(center.x - length / 2),
    y: roundCanvasValue(center.y - width / 2),
    layoutDimensions: {
      lengthMm: roundCanvasValue(length),
      widthMm: roundCanvasValue(width)
    }
  };
}

export function calculatePanelEnclosureResizeUpdate(
  resizeState: PlacementResizeState,
  pointer: { x: number; y: number }
) {
  const rawWidth =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - pointer.x
      : pointer.x - resizeState.fixedPoint.x;
  const rawHeight =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - pointer.y
      : pointer.y - resizeState.fixedPoint.y;
  const width = Math.max(MIN_PANEL_ENCLOSURE_WIDTH, rawWidth);
  const height = Math.max(MIN_PANEL_ENCLOSURE_HEIGHT, rawHeight);
  const x =
    resizeState.handle === "nw" || resizeState.handle === "sw"
      ? resizeState.fixedPoint.x - width
      : resizeState.fixedPoint.x;
  const y =
    resizeState.handle === "nw" || resizeState.handle === "ne"
      ? resizeState.fixedPoint.y - height
      : resizeState.fixedPoint.y;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2))
  };
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
