import type { ApprovedDrawingSymbol } from "../../types";
import type { DrawingModel, DrawingValidationIssue } from "../../data/schema";
import {
  endpointPlacementIds,
  getEndpointWorldPoint,
  getPlacementObstacles,
  normalizeConnectionRoute,
  routeSegments,
  segmentIntersectsObstacle
} from "./connection-route-geometry";
import { getPlacementById } from "./drawing-connections";

const ENDPOINT_TOLERANCE = 0.5;

function isNear(
  first: { x: number; y: number },
  second: { x: number; y: number }
): boolean {
  return (
    Math.abs(first.x - second.x) <= ENDPOINT_TOLERANCE &&
    Math.abs(first.y - second.y) <= ENDPOINT_TOLERANCE
  );
}

export function validateConnectionRoutes(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingValidationIssue[] {
  const issues: DrawingValidationIssue[] = [];
  const obstacles = getPlacementObstacles(model, symbols);

  for (const [connectionIndex, connection] of model.connections.entries()) {
    const route = normalizeConnectionRoute({ model, symbols, connection });

    if (!route) {
      issues.push({
        severity: "blocking",
        code: "CONNECTION_ROUTE_INVALID",
        message: `Connection "${connection.id}" does not have resolvable route endpoints.`,
        path: `connections.${connectionIndex}.route`
      });
      continue;
    }

    const fromPoint = getEndpointWorldPoint(model, symbols, connection.from);
    const toPoint = getEndpointWorldPoint(model, symbols, connection.to);
    const firstPoint = route.points[0];
    const lastPoint = route.points.at(-1);

    if (
      fromPoint &&
      firstPoint &&
      !isNear(firstPoint, fromPoint)
    ) {
      issues.push({
        severity: "blocking",
        code: "CONNECTION_ROUTE_ENDPOINT_MISMATCH",
        message: `Connection "${connection.id}" route start does not match its source anchor.`,
        path: `connections.${connectionIndex}.route.points.0`
      });
    }

    if (toPoint && lastPoint && !isNear(lastPoint, toPoint)) {
      issues.push({
        severity: "blocking",
        code: "CONNECTION_ROUTE_ENDPOINT_MISMATCH",
        message: `Connection "${connection.id}" route end does not match its destination anchor.`,
        path: `connections.${connectionIndex}.route.points`
      });
    }

    for (const [pointIndex, point] of route.points.entries()) {
      if (
        point.x < 0 ||
        point.y < 0 ||
        point.x > model.sheet.width ||
        point.y > model.sheet.height
      ) {
        issues.push({
          severity: "blocking",
          code: "CONNECTION_ROUTE_POINT_OUT_OF_BOUNDS",
          message: `Connection "${connection.id}" has a route point outside the sheet.`,
          path: `connections.${connectionIndex}.route.points.${pointIndex}`
        });
      }
    }

    const endpointPlacements = endpointPlacementIds(connection);
    const crossingObstacle = routeSegments(route).some((segment) =>
      obstacles.some(
        (obstacle) =>
          !endpointPlacements.has(obstacle.placementId) &&
          segmentIntersectsObstacle(segment, obstacle)
      )
    );

    if (crossingObstacle) {
      issues.push({
        severity: "warning",
        code: "CONNECTION_ROUTE_OBSTACLE_CROSSING",
        message: `Connection "${connection.id}" route crosses a placement clearance zone.`,
        path: `connections.${connectionIndex}.route`
      });
    }

    if (connection.route?.locked && connection.route.mode !== "manual") {
      issues.push({
        severity: "warning",
        code: "CONNECTION_ROUTE_LOCKED_AUTO",
        message: `Connection "${connection.id}" is locked but still marked as auto-routed.`,
        path: `connections.${connectionIndex}.route.locked`
      });
    }

    if (connection.cablePlacementId) {
      const cablePlacement = getPlacementById(model, connection.cablePlacementId);
      const fromPlacement = getPlacementById(model, connection.from.placementId);
      const toPlacement = getPlacementById(model, connection.to.placementId);

      if (
        cablePlacement &&
        cablePlacement.id !== fromPlacement?.id &&
        cablePlacement.id !== toPlacement?.id
      ) {
        issues.push({
          severity: "warning",
          code: "CONNECTION_CABLE_ENDPOINT_DETACHED",
          message: `Connection "${connection.id}" is assigned to cable "${cablePlacement.tag}" but neither endpoint lands on that cable symbol.`,
          path: `connections.${connectionIndex}.cablePlacementId`
        });
      }
    }
  }

  return issues;
}
