import type { SvgViewBox } from "./svg-inspector";

export const SVG_STAGE_MAX_SIZE_PX = 620;
export const SVG_MARKER_DIAMETER_PX = 18;
export const SVG_MARKER_STROKE_PX = 1.5;
export const SVG_MARKER_INNER_GLOW_DIAMETER_PX = 28;
export const SVG_MARKER_OUTER_GLOW_DIAMETER_PX = 40;
export const SVG_ANCHOR_SELECTION_RADIUS_PX = 12;

export type SvgPoint = {
  x: number;
  y: number;
};

export type SvgRenderedSize = {
  width: number;
  height: number;
};

export type SvgTransformMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export function isUsableSvgViewBox(viewBox: SvgViewBox): boolean {
  return (
    Number.isFinite(viewBox.x) &&
    Number.isFinite(viewBox.y) &&
    Number.isFinite(viewBox.width) &&
    Number.isFinite(viewBox.height) &&
    viewBox.width > 0 &&
    viewBox.height > 0
  );
}

export function getMaximumSvgStageDimensions(
  viewBox: SvgViewBox,
  maximumSizePx = SVG_STAGE_MAX_SIZE_PX
): SvgRenderedSize {
  if (!isUsableSvgViewBox(viewBox) || maximumSizePx <= 0) {
    return { width: 0, height: 0 };
  }

  if (viewBox.width >= viewBox.height) {
    return {
      width: maximumSizePx,
      height: (maximumSizePx * viewBox.height) / viewBox.width
    };
  }

  return {
    width: (maximumSizePx * viewBox.width) / viewBox.height,
    height: maximumSizePx
  };
}

export function getResponsiveSvgStageDimensions(
  viewBox: SvgViewBox,
  availableWidthPx: number,
  maximumSizePx = SVG_STAGE_MAX_SIZE_PX
): SvgRenderedSize {
  const maximum = getMaximumSvgStageDimensions(viewBox, maximumSizePx);

  if (maximum.width <= 0 || !Number.isFinite(availableWidthPx)) {
    return { width: 0, height: 0 };
  }

  const width = Math.max(0, Math.min(availableWidthPx, maximum.width));
  return {
    width,
    height: (width * viewBox.height) / viewBox.width
  };
}

export function getRenderedPixelsPerUserUnit(
  viewBox: SvgViewBox,
  renderedSize: SvgRenderedSize
): number {
  if (
    !isUsableSvgViewBox(viewBox) ||
    renderedSize.width <= 0 ||
    renderedSize.height <= 0
  ) {
    return 0;
  }

  return Math.min(
    renderedSize.width / viewBox.width,
    renderedSize.height / viewBox.height
  );
}

export function svgUserUnitsForPixels(
  pixels: number,
  pixelsPerUserUnit: number
): number {
  if (pixelsPerUserUnit <= 0 || !Number.isFinite(pixelsPerUserUnit)) {
    return 0;
  }

  return pixels / pixelsPerUserUnit;
}

export function transformClientPoint(
  clientPoint: SvgPoint,
  inverseScreenMatrix: SvgTransformMatrix
): SvgPoint {
  return {
    x:
      inverseScreenMatrix.a * clientPoint.x +
      inverseScreenMatrix.c * clientPoint.y +
      inverseScreenMatrix.e,
    y:
      inverseScreenMatrix.b * clientPoint.x +
      inverseScreenMatrix.d * clientPoint.y +
      inverseScreenMatrix.f
  };
}

export function clampPointToViewBox(
  point: SvgPoint,
  viewBox: SvgViewBox
): SvgPoint {
  return {
    x: Math.max(viewBox.x, Math.min(viewBox.x + viewBox.width, point.x)),
    y: Math.max(viewBox.y, Math.min(viewBox.y + viewBox.height, point.y))
  };
}

export function roundSvgPoint(point: SvgPoint, decimalPlaces = 2): SvgPoint {
  const factor = 10 ** decimalPlaces;
  return {
    x: Math.round(point.x * factor) / factor,
    y: Math.round(point.y * factor) / factor
  };
}

export function findNearestAnchorInScreenSpace<T extends SvgPoint>(
  anchors: readonly T[],
  pointer: SvgPoint,
  pixelsPerUserUnit: number,
  maximumDistancePx = SVG_ANCHOR_SELECTION_RADIUS_PX
): T | null {
  if (
    pixelsPerUserUnit <= 0 ||
    !Number.isFinite(pixelsPerUserUnit) ||
    maximumDistancePx < 0
  ) {
    return null;
  }

  const maximumDistanceUserUnits = maximumDistancePx / pixelsPerUserUnit;
  const maximumDistanceSquared = maximumDistanceUserUnits ** 2;
  let nearest: T | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    const xDistance = anchor.x - pointer.x;
    const yDistance = anchor.y - pointer.y;
    const distanceSquared = xDistance ** 2 + yDistance ** 2;

    // Strictly closer preserves source order for exact-distance ties.
    if (
      distanceSquared <= maximumDistanceSquared &&
      distanceSquared < nearestDistanceSquared
    ) {
      nearest = anchor;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}
