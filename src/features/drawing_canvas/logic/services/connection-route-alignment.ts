import type {
  DrawingConnectionRoute,
  DrawingRoutePoint,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";

export const ROUTE_SNAP_ACQUIRE_PX = 8;
export const ROUTE_SNAP_RELEASE_PX = 12;

export type RouteAlignmentAxis = "x" | "y";

export type RouteAlignmentFeedback = {
  axis: RouteAlignmentAxis;
  value: number;
  sourceKind: "point" | "segment";
  sourceId: string;
  guideStart: { x: number; y: number };
  guideEnd: { x: number; y: number };
};

export type RouteSnapTarget = {
  axis: RouteAlignmentAxis;
  value: number;
  sourceKind: "point" | "segment";
  sourceId: string;
};

export type RouteSnapState = Partial<Record<RouteAlignmentAxis, RouteSnapTarget>>;

export type EditableRouteSegment = {
  key: string;
  axis: "horizontal" | "vertical";
  from: { x: number; y: number };
  to: { x: number; y: number };
  editablePointIds: string[];
  sourcePointIds: [string, string];
  sourcePairIndex: number;
};

export type RouteDragResolution = {
  route: DrawingConnectionRoute;
  feedback: RouteAlignmentFeedback[];
  snapState: RouteSnapState;
};

type PixelsPerUnit = { x: number; y: number };

type SnapCandidate = RouteSnapTarget & {
  priority: number;
  order: number;
  guideStart: { x: number; y: number };
  guideEnd: { x: number; y: number };
};

function roundCanvasValue(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clampCanvasPoint(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
) {
  return {
    x: roundCanvasValue(Math.max(0, Math.min(sheet.width, point.x))),
    y: roundCanvasValue(Math.max(0, Math.min(sheet.height, point.y)))
  };
}

function pointIsEditable(point: DrawingRoutePoint): boolean {
  return point.kind !== "endpoint";
}

function addSegment(
  segments: EditableRouteSegment[],
  input: Omit<EditableRouteSegment, "editablePointIds"> & {
    editablePointIds: Array<string | undefined>;
  }
) {
  if (input.from.x === input.to.x && input.from.y === input.to.y) {
    return;
  }

  segments.push({
    ...input,
    editablePointIds: Array.from(
      new Set(input.editablePointIds.filter((value): value is string => Boolean(value)))
    )
  });
}

export function buildEditableRouteSegments(
  route: DrawingConnectionRoute
): EditableRouteSegment[] {
  const segments: EditableRouteSegment[] = [];

  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index];
    const to = route.points[index + 1];
    const sourcePointIds: [string, string] = [from.id, to.id];

    if (from.x === to.x || from.y === to.y) {
      const axis = from.y === to.y ? "horizontal" : "vertical";
      addSegment(segments, {
        key: `${from.id}_${to.id}_direct`,
        axis,
        from,
        to,
        editablePointIds: [
          pointIsEditable(from) ? from.id : undefined,
          pointIsEditable(to) ? to.id : undefined
        ],
        sourcePointIds,
        sourcePairIndex: index
      });
      continue;
    }

    const dogleg = { x: to.x, y: from.y };
    addSegment(segments, {
      key: `${from.id}_${to.id}_horizontal`,
      axis: "horizontal",
      from,
      to: dogleg,
      editablePointIds: [pointIsEditable(from) ? from.id : undefined],
      sourcePointIds,
      sourcePairIndex: index
    });
    addSegment(segments, {
      key: `${from.id}_${to.id}_vertical`,
      axis: "vertical",
      from: dogleg,
      to,
      editablePointIds: [pointIsEditable(to) ? to.id : undefined],
      sourcePointIds,
      sourcePairIndex: index
    });
  }

  return segments;
}

function pixelsForAxis(
  axis: RouteAlignmentAxis,
  delta: number,
  pixelsPerUnit: PixelsPerUnit
): number {
  return Math.abs(delta) * (axis === "x" ? pixelsPerUnit.x : pixelsPerUnit.y);
}

function findCandidate(
  axis: RouteAlignmentAxis,
  value: number,
  candidates: SnapCandidate[],
  pixelsPerUnit: PixelsPerUnit,
  activeTarget: RouteSnapTarget | undefined
): SnapCandidate | undefined {
  if (activeTarget) {
    const held = candidates.find(
      (candidate) =>
        candidate.sourceKind === activeTarget.sourceKind &&
        candidate.sourceId === activeTarget.sourceId &&
        candidate.axis === axis
    );
    if (
      held &&
      pixelsForAxis(axis, value - held.value, pixelsPerUnit) <=
        ROUTE_SNAP_RELEASE_PX
    ) {
      return held;
    }
  }

  return candidates
    .map((candidate) => ({
      candidate,
      distancePx: pixelsForAxis(axis, value - candidate.value, pixelsPerUnit)
    }))
    .filter(({ distancePx }) => distancePx <= ROUTE_SNAP_ACQUIRE_PX)
    .sort(
      (first, second) =>
        first.candidate.priority - second.candidate.priority ||
        first.distancePx - second.distancePx ||
        first.candidate.order - second.candidate.order
    )[0]?.candidate;
}

function pointCandidate(
  axis: RouteAlignmentAxis,
  point: DrawingRoutePoint,
  movingPoint: { x: number; y: number },
  priority: number,
  order: number
): SnapCandidate {
  return {
    axis,
    value: point[axis],
    sourceKind: "point",
    sourceId: point.id,
    priority,
    order,
    guideStart:
      axis === "x"
        ? { x: point.x, y: Math.min(point.y, movingPoint.y) }
        : { x: Math.min(point.x, movingPoint.x), y: point.y },
    guideEnd:
      axis === "x"
        ? { x: point.x, y: Math.max(point.y, movingPoint.y) }
        : { x: Math.max(point.x, movingPoint.x), y: point.y }
  };
}

function segmentCandidate(
  axis: RouteAlignmentAxis,
  segment: EditableRouteSegment,
  movingPoint: { x: number; y: number },
  priority: number,
  order: number
): SnapCandidate {
  const value = axis === "x" ? segment.from.x : segment.from.y;
  return {
    axis,
    value,
    sourceKind: "segment",
    sourceId: segment.key,
    priority,
    order,
    guideStart:
      axis === "x"
        ? {
            x: value,
            y: Math.min(segment.from.y, segment.to.y, movingPoint.y)
          }
        : {
            x: Math.min(segment.from.x, segment.to.x, movingPoint.x),
            y: value
          },
    guideEnd:
      axis === "x"
        ? {
            x: value,
            y: Math.max(segment.from.y, segment.to.y, movingPoint.y)
          }
        : {
            x: Math.max(segment.from.x, segment.to.x, movingPoint.x),
            y: value
          }
  };
}

function candidatesForPoint(input: {
  route: DrawingConnectionRoute;
  pointId: string;
  movingPoint: { x: number; y: number };
  axis: RouteAlignmentAxis;
}): SnapCandidate[] {
  const pointIndex = input.route.points.findIndex(
    (point) => point.id === input.pointId
  );
  const neighborIds = new Set(
    [input.route.points[pointIndex - 1]?.id, input.route.points[pointIndex + 1]?.id].filter(
      (value): value is string => Boolean(value)
    )
  );
  const pointCandidates = input.route.points
    .filter((point) => point.id !== input.pointId)
    .map((point, order) =>
      pointCandidate(
        input.axis,
        point,
        input.movingPoint,
        neighborIds.has(point.id) ? 0 : 2,
        order
      )
    );
  const segmentCandidates = buildEditableRouteSegments(input.route)
    .filter(
      (segment) =>
        !segment.sourcePointIds.includes(input.pointId) &&
        (input.axis === "x"
          ? segment.axis === "vertical"
          : segment.axis === "horizontal")
    )
    .map((segment, order) =>
      segmentCandidate(input.axis, segment, input.movingPoint, 3, order)
    );

  return [...pointCandidates, ...segmentCandidates];
}

function feedbackFromCandidate(candidate: SnapCandidate): RouteAlignmentFeedback {
  return {
    axis: candidate.axis,
    value: candidate.value,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId,
    guideStart: candidate.guideStart,
    guideEnd: candidate.guideEnd
  };
}

function snapTargetFromCandidate(candidate: SnapCandidate): RouteSnapTarget {
  return {
    axis: candidate.axis,
    value: candidate.value,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId
  };
}

export function resolveRoutePointDrag(input: {
  route: DrawingConnectionRoute;
  pointId: string;
  proposedPoint: { x: number; y: number };
  startPoint: { x: number; y: number };
  sheet: DrawingModel["sheet"];
  pixelsPerUnit: PixelsPerUnit;
  activeSnapState?: RouteSnapState;
  axisLock?: RouteAlignmentAxis;
  bypassSnapping?: boolean;
}): RouteDragResolution {
  const proposed = clampCanvasPoint(
    {
      x: input.axisLock === "y" ? input.startPoint.x : input.proposedPoint.x,
      y: input.axisLock === "x" ? input.startPoint.y : input.proposedPoint.y
    },
    input.sheet
  );
  const xCandidate = input.bypassSnapping
    ? undefined
    : findCandidate(
        "x",
        proposed.x,
        candidatesForPoint({
          route: input.route,
          pointId: input.pointId,
          movingPoint: proposed,
          axis: "x"
        }),
        input.pixelsPerUnit,
        input.activeSnapState?.x
      );
  const yCandidate = input.bypassSnapping
    ? undefined
    : findCandidate(
        "y",
        proposed.y,
        candidatesForPoint({
          route: input.route,
          pointId: input.pointId,
          movingPoint: proposed,
          axis: "y"
        }),
        input.pixelsPerUnit,
        input.activeSnapState?.y
      );
  let appliedX = xCandidate;
  let appliedY = yCandidate;
  const pointIndex = input.route.points.findIndex(
    (point) => point.id === input.pointId
  );
  const neighborPoints = [
    input.route.points[pointIndex - 1],
    input.route.points[pointIndex + 1]
  ].filter((point): point is DrawingRoutePoint => Boolean(point));

  if (appliedX && appliedY) {
    const collapsedNeighbor = neighborPoints.find(
      (point) => point.x === appliedX?.value && point.y === appliedY?.value
    );
    if (collapsedNeighbor) {
      const xDistance = pixelsForAxis(
        "x",
        proposed.x - appliedX.value,
        input.pixelsPerUnit
      );
      const yDistance = pixelsForAxis(
        "y",
        proposed.y - appliedY.value,
        input.pixelsPerUnit
      );
      if (xDistance > yDistance) {
        appliedX = undefined;
      } else {
        appliedY = undefined;
      }
    }
  }

  const point = clampCanvasPoint(
    {
      x: appliedX?.value ?? proposed.x,
      y: appliedY?.value ?? proposed.y
    },
    input.sheet
  );
  const feedback = [appliedX, appliedY]
    .filter((candidate): candidate is SnapCandidate => Boolean(candidate))
    .map(feedbackFromCandidate);
  const snapState: RouteSnapState = {};
  if (appliedX) snapState.x = snapTargetFromCandidate(appliedX);
  if (appliedY) snapState.y = snapTargetFromCandidate(appliedY);

  return {
    route: {
      ...input.route,
      mode: "manual",
      points: input.route.points.map((routePoint) =>
        routePoint.id === input.pointId && routePoint.kind !== "endpoint"
          ? { ...routePoint, ...point }
          : routePoint
      )
    },
    feedback,
    snapState
  };
}

function candidatesForSegment(input: {
  route: DrawingConnectionRoute;
  segment: EditableRouteSegment;
  axis: RouteAlignmentAxis;
  movingPoint: { x: number; y: number };
}): SnapCandidate[] {
  const editableIds = new Set(input.segment.editablePointIds);
  const pointCandidates = input.route.points
    .filter((point) => !editableIds.has(point.id))
    .map((point, order) =>
      pointCandidate(input.axis, point, input.movingPoint, 1, order)
    );
  const segmentCandidates = buildEditableRouteSegments(input.route)
    .filter(
      (segment) =>
        segment.key !== input.segment.key &&
        !segment.editablePointIds.some((pointId) => editableIds.has(pointId)) &&
        (input.axis === "x"
          ? segment.axis === "vertical"
          : segment.axis === "horizontal")
    )
    .map((segment, order) =>
      segmentCandidate(input.axis, segment, input.movingPoint, 0, order)
    );

  return [...segmentCandidates, ...pointCandidates];
}

export function resolveRouteSegmentDrag(input: {
  route: DrawingConnectionRoute;
  segmentKey: string;
  delta: { x: number; y: number };
  sheet: DrawingModel["sheet"];
  pixelsPerUnit: PixelsPerUnit;
  activeSnapState?: RouteSnapState;
  bypassSnapping?: boolean;
}): RouteDragResolution {
  const segment = buildEditableRouteSegments(input.route).find(
    (candidate) => candidate.key === input.segmentKey
  );
  if (!segment || segment.editablePointIds.length === 0) {
    return { route: input.route, feedback: [], snapState: {} };
  }

  const axis: RouteAlignmentAxis = segment.axis === "horizontal" ? "y" : "x";
  const proposedValue =
    (axis === "x" ? segment.from.x + input.delta.x : segment.from.y + input.delta.y);
  const movingPoint =
    axis === "x"
      ? { x: proposedValue, y: (segment.from.y + segment.to.y) / 2 }
      : { x: (segment.from.x + segment.to.x) / 2, y: proposedValue };
  const candidate = input.bypassSnapping
    ? undefined
    : findCandidate(
        axis,
        proposedValue,
        candidatesForSegment({ route: input.route, segment, axis, movingPoint }),
        input.pixelsPerUnit,
        input.activeSnapState?.[axis]
      );
  const maxValue = axis === "x" ? input.sheet.width : input.sheet.height;
  const value = roundCanvasValue(
    Math.max(0, Math.min(maxValue, candidate?.value ?? proposedValue))
  );
  const editablePointIds = new Set(segment.editablePointIds);
  const snapState: RouteSnapState = candidate
    ? { [axis]: snapTargetFromCandidate(candidate) }
    : {};

  return {
    route: {
      ...input.route,
      mode: "manual",
      points: input.route.points.map((point) =>
        editablePointIds.has(point.id) && point.kind !== "endpoint"
          ? { ...point, [axis]: value }
          : point
      )
    },
    feedback: candidate ? [feedbackFromCandidate(candidate)] : [],
    snapState
  };
}

function projectedPointOnSegment(
  point: { x: number; y: number },
  segment: EditableRouteSegment
) {
  if (segment.axis === "horizontal") {
    return {
      x: Math.max(
        Math.min(segment.from.x, segment.to.x),
        Math.min(Math.max(segment.from.x, segment.to.x), point.x)
      ),
      y: segment.from.y
    };
  }

  return {
    x: segment.from.x,
    y: Math.max(
      Math.min(segment.from.y, segment.to.y),
      Math.min(Math.max(segment.from.y, segment.to.y), point.y)
    )
  };
}

export function insertRouteControlPointOnSegment(input: {
  route: DrawingConnectionRoute;
  connectionId: string;
  point: { x: number; y: number };
  sheet: DrawingModel["sheet"];
  pointId?: string;
}): DrawingConnectionRoute {
  const segments = buildEditableRouteSegments(input.route);
  const nearest = segments
    .map((segment, order) => {
      const projected = projectedPointOnSegment(input.point, segment);
      return {
        segment,
        projected,
        order,
        distance: Math.hypot(projected.x - input.point.x, projected.y - input.point.y)
      };
    })
    .sort(
      (first, second) =>
        first.distance - second.distance || first.order - second.order
    )[0];

  if (!nearest) {
    return input.route;
  }

  let suffix = Date.now();
  let pointId = input.pointId ?? `${input.connectionId}_control_${suffix}`;
  while (input.route.points.some((point) => point.id === pointId)) {
    suffix += 1;
    pointId = `${input.connectionId}_control_${suffix}`;
  }
  const point: DrawingRoutePoint = {
    id: pointId,
    kind: "control",
    ...clampCanvasPoint(nearest.projected, input.sheet)
  };
  const insertIndex = nearest.segment.sourcePairIndex + 1;

  return {
    ...input.route,
    mode: "manual",
    points: [
      ...input.route.points.slice(0, insertIndex),
      point,
      ...input.route.points.slice(insertIndex)
    ]
  };
}
