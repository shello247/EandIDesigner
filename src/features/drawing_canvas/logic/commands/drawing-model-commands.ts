import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingModel,
  DrawingPlacement
} from "../../data/schema";

export function addPlacement(
  model: DrawingModel,
  placement: DrawingPlacement
): DrawingModel {
  return {
    ...model,
    placements: [...model.placements, placement]
  };
}

export function updatePlacementProperties(
  model: DrawingModel,
  placementId: string,
  updates: Partial<DrawingPlacement>
): DrawingModel {
  return {
    ...model,
    placements: model.placements.map((placement) =>
      placement.id === placementId ? { ...placement, ...updates } : placement
    )
  };
}

export function movePlacement(
  model: DrawingModel,
  placementId: string,
  point: { x: number; y: number }
): DrawingModel {
  return updatePlacementProperties(model, placementId, point);
}

export function resizePlacement(
  model: DrawingModel,
  placementId: string,
  scale: number
): DrawingModel {
  return updatePlacementProperties(model, placementId, { scale });
}

export function deletePlacement(
  model: DrawingModel,
  placementId: string
): DrawingModel {
  return {
    ...model,
    placements: model.placements.filter((placement) => placement.id !== placementId),
    connections: model.connections.filter(
      (connection) =>
        connection.from.placementId !== placementId &&
        connection.to.placementId !== placementId &&
        connection.cablePlacementId !== placementId
    )
  };
}

export function addConnection(
  model: DrawingModel,
  connection: DrawingConnection
): DrawingModel {
  return {
    ...model,
    connections: [...model.connections, connection]
  };
}

export function updateConnection(
  model: DrawingModel,
  connectionId: string,
  updates: Partial<DrawingConnection>
): DrawingModel {
  return {
    ...model,
    connections: model.connections.map((connection) =>
      connection.id === connectionId ? { ...connection, ...updates } : connection
    )
  };
}

export function updateConnectionRoute(
  model: DrawingModel,
  connectionId: string,
  route: DrawingConnectionRoute
): DrawingModel {
  return updateConnection(model, connectionId, { route });
}

export function updateConnectionLabel(
  model: DrawingModel,
  connectionId: string,
  label: string | undefined
): DrawingModel {
  return updateConnection(model, connectionId, { label });
}

export function deleteConnection(
  model: DrawingModel,
  connectionId: string
): DrawingModel {
  return {
    ...model,
    connections: model.connections.filter(
      (connection) => connection.id !== connectionId
    )
  };
}

export function addAnnotation(
  model: DrawingModel,
  annotation: DrawingAnnotation
): DrawingModel {
  return {
    ...model,
    annotations: [...model.annotations, annotation]
  };
}

export function updateAnnotation(
  model: DrawingModel,
  annotationId: string,
  updates: Partial<DrawingAnnotation>
): DrawingModel {
  return {
    ...model,
    annotations: model.annotations.map((annotation) =>
      annotation.id === annotationId ? { ...annotation, ...updates } : annotation
    )
  };
}

export function moveAnnotation(
  model: DrawingModel,
  annotationId: string,
  point: { x: number; y: number }
): DrawingModel {
  return updateAnnotation(model, annotationId, point);
}

export function deleteAnnotation(
  model: DrawingModel,
  annotationId: string
): DrawingModel {
  return {
    ...model,
    annotations: model.annotations.filter(
      (annotation) => annotation.id !== annotationId
    )
  };
}
