import type { SvgViewBox } from "./svg-inspector";

export const SVG_STAGE_MAX_SIZE_PX = 620;
export const SVG_MARKER_DIAMETER_PX = 18;
export const SVG_MARKER_MIN_DIAMETER_PX = 5;
export const SVG_MARKER_SPACING_RATIO = 0.7;
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

export function getContainedSvgStageDimensions(
  viewBox: SvgViewBox,
  availableSize: SvgRenderedSize,
  maximumSizePx = SVG_STAGE_MAX_SIZE_PX
): SvgRenderedSize {
  const maximum = getMaximumSvgStageDimensions(viewBox, maximumSizePx);

  if (
    maximum.width <= 0 ||
    maximum.height <= 0 ||
    !Number.isFinite(availableSize.width) ||
    !Number.isFinite(availableSize.height) ||
    availableSize.width <= 0 ||
    availableSize.height <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(
    1,
    availableSize.width / maximum.width,
    availableSize.height / maximum.height
  );

  return {
    width: maximum.width * scale,
    height: maximum.height * scale
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

export function getAdaptiveSvgMarkerDiameterPx<T extends SvgPoint>(
  anchors: readonly T[],
  anchorIndex: number,
  pixelsPerUserUnit: number,
  preferredDiameterPx = SVG_MARKER_DIAMETER_PX,
  minimumDiameterPx = SVG_MARKER_MIN_DIAMETER_PX
): number {
  if (
    anchorIndex < 0 ||
    anchorIndex >= anchors.length ||
    pixelsPerUserUnit <= 0 ||
    !Number.isFinite(pixelsPerUserUnit) ||
    preferredDiameterPx <= 0 ||
    minimumDiameterPx <= 0
  ) {
    return preferredDiameterPx;
  }

  const anchor = anchors[anchorIndex];
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < anchors.length; index += 1) {
    if (index === anchorIndex) {
      continue;
    }

    const candidate = anchors[index];
    const xDistance = candidate.x - anchor.x;
    const yDistance = candidate.y - anchor.y;
    const distanceSquared = xDistance ** 2 + yDistance ** 2;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
    }
  }

  if (!Number.isFinite(nearestDistanceSquared)) {
    return preferredDiameterPx;
  }

  const nearestDistancePx =
    Math.sqrt(nearestDistanceSquared) * pixelsPerUserUnit;

  return Math.max(
    minimumDiameterPx,
    Math.min(preferredDiameterPx, nearestDistancePx * SVG_MARKER_SPACING_RATIO)
  );
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
