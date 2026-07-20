import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import {
  getBackplanePhysicalBounds,
  getBackplanePhysicalUsableBounds,
  getLayoutPosition,
  resolveBackplaneLayoutScale
} from "./drawing-backplane-scale";

export type DimensionSnapAxis = "x" | "y";

export type DimensionSnapTargetKind =
  | "backplane-edge"
  | "usable-edge"
  | "item-edge";

export type DimensionSnapTarget = {
  axis: DimensionSnapAxis;
  valueMm: number;
  kind: DimensionSnapTargetKind;
  label: string;
  sourcePlacementId?: string;
};

export type DimensionSnapResolution = {
  valueMm: number;
  target?: DimensionSnapTarget;
};

type LayoutDimension = NonNullable<DrawingPlacement["layoutDimension"]>;

export type DimensionAttachmentReference = NonNullable<
  LayoutDimension["startAttachment"]
>;

export type DimensionAttachmentTarget = {
  kind: DimensionSnapTargetKind;
  label: string;
  edge: DimensionAttachmentReference["edge"];
  bounds: PhysicalBounds;
  targetKind: DimensionAttachmentReference["targetKind"];
  sourcePlacementId?: string;
};

export type DimensionAttachmentSnapResolution = {
  pointMm: { x: number; y: number };
  target?: DimensionAttachmentTarget;
  reference?: DimensionAttachmentReference;
};

type PhysicalBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SNAP_TARGET_PRIORITY: Record<DimensionSnapTargetKind, number> = {
  "backplane-edge": 1,
  "usable-edge": 2,
  "item-edge": 3
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function edgePoint(
  bounds: PhysicalBounds,
  edge: DimensionAttachmentReference["edge"],
  ratio: number
): { x: number; y: number } {
  const clampedRatio = clamp(ratio, 0, 1);

  switch (edge) {
    case "top":
      return {
        x: round(bounds.x + bounds.width * clampedRatio),
        y: round(bounds.y)
      };
    case "right":
      return {
        x: round(bounds.x + bounds.width),
        y: round(bounds.y + bounds.height * clampedRatio)
      };
    case "bottom":
      return {
        x: round(bounds.x + bounds.width * clampedRatio),
        y: round(bounds.y + bounds.height)
      };
    case "left":
      return {
        x: round(bounds.x),
        y: round(bounds.y + bounds.height * clampedRatio)
      };
  }
}

function projectPointToEdge(
  point: { x: number; y: number },
  target: DimensionAttachmentTarget
): {
  pointMm: { x: number; y: number };
  ratio: number;
  distance: number;
} {
  const { bounds, edge } = target;
  const ratio =
    edge === "top" || edge === "bottom"
      ? bounds.width > 0
        ? clamp((point.x - bounds.x) / bounds.width, 0, 1)
        : 0
      : bounds.height > 0
        ? clamp((point.y - bounds.y) / bounds.height, 0, 1)
        : 0;
  const pointMm = edgePoint(bounds, edge, ratio);

  return {
    pointMm,
    ratio: round(ratio),
    distance: Math.hypot(point.x - pointMm.x, point.y - pointMm.y)
  };
}

export function getLayoutItemPhysicalBounds({
  sheet,
  placement,
  backplane
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
}): PhysicalBounds | undefined {
  const dimensions = placement.layoutDimensions;

  if (!dimensions) {
    return undefined;
  }

  const position = getLayoutPosition(sheet, placement, backplane);
  const width = dimensions.lengthMm;
  const height = dimensions.widthMm;
  const radians = (normalizedRotation(placement.rotation) * Math.PI) / 180;
  const rotatedWidth = Math.abs(width * Math.cos(radians)) +
    Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians)) +
    Math.abs(height * Math.cos(radians));
  const centerX = position.xMm + width / 2;
  const centerY = position.yMm + height / 2;

  return {
    x: round(centerX - rotatedWidth / 2),
    y: round(centerY - rotatedHeight / 2),
    width: round(rotatedWidth),
    height: round(rotatedHeight)
  };
}

export function buildLayoutDimensionSnapTargets({
  model,
  backplane,
  orientation,
  excludePlacementId
}: {
  model: DrawingSheetCanvasModel;
  backplane: DrawingPlacement;
  orientation: "horizontal" | "vertical";
  excludePlacementId?: string;
}): DimensionSnapTarget[] {
  const axis: DimensionSnapAxis = orientation === "horizontal" ? "x" : "y";
  const outerBounds = getBackplanePhysicalBounds(backplane);
  const usableBounds = getBackplanePhysicalUsableBounds(backplane);
  const targets = new Map<string, DimensionSnapTarget>();

  const addTarget = (target: DimensionSnapTarget) => {
    const normalizedTarget = {
      ...target,
      valueMm: round(target.valueMm)
    };
    const key = `${target.axis}:${normalizedTarget.valueMm.toFixed(2)}`;
    const current = targets.get(key);

    if (
      !current ||
      SNAP_TARGET_PRIORITY[target.kind] > SNAP_TARGET_PRIORITY[current.kind]
    ) {
      targets.set(key, normalizedTarget);
    }
  };

  addTarget({
    axis,
    valueMm: axis === "x" ? outerBounds.x : outerBounds.y,
    kind: "backplane-edge",
    label: "Backplane edge"
  });
  addTarget({
    axis,
    valueMm:
      axis === "x"
        ? outerBounds.x + outerBounds.width
        : outerBounds.y + outerBounds.height,
    kind: "backplane-edge",
    label: "Backplane edge"
  });
  addTarget({
    axis,
    valueMm: axis === "x" ? usableBounds.x : usableBounds.y,
    kind: "usable-edge",
    label: "Usable-area edge"
  });
  addTarget({
    axis,
    valueMm:
      axis === "x"
        ? usableBounds.x + usableBounds.width
        : usableBounds.y + usableBounds.height,
    kind: "usable-edge",
    label: "Usable-area edge"
  });

  for (const placement of model.placements) {
    if (
      placement.id === excludePlacementId ||
      placement.layoutParentId !== backplane.id ||
      placement.layoutDimension ||
      !placement.layoutDimensions
    ) {
      continue;
    }

    const bounds = getLayoutItemPhysicalBounds({
      sheet: model.sheet,
      placement,
      backplane
    });

    if (!bounds) {
      continue;
    }

    const itemLabel = placement.tag || placement.title || "Layout item";
    const start = axis === "x" ? bounds.x : bounds.y;
    const end = axis === "x" ? bounds.x + bounds.width : bounds.y + bounds.height;

    addTarget({
      axis,
      valueMm: start,
      kind: "item-edge",
      label: `${itemLabel} edge`,
      sourcePlacementId: placement.id
    });
    addTarget({
      axis,
      valueMm: end,
      kind: "item-edge",
      label: `${itemLabel} edge`,
      sourcePlacementId: placement.id
    });
  }

  return [...targets.values()].sort((left, right) => left.valueMm - right.valueMm);
}

export function buildLayoutDimensionAttachmentTargets({
  model,
  backplane,
  excludePlacementId
}: {
  model: DrawingSheetCanvasModel;
  backplane: DrawingPlacement;
  excludePlacementId?: string;
}): DimensionAttachmentTarget[] {
  const targets: DimensionAttachmentTarget[] = [];
  const addBoundsTargets = ({
    bounds,
    kind,
    label,
    targetKind,
    sourcePlacementId
  }: {
    bounds: PhysicalBounds;
    kind: DimensionSnapTargetKind;
    label: string;
    targetKind: DimensionAttachmentReference["targetKind"];
    sourcePlacementId?: string;
  }) => {
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      targets.push({
        bounds,
        kind,
        label: `${label} ${edge} edge`,
        targetKind,
        sourcePlacementId,
        edge
      });
    }
  };

  addBoundsTargets({
    bounds: getBackplanePhysicalBounds(backplane),
    kind: "backplane-edge",
    label: "Backplane",
    targetKind: "backplane"
  });
  addBoundsTargets({
    bounds: getBackplanePhysicalUsableBounds(backplane),
    kind: "usable-edge",
    label: "Usable area",
    targetKind: "usable"
  });

  for (const placement of model.placements) {
    if (
      placement.id === excludePlacementId ||
      placement.layoutParentId !== backplane.id ||
      placement.layoutDimension ||
      !placement.layoutDimensions
    ) {
      continue;
    }

    const bounds = getLayoutItemPhysicalBounds({
      sheet: model.sheet,
      placement,
      backplane
    });

    if (!bounds) {
      continue;
    }

    addBoundsTargets({
      bounds,
      kind: "item-edge",
      label: placement.tag || placement.title || "Layout item",
      targetKind: "placement",
      sourcePlacementId: placement.id
    });
  }

  return targets;
}

export function resolveLayoutDimensionAttachmentSnap({
  pointMm,
  targets,
  toleranceMm
}: {
  pointMm: { x: number; y: number };
  targets: DimensionAttachmentTarget[];
  toleranceMm: number;
}): DimensionAttachmentSnapResolution {
  let nearest:
    | {
        target: DimensionAttachmentTarget;
        pointMm: { x: number; y: number };
        ratio: number;
        distance: number;
      }
    | undefined;

  for (const target of targets) {
    const candidate = projectPointToEdge(pointMm, target);

    if (
      !nearest ||
      candidate.distance < nearest.distance ||
      (candidate.distance === nearest.distance &&
        SNAP_TARGET_PRIORITY[target.kind] >
          SNAP_TARGET_PRIORITY[nearest.target.kind])
    ) {
      nearest = { target, ...candidate };
    }
  }

  if (!nearest || nearest.distance > toleranceMm) {
    return {
      pointMm: {
        x: round(pointMm.x),
        y: round(pointMm.y)
      }
    };
  }

  return {
    pointMm: nearest.pointMm,
    target: nearest.target,
    reference: {
      targetKind: nearest.target.targetKind,
      placementId: nearest.target.sourcePlacementId,
      edge: nearest.target.edge,
      ratio: nearest.ratio
    }
  };
}

export function resolveDimensionAttachmentReferencePoint({
  model,
  backplane,
  reference
}: {
  model: DrawingSheetCanvasModel;
  backplane: DrawingPlacement;
  reference: DimensionAttachmentReference;
}): { x: number; y: number } | undefined {
  const bounds =
    reference.targetKind === "backplane"
      ? getBackplanePhysicalBounds(backplane)
      : reference.targetKind === "usable"
        ? getBackplanePhysicalUsableBounds(backplane)
        : reference.placementId
          ? (() => {
              const placement = model.placements.find(
                (candidate) =>
                  candidate.id === reference.placementId &&
                  candidate.layoutParentId === backplane.id &&
                  !candidate.layoutDimension
              );

              return placement
                ? getLayoutItemPhysicalBounds({
                    sheet: model.sheet,
                    placement,
                    backplane
                  })
                : undefined;
            })()
          : undefined;

  return bounds ? edgePoint(bounds, reference.edge, reference.ratio) : undefined;
}

export function resolveLayoutDimensionSnap({
  axis,
  valueMm,
  targets,
  toleranceMm
}: {
  axis: DimensionSnapAxis;
  valueMm: number;
  targets: DimensionSnapTarget[];
  toleranceMm: number;
}): DimensionSnapResolution {
  let nearestTarget: DimensionSnapTarget | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (target.axis !== axis) {
      continue;
    }

    const distance = Math.abs(target.valueMm - valueMm);

    if (
      distance < nearestDistance ||
      (distance === nearestDistance &&
        nearestTarget &&
        SNAP_TARGET_PRIORITY[target.kind] >
          SNAP_TARGET_PRIORITY[nearestTarget.kind])
    ) {
      nearestDistance = distance;
      nearestTarget = target;
    }
  }

  return nearestTarget && nearestDistance <= toleranceMm
    ? {
        valueMm: nearestTarget.valueMm,
        target: nearestTarget
      }
    : { valueMm: round(valueMm) };
}

export function resolveDimensionSnapToleranceMm({
  sheet,
  backplane,
  screenScale,
  screenTolerancePx = 8
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  screenScale: number;
  screenTolerancePx?: number;
}): number {
  const layoutScale = resolveBackplaneLayoutScale(sheet, backplane).factor;
  const pixelsPerPhysicalMm = Math.max(0.001, screenScale * layoutScale);

  return round(clamp(screenTolerancePx / pixelsPerPhysicalMm, 1, 10));
}

export function dimensionSnapTargetSheetValue({
  sheet,
  backplane,
  target
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  target: DimensionSnapTarget;
}): number {
  const factor = resolveBackplaneLayoutScale(sheet, backplane).factor;
  const origin = target.axis === "x" ? backplane.x : backplane.y;

  return round(origin + target.valueMm * factor);
}

export function dimensionAttachmentPointToSheet({
  sheet,
  backplane,
  pointMm
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  pointMm: { x: number; y: number };
}): { x: number; y: number } {
  const factor = resolveBackplaneLayoutScale(sheet, backplane).factor;

  return {
    x: round(backplane.x + pointMm.x * factor),
    y: round(backplane.y + pointMm.y * factor)
  };
}
