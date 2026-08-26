import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint,
  DrawingRoutePoint,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  ROUTE_SNAP_ACQUIRE_PX,
  ROUTE_SNAP_RELEASE_PX,
  type RouteAlignmentAxis,
  type RouteAlignmentFeedback,
  type RouteSnapState,
  type RouteSnapTarget
} from "./connection-route-alignment";
import {
  expandedOrthogonalPoints,
  generateDefaultOrthogonalRoute,
  getEndpointRoutingContext,
  getEndpointStubPoint,
  type EndpointSide
} from "./connection-route-geometry";

export type GuidedConnectionWaypoint = {
  id: string;
  x: number;
  y: number;
};

export type GuidedConnectionPreviewResult = {
  points: Array<{ x: number; y: number }>;
  waypoints: GuidedConnectionWaypoint[];
  alignmentFeedback: RouteAlignmentFeedback[];
  warning?: string;
};

export type GuidedConnectionPointerResolution = {
  point: { x: number; y: number };
  snapState: RouteSnapState;
  alignmentFeedback: RouteAlignmentFeedback[];
  warning?: string;
};

type PixelsPerUnit = { x: number; y: number };
type OrthogonalAxis = "horizontal" | "vertical";
type PathPoint = {
  x: number;
  y: number;
  preserve?: boolean;
};

type GuidedSnapCandidate = RouteSnapTarget & {
  priority: number;
  order: number;
  guideStart: { x: number; y: number };
  guideEnd: { x: number; y: number };
};

const GUIDED_WAYPOINT_MIN_DISTANCE_PX = 4;
const DRAFT_CONNECTION_ID = "draft_guided_connection";

function roundValue(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundPoint(point: { x: number; y: number }) {
  return { x: roundValue(point.x), y: roundValue(point.y) };
}

function samePoint(
  first: { x: number; y: number },
  second: { x: number; y: number }
): boolean {
  return first.x === second.x && first.y === second.y;
}

function pointIsInsideSheet(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
): boolean {
  return (
    point.x >= 0 &&
    point.x <= sheet.width &&
    point.y >= 0 &&
    point.y <= sheet.height
  );
}

function endpointAxis(side: EndpointSide): OrthogonalAxis {
  return side === "left" || side === "right" ? "horizontal" : "vertical";
}

function segmentAxis(
  from: { x: number; y: number },
  to: { x: number; y: number }
): OrthogonalAxis | undefined {
  if (from.y === to.y && from.x !== to.x) return "horizontal";
  if (from.x === to.x && from.y !== to.y) return "vertical";
  return undefined;
}

function appendOrthogonalTarget(
  points: PathPoint[],
  target: PathPoint,
  preferredAxis: OrthogonalAxis
): OrthogonalAxis {
  const current = points.at(-1);
  if (!current || samePoint(current, target)) {
    if (current && target.preserve) current.preserve = true;
    return preferredAxis;
  }

  const directAxis = segmentAxis(current, target);
  if (directAxis) {
    points.push({ ...target });
    return directAxis;
  }

  const elbow =
    preferredAxis === "horizontal"
      ? { x: target.x, y: current.y }
      : { x: current.x, y: target.y };

  if (!samePoint(current, elbow) && !samePoint(elbow, target)) {
    points.push(elbow);
  }
  points.push({ ...target });

  return preferredAxis === "horizontal" ? "vertical" : "horizontal";
}

function simplifyOrthogonalPath(points: PathPoint[]): PathPoint[] {
  const deduplicated: PathPoint[] = [];

  for (const sourcePoint of points) {
    const point = { ...roundPoint(sourcePoint), preserve: sourcePoint.preserve };
    const previous = deduplicated.at(-1);
    if (previous && samePoint(previous, point)) {
      previous.preserve = previous.preserve || point.preserve;
      continue;
    }
    deduplicated.push({ ...point });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 1; index < deduplicated.length - 1; index += 1) {
      const previous = deduplicated[index - 1];
      const current = deduplicated[index];
      const next = deduplicated[index + 1];
      const collinear =
        (previous.x === current.x && current.x === next.x) ||
        (previous.y === current.y && current.y === next.y);

      if (collinear && !current.preserve) {
        deduplicated.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  return deduplicated;
}

function buildOrthogonalPath(input: {
  sourcePoint: { x: number; y: number };
  sourceStub: { x: number; y: number };
  sourceSide: EndpointSide;
  waypoints: GuidedConnectionWaypoint[];
  pointer?: { x: number; y: number };
  destinationStub?: { x: number; y: number };
  destinationPoint?: { x: number; y: number };
}): PathPoint[] {
  const points: PathPoint[] = [
    { ...input.sourcePoint, preserve: true },
    { ...input.sourceStub, preserve: true }
  ];
  let preferredAxis = endpointAxis(input.sourceSide);

  for (const waypoint of input.waypoints) {
    preferredAxis = appendOrthogonalTarget(
      points,
      { x: waypoint.x, y: waypoint.y, preserve: true },
      preferredAxis
    );
  }

  if (input.destinationStub && input.destinationPoint) {
    preferredAxis = appendOrthogonalTarget(
      points,
      { ...input.destinationStub, preserve: true },
      preferredAxis
    );
    appendOrthogonalTarget(
      points,
      { ...input.destinationPoint, preserve: true },
      preferredAxis
    );
  } else if (input.pointer) {
    appendOrthogonalTarget(points, input.pointer, preferredAxis);
  }

  return simplifyOrthogonalPath(points);
}

function routePointsFromPath(
  connectionId: string,
  points: PathPoint[]
): DrawingRoutePoint[] {
  return points.map((point, index) => ({
    id:
      index === 0
        ? `${connectionId}_from`
        : index === points.length - 1
          ? `${connectionId}_to`
          : `${connectionId}_control_${index}`,
    kind:
      index === 0 || index === points.length - 1 ? "endpoint" : "control",
    ...roundPoint(point)
  }));
}

export function buildGuidedConnectionRoute(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
  waypoints: GuidedConnectionWaypoint[];
}): DrawingConnectionRoute | null {
  if (input.waypoints.length === 0) {
    const route = generateDefaultOrthogonalRoute({
      model: input.model,
      symbols: input.symbols,
      connection: input.connection,
      mode: "auto"
    });
    return route?.points.every((point) =>
      pointIsInsideSheet(point, input.model.sheet)
    )
      ? route
      : null;
  }

  const source = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.connection.from
  );
  const destination = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.connection.to
  );
  if (!source || !destination) return null;

  if (
    input.waypoints.some(
      (waypoint) => !pointIsInsideSheet(waypoint, input.model.sheet)
    )
  ) {
    return null;
  }

  const points = buildOrthogonalPath({
    sourcePoint: source.point,
    sourceStub: getEndpointStubPoint(source),
    sourceSide: source.side,
    waypoints: input.waypoints,
    destinationStub: getEndpointStubPoint(destination),
    destinationPoint: destination.point
  });

  if (points.some((point) => !pointIsInsideSheet(point, input.model.sheet))) {
    return null;
  }

  return {
    mode: "manual",
    style: "orthogonal",
    points: routePointsFromPath(input.connection.id, points)
  };
}

export function buildGuidedConnectionPreview(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  from: DrawingEndpoint;
  pointer?: { x: number; y: number };
  destination?: DrawingEndpoint;
  waypoints: GuidedConnectionWaypoint[];
  alignmentFeedback?: RouteAlignmentFeedback[];
}): GuidedConnectionPreviewResult {
  const source = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.from
  );
  if (!source) {
    return {
      points: [],
      waypoints: input.waypoints,
      alignmentFeedback: input.alignmentFeedback ?? [],
      warning: "The connection source is no longer available."
    };
  }

  if (input.destination) {
    const route = buildGuidedConnectionRoute({
      model: input.model,
      symbols: input.symbols,
      connection: {
        id: DRAFT_CONNECTION_ID,
        from: input.from,
        to: input.destination
      },
      waypoints: input.waypoints
    });

    return {
      points: route?.points.map(roundPoint) ?? [],
      waypoints: input.waypoints,
      alignmentFeedback: input.alignmentFeedback ?? [],
      warning: route ? undefined : "The destination route cannot be resolved."
    };
  }

  if (!input.pointer) {
    return {
      points: buildOrthogonalPath({
        sourcePoint: source.point,
        sourceStub: getEndpointStubPoint(source),
        sourceSide: source.side,
        waypoints: input.waypoints
      }).map(roundPoint),
      waypoints: input.waypoints,
      alignmentFeedback: input.alignmentFeedback ?? []
    };
  }

  if (!pointIsInsideSheet(input.pointer, input.model.sheet)) {
    return {
      points: [],
      waypoints: input.waypoints,
      alignmentFeedback: input.alignmentFeedback ?? [],
      warning: "Move the pointer inside the printable sheet."
    };
  }

  return {
    points: buildOrthogonalPath({
      sourcePoint: source.point,
      sourceStub: getEndpointStubPoint(source),
      sourceSide: source.side,
      waypoints: input.waypoints,
      pointer: input.pointer
    }).map(roundPoint),
    waypoints: input.waypoints,
    alignmentFeedback: input.alignmentFeedback ?? []
  };
}

function pixelsForAxis(
  axis: RouteAlignmentAxis,
  delta: number,
  pixelsPerUnit: PixelsPerUnit
): number {
  return Math.abs(delta) * (axis === "x" ? pixelsPerUnit.x : pixelsPerUnit.y);
}

function pointCandidate(input: {
  axis: RouteAlignmentAxis;
  point: { x: number; y: number };
  movingPoint: { x: number; y: number };
  sourceId: string;
  priority: number;
  order: number;
}): GuidedSnapCandidate {
  const value = input.point[input.axis];
  return {
    axis: input.axis,
    value,
    sourceKind: "point",
    sourceId: input.sourceId,
    priority: input.priority,
    order: input.order,
    guideStart:
      input.axis === "x"
        ? { x: value, y: Math.min(input.point.y, input.movingPoint.y) }
        : { x: Math.min(input.point.x, input.movingPoint.x), y: value },
    guideEnd:
      input.axis === "x"
        ? { x: value, y: Math.max(input.point.y, input.movingPoint.y) }
        : { x: Math.max(input.point.x, input.movingPoint.x), y: value }
  };
}

function connectionLaneCandidates(input: {
  model: DrawingModel;
  axis: RouteAlignmentAxis;
  movingPoint: { x: number; y: number };
  orderStart: number;
}): GuidedSnapCandidate[] {
  const candidates: GuidedSnapCandidate[] = [];
  let order = input.orderStart;

  for (const connection of input.model.connections) {
    if (!connection.route) continue;
    const points = expandedOrthogonalPoints(connection.route);
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const vertical = from.x === to.x && from.y !== to.y;
      const horizontal = from.y === to.y && from.x !== to.x;
      if (
        (input.axis === "x" && !vertical) ||
        (input.axis === "y" && !horizontal)
      ) {
        continue;
      }
      const value = input.axis === "x" ? from.x : from.y;
      candidates.push({
        axis: input.axis,
        value,
        sourceKind: "segment",
        sourceId: `${connection.id}:${index}`,
        priority: 1,
        order,
        guideStart:
          input.axis === "x"
            ? {
                x: value,
                y: Math.min(from.y, to.y, input.movingPoint.y)
              }
            : {
                x: Math.min(from.x, to.x, input.movingPoint.x),
                y: value
              },
        guideEnd:
          input.axis === "x"
            ? {
                x: value,
                y: Math.max(from.y, to.y, input.movingPoint.y)
              }
            : {
                x: Math.max(from.x, to.x, input.movingPoint.x),
                y: value
              }
      });
      order += 1;
    }
  }

  return candidates;
}

function candidatesForAxis(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  from: DrawingEndpoint;
  destination?: DrawingEndpoint;
  proposedPoint: { x: number; y: number };
  axis: RouteAlignmentAxis;
}): GuidedSnapCandidate[] {
  const candidates: GuidedSnapCandidate[] = [];
  const source = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.from
  );
  const destination = input.destination
    ? getEndpointRoutingContext(
        input.model,
        input.symbols,
        input.destination
      )
    : null;

  if (source) {
    candidates.push(
      pointCandidate({
        axis: input.axis,
        point: source.point,
        movingPoint: input.proposedPoint,
        sourceId: `source:${input.axis}`,
        priority: 0,
        order: 0
      })
    );
  }
  if (destination) {
    candidates.push(
      pointCandidate({
        axis: input.axis,
        point: destination.point,
        movingPoint: input.proposedPoint,
        sourceId: `destination:${input.axis}`,
        priority: 0,
        order: 1
      })
    );
  }

  candidates.push(
    ...connectionLaneCandidates({
      model: input.model,
      axis: input.axis,
      movingPoint: input.proposedPoint,
      orderStart: candidates.length
    })
  );

  const gridSize = input.model.sheet.gridSize;
  const gridValue = roundValue(
    Math.round(input.proposedPoint[input.axis] / gridSize) * gridSize
  );
  candidates.push({
    axis: input.axis,
    value: gridValue,
    sourceKind: "point",
    sourceId: `grid:${input.axis}:${gridValue}`,
    priority: 2,
    order: candidates.length,
    guideStart:
      input.axis === "x"
        ? { x: gridValue, y: 0 }
        : { x: 0, y: gridValue },
    guideEnd:
      input.axis === "x"
        ? { x: gridValue, y: input.model.sheet.height }
        : { x: input.model.sheet.width, y: gridValue }
  });

  return candidates;
}

function findSnapCandidate(input: {
  axis: RouteAlignmentAxis;
  value: number;
  candidates: GuidedSnapCandidate[];
  pixelsPerUnit: PixelsPerUnit;
  activeTarget?: RouteSnapTarget;
}): GuidedSnapCandidate | undefined {
  if (input.activeTarget) {
    const held = input.candidates.find(
      (candidate) =>
        candidate.axis === input.activeTarget?.axis &&
        candidate.sourceKind === input.activeTarget.sourceKind &&
        candidate.sourceId === input.activeTarget.sourceId
    );
    if (
      held &&
      pixelsForAxis(
        input.axis,
        input.value - held.value,
        input.pixelsPerUnit
      ) <= ROUTE_SNAP_RELEASE_PX
    ) {
      return held;
    }
  }

  return input.candidates
    .map((candidate) => ({
      candidate,
      distancePx: pixelsForAxis(
        input.axis,
        input.value - candidate.value,
        input.pixelsPerUnit
      )
    }))
    .filter(({ distancePx }) => distancePx <= ROUTE_SNAP_ACQUIRE_PX)
    .sort(
      (first, second) =>
        first.candidate.priority - second.candidate.priority ||
        first.distancePx - second.distancePx ||
        first.candidate.order - second.candidate.order
    )[0]?.candidate;
}

function feedbackFromCandidate(
  candidate: GuidedSnapCandidate
): RouteAlignmentFeedback {
  return {
    axis: candidate.axis,
    value: candidate.value,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId,
    guideStart: candidate.guideStart,
    guideEnd: candidate.guideEnd
  };
}

function snapTargetFromCandidate(
  candidate: GuidedSnapCandidate
): RouteSnapTarget {
  return {
    axis: candidate.axis,
    value: candidate.value,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId
  };
}

export function resolveGuidedConnectionPointer(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  from: DrawingEndpoint;
  destination?: DrawingEndpoint;
  waypoints: GuidedConnectionWaypoint[];
  proposedPoint: { x: number; y: number };
  pixelsPerUnit: PixelsPerUnit;
  activeSnapState?: RouteSnapState;
  bypassSnapping?: boolean;
}): GuidedConnectionPointerResolution {
  const proposedPoint = roundPoint(input.proposedPoint);
  if (!pointIsInsideSheet(proposedPoint, input.model.sheet)) {
    return {
      point: proposedPoint,
      snapState: {},
      alignmentFeedback: [],
      warning: "Move the pointer inside the printable sheet."
    };
  }

  const xCandidate = input.bypassSnapping
    ? undefined
    : findSnapCandidate({
        axis: "x",
        value: proposedPoint.x,
        candidates: candidatesForAxis({ ...input, proposedPoint, axis: "x" }),
        pixelsPerUnit: input.pixelsPerUnit,
        activeTarget: input.activeSnapState?.x
      });
  const yCandidate = input.bypassSnapping
    ? undefined
    : findSnapCandidate({
        axis: "y",
        value: proposedPoint.y,
        candidates: candidatesForAxis({ ...input, proposedPoint, axis: "y" }),
        pixelsPerUnit: input.pixelsPerUnit,
        activeTarget: input.activeSnapState?.y
      });
  let appliedX = xCandidate;
  let appliedY = yCandidate;
  const source = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.from
  );
  const previousPoint = input.waypoints.at(-1) ??
    (source ? getEndpointStubPoint(source) : undefined);

  if (
    previousPoint &&
    appliedX &&
    appliedY &&
    appliedX.value === previousPoint.x &&
    appliedY.value === previousPoint.y
  ) {
    const xDistance = pixelsForAxis(
      "x",
      proposedPoint.x - appliedX.value,
      input.pixelsPerUnit
    );
    const yDistance = pixelsForAxis(
      "y",
      proposedPoint.y - appliedY.value,
      input.pixelsPerUnit
    );
    if (xDistance > yDistance) appliedX = undefined;
    else appliedY = undefined;
  }

  const point = roundPoint({
    x: appliedX?.value ?? proposedPoint.x,
    y: appliedY?.value ?? proposedPoint.y
  });
  const snapState: RouteSnapState = {};
  if (appliedX) snapState.x = snapTargetFromCandidate(appliedX);
  if (appliedY) snapState.y = snapTargetFromCandidate(appliedY);

  return {
    point,
    snapState,
    alignmentFeedback: [appliedX, appliedY]
      .filter((candidate): candidate is GuidedSnapCandidate => Boolean(candidate))
      .map(feedbackFromCandidate)
  };
}

export function addGuidedConnectionWaypoint(input: {
  waypoints: GuidedConnectionWaypoint[];
  point: { x: number; y: number };
  previousPoint?: { x: number; y: number };
  sheet: DrawingModel["sheet"];
  pixelsPerUnit: PixelsPerUnit;
  id?: string;
}): GuidedConnectionWaypoint[] {
  const point = roundPoint(input.point);
  if (!pointIsInsideSheet(point, input.sheet)) return input.waypoints;

  const previous = input.waypoints.at(-1) ?? input.previousPoint;
  if (previous) {
    const distancePx = Math.hypot(
      (point.x - previous.x) * input.pixelsPerUnit.x,
      (point.y - previous.y) * input.pixelsPerUnit.y
    );
    if (distancePx < GUIDED_WAYPOINT_MIN_DISTANCE_PX) {
      return input.waypoints;
    }
  }

  return [
    ...input.waypoints,
    {
      id:
        input.id ??
        `draft_waypoint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...point
    }
  ];
}

export function removeLastGuidedConnectionWaypoint(
  waypoints: GuidedConnectionWaypoint[]
): GuidedConnectionWaypoint[] {
  return waypoints.length > 0 ? waypoints.slice(0, -1) : waypoints;
}
