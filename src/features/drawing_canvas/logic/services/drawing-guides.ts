import type { DrawingMeasurementUnit } from "../../data/schema";

export const GUIDE_ACQUIRE_TOLERANCE_PX = 8;
export const GUIDE_RELEASE_TOLERANCE_PX = 12;

export type DrawingGuideAxis = "horizontal" | "vertical";

export type DrawingGuide = {
  id: string;
  axis: DrawingGuideAxis;
  position: number;
};

export type DrawingGuideSnapState = {
  horizontalGuideId?: string;
  verticalGuideId?: string;
};

export type DrawingGuideSnapBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export type DrawingGuideSnapResult = {
  delta: { x: number; y: number };
  snapState: DrawingGuideSnapState;
};

export type DrawingRulerTick = {
  position: number;
  major: boolean;
  label?: string;
};

type SnapCandidate = {
  guide: DrawingGuide;
  adjustment: number;
  distancePx: number;
};

function round(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return multiplier * magnitude;
}

function formatRulerLabel(value: number, unit: DrawingMeasurementUnit): string {
  if (unit === "mm") return `${Math.round(value)}`;

  return Number(value.toFixed(2)).toString();
}

export function deriveDrawingRulerTicks({
  length,
  pixelsPerUnit,
  measurementUnit,
  targetMajorSpacingPx = 72
}: {
  length: number;
  pixelsPerUnit: number;
  measurementUnit: DrawingMeasurementUnit;
  targetMajorSpacingPx?: number;
}): DrawingRulerTick[] {
  if (length <= 0 || pixelsPerUnit <= 0) return [];

  const millimetresPerDisplayUnit = measurementUnit === "in" ? 25.4 : 1;
  const rawMajorStep =
    targetMajorSpacingPx / pixelsPerUnit / millimetresPerDisplayUnit;
  const majorStepDisplay = niceStep(rawMajorStep);
  const minorStepDisplay = majorStepDisplay / 5;
  const lengthDisplay = length / millimetresPerDisplayUnit;
  const tickCount = Math.floor(lengthDisplay / minorStepDisplay + 1e-6);
  const ticks: DrawingRulerTick[] = [];

  for (let index = 0; index <= tickCount; index += 1) {
    const displayValue = index * minorStepDisplay;
    const major = index % 5 === 0;
    ticks.push({
      position: round(displayValue * millimetresPerDisplayUnit),
      major,
      label: major ? formatRulerLabel(displayValue, measurementUnit) : undefined
    });
  }

  return ticks;
}

function nearestCandidate({
  guides,
  points,
  pixelsPerUnit,
  activeGuideId
}: {
  guides: DrawingGuide[];
  points: number[];
  pixelsPerUnit: number;
  activeGuideId?: string;
}): SnapCandidate | undefined {
  const activeGuide = activeGuideId
    ? guides.find((guide) => guide.id === activeGuideId)
    : undefined;
  const candidateGuides = activeGuide ? [activeGuide] : guides;
  const tolerance = activeGuide
    ? GUIDE_RELEASE_TOLERANCE_PX
    : GUIDE_ACQUIRE_TOLERANCE_PX;
  let nearest: SnapCandidate | undefined;

  for (const guide of candidateGuides) {
    for (const point of points) {
      const adjustment = guide.position - point;
      const distancePx = Math.abs(adjustment) * pixelsPerUnit;

      if (distancePx > tolerance) continue;
      if (!nearest || distancePx < nearest.distancePx) {
        nearest = { guide, adjustment, distancePx };
      }
    }
  }

  return nearest;
}

export function resolveDrawingGuideSnap({
  bounds,
  proposedDelta,
  guides,
  pixelsPerUnit,
  activeSnapState = {},
  bypass = false
}: {
  bounds: DrawingGuideSnapBounds;
  proposedDelta: { x: number; y: number };
  guides: DrawingGuide[];
  pixelsPerUnit: { x: number; y: number };
  activeSnapState?: DrawingGuideSnapState;
  bypass?: boolean;
}): DrawingGuideSnapResult {
  if (bypass || guides.length === 0) {
    return {
      delta: {
        x: round(proposedDelta.x),
        y: round(proposedDelta.y)
      },
      snapState: {}
    };
  }

  const verticalGuides = guides.filter((guide) => guide.axis === "vertical");
  const horizontalGuides = guides.filter(
    (guide) => guide.axis === "horizontal"
  );
  const xCandidate = nearestCandidate({
    guides: verticalGuides,
    points: [bounds.left, bounds.centerX, bounds.right].map(
      (point) => point + proposedDelta.x
    ),
    pixelsPerUnit: pixelsPerUnit.x,
    activeGuideId: activeSnapState.verticalGuideId
  });
  const yCandidate = nearestCandidate({
    guides: horizontalGuides,
    points: [bounds.top, bounds.centerY, bounds.bottom].map(
      (point) => point + proposedDelta.y
    ),
    pixelsPerUnit: pixelsPerUnit.y,
    activeGuideId: activeSnapState.horizontalGuideId
  });

  return {
    delta: {
      x: round(proposedDelta.x + (xCandidate?.adjustment ?? 0)),
      y: round(proposedDelta.y + (yCandidate?.adjustment ?? 0))
    },
    snapState: {
      verticalGuideId: xCandidate?.guide.id,
      horizontalGuideId: yCandidate?.guide.id
    }
  };
}

export function formatDrawingGuidePosition(
  guide: DrawingGuide,
  measurementUnit: DrawingMeasurementUnit
): string {
  const value =
    measurementUnit === "in" ? guide.position / 25.4 : guide.position;
  const label = measurementUnit === "in" ? value.toFixed(2) : value.toFixed(1);
  const coordinate = guide.axis === "vertical" ? "X" : "Y";

  return `${coordinate} ${label} ${measurementUnit}`;
}
