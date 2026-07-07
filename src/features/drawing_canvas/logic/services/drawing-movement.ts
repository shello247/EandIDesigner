import type {
  DrawingAnnotation,
  DrawingConnectionRoute,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  clampAnnotationPosition,
  clampPointToSheet
} from "./drawing-annotations";
import { containedPlacementIdsForBackplanes } from "./drawing-backplane-layouts";
import { containedPlacementIdsForPanels } from "./drawing-asset-containment";
import type { DrawingCanvasSelection } from "./drawing-selection";

type Point = { x: number; y: number };

function round(value: number): number {
  return Number(value.toFixed(2));
}

function translatePoint(point: Point, delta: Point): Point {
  return {
    x: round(point.x + delta.x),
    y: round(point.y + delta.y)
  };
}

export function movePlacementWithAttachedLabel(
  placement: DrawingPlacement,
  delta: Point
): DrawingPlacement {
  return {
    ...placement,
    x: round(placement.x + delta.x),
    y: round(placement.y + delta.y),
    labelPosition: placement.labelPosition
      ? translatePoint(placement.labelPosition, delta)
      : placement.labelPosition
  };
}

export function moveConnectionRoute(
  route: DrawingConnectionRoute,
  delta: Point
): DrawingConnectionRoute {
  return {
    ...route,
    points: route.points.map((point) =>
      point.kind === "endpoint"
        ? point
        : {
            ...point,
            ...translatePoint(point, delta)
          }
    ),
    labelPosition: route.labelPosition
      ? translatePoint(route.labelPosition, delta)
      : route.labelPosition
  };
}

function moveAnnotation(
  annotation: DrawingAnnotation,
  delta: Point,
  sheet: DrawingSheetCanvasModel["sheet"]
): DrawingAnnotation {
  const position = clampAnnotationPosition(
    annotation,
    translatePoint(annotation, delta),
    sheet
  );

  return {
    ...annotation,
    ...position,
    leader: annotation.leader?.enabled
      ? {
          ...annotation.leader,
          ...(() => {
            const target = clampPointToSheet(
              {
                x: annotation.leader.targetX + delta.x,
                y: annotation.leader.targetY + delta.y
              },
              sheet
            );

            return {
              targetX: target.x,
              targetY: target.y
            };
          })()
        }
      : annotation.leader
  };
}

function constrainDeltaToPlacementOrigins(
  placements: DrawingPlacement[],
  delta: Point,
  sheet: DrawingSheetCanvasModel["sheet"]
): Point {
  if (placements.length === 0) {
    return delta;
  }

  const minX = Math.max(...placements.map((placement) => -placement.x));
  const maxX = Math.min(
    ...placements.map((placement) => sheet.width - placement.x)
  );
  const minY = Math.max(...placements.map((placement) => -placement.y));
  const maxY = Math.min(
    ...placements.map((placement) => sheet.height - placement.y)
  );

  return {
    x: round(Math.max(minX, Math.min(maxX, delta.x))),
    y: round(Math.max(minY, Math.min(maxY, delta.y)))
  };
}

function clampRoutePointToSheet(
  point: DrawingConnectionRoute["points"][number],
  sheet: DrawingSheetCanvasModel["sheet"]
): DrawingConnectionRoute["points"][number] {
  const clamped = clampPointToSheet(point, sheet);

  return {
    ...point,
    x: clamped.x,
    y: clamped.y
  };
}

function moveConnectionRouteWithinSheet(
  route: DrawingConnectionRoute,
  delta: Point,
  sheet: DrawingSheetCanvasModel["sheet"]
): DrawingConnectionRoute {
  const movedRoute = moveConnectionRoute(route, delta);

  return {
    ...movedRoute,
    points: movedRoute.points.map((point) =>
      point.kind === "endpoint" ? point : clampRoutePointToSheet(point, sheet)
    ),
    labelPosition: movedRoute.labelPosition
      ? clampPointToSheet(movedRoute.labelPosition, sheet)
      : movedRoute.labelPosition
  };
}

function isConnectionFullySelected(
  connection: DrawingSheetCanvasModel["connections"][number],
  selectedPlacementIds: Set<string>
): boolean {
  return (
    selectedPlacementIds.has(connection.from.placementId) &&
    selectedPlacementIds.has(connection.to.placementId) &&
    (!connection.cablePlacementId ||
      selectedPlacementIds.has(connection.cablePlacementId))
  );
}

export function moveCanvasSelection({
  model,
  selection,
  delta
}: {
  model: DrawingSheetCanvasModel;
  selection: DrawingCanvasSelection;
  delta: Point;
  symbols: ApprovedDrawingSymbol[];
}): DrawingSheetCanvasModel {
  if (
    (selection.placementIds.length === 0 &&
      selection.annotationIds.length === 0) ||
    (delta.x === 0 && delta.y === 0)
  ) {
    return model;
  }

  const selectedPlacementIds = new Set([
    ...selection.placementIds,
    ...containedPlacementIdsForPanels(model, selection.placementIds),
    ...containedPlacementIdsForBackplanes(model, selection.placementIds)
  ]);
  const selectedAnnotationIds = new Set(selection.annotationIds);
  const selectedPlacements = model.placements.filter((placement) =>
    selectedPlacementIds.has(placement.id)
  );
  const constrainedDelta = constrainDeltaToPlacementOrigins(
    selectedPlacements,
    delta,
    model.sheet
  );

  return {
    ...model,
    placements: model.placements.map((placement) =>
      selectedPlacementIds.has(placement.id)
        ? movePlacementWithAttachedLabel(placement, constrainedDelta)
        : placement
    ),
    connections: model.connections.map((connection) =>
      connection.route &&
      isConnectionFullySelected(connection, selectedPlacementIds)
        ? {
            ...connection,
            route: moveConnectionRouteWithinSheet(
              connection.route,
              constrainedDelta,
              model.sheet
            )
          }
        : connection
    ),
    annotations: model.annotations.map((annotation) =>
      selectedAnnotationIds.has(annotation.id)
        ? moveAnnotation(annotation, constrainedDelta, model.sheet)
        : annotation
    )
  };
}

export function movePanelWithContainedPlacements({
  model,
  panelPlacementIds,
  delta,
  symbols
}: {
  model: DrawingSheetCanvasModel;
  panelPlacementIds: string[];
  delta: Point;
  symbols: ApprovedDrawingSymbol[];
}): DrawingSheetCanvasModel {
  return moveCanvasSelection({
    model,
    selection: {
      placementIds: panelPlacementIds,
      annotationIds: []
    },
    delta,
    symbols
  });
}
