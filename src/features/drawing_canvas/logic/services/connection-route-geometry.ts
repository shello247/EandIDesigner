import type {
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingEndpoint,
  DrawingPlacement,
  DrawingSheetCanvasModel as DrawingModel,
  DrawingRoutePoint
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getAnchorWorldPoint, getPlacementBounds } from "./drawing-geometry";
import {
  getAnchorForEndpoint,
  getPlacementById,
  getSymbolForPlacement
} from "./drawing-connections";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement
} from "./drawing-backplane-layouts";
import {
  getBackplaneDisplayBounds,
  getParentPanelForBackplane,
  resolveLayoutHelperDisplayPlacement
} from "./drawing-backplane-scale";
import { insertRouteControlPointOnSegment } from "./connection-route-alignment";

export type RouteSegment = {
  from: DrawingRoutePoint;
  to: DrawingRoutePoint;
};

export type PlacementObstacle = {
  placementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_STUB_LENGTH = 12;
const OBSTACLE_CLEARANCE = 4;
const PARALLEL_ROUTE_SPACING = 3.2;
const ROUTE_CONTROL_POINT_SHEET_INSET = 2.5;

export type EndpointSide = "top" | "right" | "bottom" | "left";

export type EndpointRoutingContext = {
  point: { x: number; y: number };
  side: EndpointSide;
  isCableEndpoint: boolean;
};

function resolvePlacementForRouting(
  model: DrawingModel,
  placement: DrawingPlacement
): DrawingPlacement {
  const parentBackplane =
    isLayoutHelperPlacement(placement) && placement.layoutParentId
      ? model.placements.find(
          (candidate) =>
            candidate.id === placement.layoutParentId &&
            isBackplanePlacement(candidate)
        )
      : undefined;

  return parentBackplane
    ? resolveLayoutHelperDisplayPlacement({
        sheet: model.sheet,
        placement,
        backplane: parentBackplane,
        parentPanel: getParentPanelForBackplane(
          model.placements,
          parentBackplane
        )
      })
    : placement;
}

function routePointId(connectionId: string, suffix: string): string {
  return `${connectionId}_${suffix}`;
}

function roundPoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  };
}

function routeEndpointPoint(
  connectionId: string,
  endpointName: "from" | "to",
  point: { x: number; y: number }
): DrawingRoutePoint {
  return {
    id: routePointId(connectionId, endpointName),
    kind: "endpoint",
    ...roundPoint(point)
  };
}

function controlPoint(
  connectionId: string,
  index: number,
  point: { x: number; y: number }
): DrawingRoutePoint {
  return {
    id: routePointId(connectionId, `control_${index}`),
    kind: "control",
    ...roundPoint(point)
  };
}

export function getEndpointWorldPoint(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  endpoint: DrawingEndpoint
): { x: number; y: number } | null {
  const resolved = getAnchorForEndpoint(model, symbols, endpoint);

  if (!resolved) {
    return null;
  }

  return getAnchorWorldPoint(
    resolvePlacementForRouting(model, resolved.placement),
    resolved.symbol.metadata,
    resolved.anchor
  );
}

export function getEndpointRoutingContext(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  endpoint: DrawingEndpoint
): EndpointRoutingContext | null {
  const resolved = getAnchorForEndpoint(model, symbols, endpoint);

  if (!resolved) {
    return null;
  }

  const routePlacement = resolvePlacementForRouting(model, resolved.placement);
  const point = getAnchorWorldPoint(
    routePlacement,
    resolved.symbol.metadata,
    resolved.anchor
  );
  const bounds = getPlacementBounds(routePlacement, resolved.symbol.metadata);
  const distances: Array<{ side: EndpointSide; value: number }> = [
    { side: "top", value: Math.abs(point.y - bounds.y) },
    {
      side: "right",
      value: Math.abs(point.x - (bounds.x + bounds.width))
    },
    {
      side: "bottom",
      value: Math.abs(point.y - (bounds.y + bounds.height))
    },
    { side: "left", value: Math.abs(point.x - bounds.x) }
  ];
  const side = distances.reduce((best, candidate) =>
    candidate.value < best.value ? candidate : best
  ).side;

  return {
    point,
    side,
    isCableEndpoint: resolved.placement.role === "cable_assembly"
  };
}

export function getEndpointStubPoint(
  context: EndpointRoutingContext
): { x: number; y: number } {
  const length = context.isCableEndpoint
    ? DEFAULT_STUB_LENGTH * 0.72
    : DEFAULT_STUB_LENGTH;

  switch (context.side) {
    case "top":
      return { x: context.point.x, y: context.point.y - length };
    case "right":
      return { x: context.point.x + length, y: context.point.y };
    case "bottom":
      return { x: context.point.x, y: context.point.y + length };
    case "left":
      return { x: context.point.x - length, y: context.point.y };
  }
}

function routeGroupOffset(
  model: DrawingModel,
  connection: DrawingConnection
): number {
  if (!connection.cablePlacementId) {
    return 0;
  }

  const group = [...model.connections, connection]
    .filter(
      (candidate, index, candidates) =>
        candidate.cablePlacementId === connection.cablePlacementId &&
        candidates.findIndex((item) => item.id === candidate.id) === index
    )
    .sort((first, second) => first.id.localeCompare(second.id));

  if (group.length <= 1) {
    return 0;
  }

  const index = group.findIndex((candidate) => candidate.id === connection.id);

  if (index < 0) {
    return 0;
  }

  return Number(
    ((index - (group.length - 1) / 2) * PARALLEL_ROUTE_SPACING).toFixed(2)
  );
}

function offsetControlPoints(input: {
  points: DrawingRoutePoint[];
  offset: number;
  horizontalDominant: boolean;
}): DrawingRoutePoint[] {
  if (input.offset === 0) {
    return input.points;
  }

  return input.points.map((point) => {
    if (point.kind === "endpoint") {
      return point;
    }

    return input.horizontalDominant
      ? { ...point, y: Number((point.y + input.offset).toFixed(2)) }
      : { ...point, x: Number((point.x + input.offset).toFixed(2)) };
  });
}

function clampRouteControlCoordinate(value: number, maximum: number): number {
  const inset = routeControlPointInset(maximum);
  return Number(
    Math.max(inset, Math.min(maximum - inset, value)).toFixed(2)
  );
}

function routeControlPointInset(maximum: number): number {
  return Math.min(ROUTE_CONTROL_POINT_SHEET_INSET, maximum / 2);
}

function routeControlPointIsOutsideSheet(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
): boolean {
  const xInset = routeControlPointInset(sheet.width);
  const yInset = routeControlPointInset(sheet.height);
  return (
    point.x < xInset ||
    point.x > sheet.width - xInset ||
    point.y < yInset ||
    point.y > sheet.height - yInset
  );
}

export function hasConnectionRouteOutsideSheet(
  route: DrawingConnectionRoute,
  sheet: DrawingModel["sheet"]
): boolean {
  return (
    route.points.some(
      (point) =>
        point.kind !== "endpoint" && routeControlPointIsOutsideSheet(point, sheet)
    ) ||
    Boolean(
      route.labelPosition &&
        (route.labelPosition.x < 0 ||
          route.labelPosition.x > sheet.width ||
          route.labelPosition.y < 0 ||
          route.labelPosition.y > sheet.height)
    )
  );
}

export function bringConnectionRouteOntoSheet(input: {
  route: DrawingConnectionRoute;
  sheet: DrawingModel["sheet"];
}): DrawingConnectionRoute {
  const recoveredRoute: DrawingConnectionRoute = {
    ...input.route,
    points: input.route.points.map((point) =>
      point.kind === "endpoint"
        ? point
        : {
            ...point,
            x: clampRouteControlCoordinate(point.x, input.sheet.width),
            y: clampRouteControlCoordinate(point.y, input.sheet.height)
          }
    )
  };

  return input.route.labelPosition
    ? {
        ...recoveredRoute,
        labelPosition: {
          x: Number(
            Math.max(
              0,
              Math.min(input.sheet.width, input.route.labelPosition.x)
            ).toFixed(2)
          ),
          y: Number(
            Math.max(
              0,
              Math.min(input.sheet.height, input.route.labelPosition.y)
            ).toFixed(2)
          )
        }
      }
    : recoveredRoute;
}

export function generateDefaultOrthogonalRoute(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
  mode?: "manual" | "auto";
}): DrawingConnectionRoute | null {
  const fromContext = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.connection.from
  );
  const toContext = getEndpointRoutingContext(
    input.model,
    input.symbols,
    input.connection.to
  );

  if (!fromContext || !toContext) {
    return null;
  }

  const fromPoint = fromContext.point;
  const toPoint = toContext.point;
  const fromStub = getEndpointStubPoint(fromContext);
  const toStub = getEndpointStubPoint(toContext);
  const horizontalDominant =
    Math.abs(toPoint.x - fromPoint.x) >= Math.abs(toPoint.y - fromPoint.y);
  const midpointX = Number(((fromStub.x + toStub.x) / 2).toFixed(2));
  const midpointY = Number(((fromStub.y + toStub.y) / 2).toFixed(2));
  const offset = routeGroupOffset(input.model, input.connection);

  const controls = horizontalDominant
    ? [
        controlPoint(input.connection.id, 1, fromStub),
        controlPoint(input.connection.id, 2, { x: midpointX, y: fromStub.y }),
        controlPoint(input.connection.id, 3, { x: midpointX, y: toStub.y }),
        controlPoint(input.connection.id, 4, toStub)
      ]
    : [
        controlPoint(input.connection.id, 1, fromStub),
        controlPoint(input.connection.id, 2, { x: fromStub.x, y: midpointY }),
        controlPoint(input.connection.id, 3, { x: toStub.x, y: midpointY }),
        controlPoint(input.connection.id, 4, toStub)
      ];
  const points = offsetControlPoints({
    points: [
      routeEndpointPoint(input.connection.id, "from", fromPoint),
      ...controls,
      routeEndpointPoint(input.connection.id, "to", toPoint)
    ],
    offset,
    horizontalDominant
  });

  return bringConnectionRouteOntoSheet({
    route: {
      mode: input.mode ?? "auto",
      style: "orthogonal",
      points
    },
    sheet: input.model.sheet
  });
}

export function normalizeConnectionRoute(input: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  connection: DrawingConnection;
}): DrawingConnectionRoute | null {
  const fallback = generateDefaultOrthogonalRoute({
    ...input,
    mode: input.connection.route?.mode ?? "auto"
  });

  if (!fallback) {
    return null;
  }

  const route = input.connection.route;

  if (!route || route.points.length < 2) {
    return fallback;
  }

  const middlePoints = route.points
    .slice(1, -1)
    .filter((point) => point.kind !== "endpoint")
    .map((point, index) => ({
      ...point,
      id: point.id || routePointId(input.connection.id, `control_${index + 1}`),
      kind: (point.kind === "elbow" ? "elbow" : "control") as
        | "elbow"
        | "control",
      ...roundPoint(point)
    }));

  return {
    ...route,
    style: "orthogonal",
    points: [
      fallback.points[0],
      ...middlePoints,
      fallback.points[fallback.points.length - 1]
    ]
  };
}

export function expandedOrthogonalPoints(
  route: DrawingConnectionRoute
): DrawingRoutePoint[] {
  const points: DrawingRoutePoint[] = [];

  for (const point of route.points) {
    const previous = points.at(-1);

    if (!previous) {
      points.push(point);
      continue;
    }

    if (previous.x !== point.x && previous.y !== point.y) {
      points.push({
        id: `${previous.id}_${point.id}_dogleg`,
        kind: "elbow",
        x: point.x,
        y: previous.y
      });
    }

    const latest = points.at(-1);
    if (!latest || latest.x !== point.x || latest.y !== point.y) {
      points.push(point);
    }
  }

  return points;
}

export function routeSegments(route: DrawingConnectionRoute): RouteSegment[] {
  const points = expandedOrthogonalPoints(route);
  const segments: RouteSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      from: points[index],
      to: points[index + 1]
    });
  }

  return segments;
}

export function updateRoutePoint(input: {
  route: DrawingConnectionRoute;
  pointId: string;
  point: { x: number; y: number };
  sheet: DrawingModel["sheet"];
}): DrawingConnectionRoute {
  return {
    ...input.route,
    mode: "manual",
    points: input.route.points.map((routePoint) =>
      routePoint.id === input.pointId && routePoint.kind !== "endpoint"
        ? {
            ...routePoint,
            x: Number(
              Math.max(0, Math.min(input.sheet.width, input.point.x)).toFixed(2)
            ),
            y: Number(
              Math.max(0, Math.min(input.sheet.height, input.point.y)).toFixed(2)
            )
          }
        : routePoint
    )
  };
}

export function updateRouteLabelPosition(input: {
  route: DrawingConnectionRoute;
  point: { x: number; y: number };
  sheet: DrawingModel["sheet"];
}): DrawingConnectionRoute {
  return {
    ...input.route,
    mode: "manual",
    labelPosition: {
      x: Number(
        Math.max(0, Math.min(input.sheet.width, input.point.x)).toFixed(2)
      ),
      y: Number(
        Math.max(0, Math.min(input.sheet.height, input.point.y)).toFixed(2)
      )
    }
  };
}

export function addRouteControlPoint(input: {
  route: DrawingConnectionRoute;
  connectionId: string;
  point: { x: number; y: number };
  sheet: DrawingModel["sheet"];
}): DrawingConnectionRoute {
  return insertRouteControlPointOnSegment(input);
}

export function removeRouteControlPoint(
  route: DrawingConnectionRoute,
  pointId: string
): DrawingConnectionRoute {
  return {
    ...route,
    mode: "manual",
    points: route.points.filter(
      (point) => point.id !== pointId || point.kind === "endpoint"
    )
  };
}

export function getPlacementObstacles(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PlacementObstacle[] {
  return model.placements.flatMap((placement) => {
    const symbol = getSymbolForPlacement(placement, symbols);

    if (!symbol) {
      return [];
    }

    const routePlacement = resolvePlacementForRouting(model, placement);
    const bounds = isBackplanePlacement(placement)
      ? getBackplaneDisplayBounds(
          model.sheet,
          placement,
          getParentPanelForBackplane(model.placements, placement)
        )
      : getPlacementBounds(routePlacement, symbol.metadata);

    return [
      {
        placementId: placement.id,
        x: bounds.x - OBSTACLE_CLEARANCE,
        y: bounds.y - OBSTACLE_CLEARANCE,
        width: bounds.width + OBSTACLE_CLEARANCE * 2,
        height: bounds.height + OBSTACLE_CLEARANCE * 2
      }
    ];
  });
}

export function segmentIntersectsObstacle(
  segment: RouteSegment,
  obstacle: PlacementObstacle
): boolean {
  const minX = Math.min(segment.from.x, segment.to.x);
  const maxX = Math.max(segment.from.x, segment.to.x);
  const minY = Math.min(segment.from.y, segment.to.y);
  const maxY = Math.max(segment.from.y, segment.to.y);
  const obstacleMaxX = obstacle.x + obstacle.width;
  const obstacleMaxY = obstacle.y + obstacle.height;

  if (segment.from.y === segment.to.y) {
    const y = segment.from.y;
    return (
      y >= obstacle.y &&
      y <= obstacleMaxY &&
      maxX >= obstacle.x &&
      minX <= obstacleMaxX
    );
  }

  if (segment.from.x === segment.to.x) {
    const x = segment.from.x;
    return (
      x >= obstacle.x &&
      x <= obstacleMaxX &&
      maxY >= obstacle.y &&
      minY <= obstacleMaxY
    );
  }

  return (
    maxX >= obstacle.x &&
    minX <= obstacleMaxX &&
    maxY >= obstacle.y &&
    minY <= obstacleMaxY
  );
}

export function endpointPlacementIds(connection: DrawingConnection): Set<string> {
  return new Set([
    connection.from.placementId,
    connection.to.placementId,
    connection.cablePlacementId ?? ""
  ]);
}

export function connectionCableEndpointAttached(
  model: DrawingModel,
  connection: DrawingConnection
): boolean {
  if (!connection.cablePlacementId) {
    return true;
  }

  const cablePlacement = getPlacementById(model, connection.cablePlacementId);

  if (!cablePlacement) {
    return true;
  }

  return (
    connection.from.placementId === cablePlacement.id ||
    connection.to.placementId === cablePlacement.id
  );
}

export function getRouteMidpoint(route: DrawingConnectionRoute): {
  x: number;
  y: number;
} {
  const points = expandedOrthogonalPoints(route);

  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  return points[Math.floor(points.length / 2)];
}
