import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { placementAssetId } from "../services/drawing-asset-identity";

export function addPlacement(
  model: DrawingSheetCanvasModel,
  placement: DrawingPlacement
): DrawingSheetCanvasModel {
  return {
    ...model,
    placements: [...model.placements, placement]
  };
}

export function updatePlacementProperties(
  model: DrawingSheetCanvasModel,
  placementId: string,
  updates: Partial<DrawingPlacement>
): DrawingSheetCanvasModel {
  return {
    ...model,
    placements: model.placements.map((placement) =>
      placement.id === placementId ? { ...placement, ...updates } : placement
    )
  };
}

export function movePlacement(
  model: DrawingSheetCanvasModel,
  placementId: string,
  point: { x: number; y: number }
): DrawingSheetCanvasModel {
  return updatePlacementProperties(model, placementId, point);
}

export function resizePlacement(
  model: DrawingSheetCanvasModel,
  placementId: string,
  scale: number
): DrawingSheetCanvasModel {
  return updatePlacementProperties(model, placementId, { scale });
}

export function deletePlacement(
  model: DrawingSheetCanvasModel,
  placementId: string
): DrawingSheetCanvasModel {
  const deletedPlacement = model.placements.find(
    (placement) => placement.id === placementId
  );
  const deletedAssetId =
    deletedPlacement?.role === "enclosure"
      ? placementAssetId(deletedPlacement)
      : undefined;
  const deletedLayoutParentId =
    deletedPlacement?.layoutKind === "backplane" ? deletedPlacement.id : undefined;

  return {
    ...model,
    placements: model.placements
      .filter((placement) => placement.id !== placementId)
      .map((placement) => {
        const withoutDeletedContainer =
          deletedAssetId && placement.containerAssetId === deletedAssetId
            ? { ...placement, containerAssetId: undefined }
            : placement;

        return deletedLayoutParentId &&
          withoutDeletedContainer.layoutParentId === deletedLayoutParentId
          ? { ...withoutDeletedContainer, layoutParentId: undefined }
          : withoutDeletedContainer;
      }),
    connections: model.connections.filter(
      (connection) =>
        connection.from.placementId !== placementId &&
        connection.to.placementId !== placementId &&
        connection.cablePlacementId !== placementId
    )
  };
}

export function addConnection(
  model: DrawingSheetCanvasModel,
  connection: DrawingConnection
): DrawingSheetCanvasModel {
  return {
    ...model,
    connections: [...model.connections, connection]
  };
}

export function updateConnection(
  model: DrawingSheetCanvasModel,
  connectionId: string,
  updates: Partial<DrawingConnection>
): DrawingSheetCanvasModel {
  return {
    ...model,
    connections: model.connections.map((connection) =>
      connection.id === connectionId ? { ...connection, ...updates } : connection
    )
  };
}

export function updateConnectionRoute(
  model: DrawingSheetCanvasModel,
  connectionId: string,
  route: DrawingConnectionRoute
): DrawingSheetCanvasModel {
  return updateConnection(model, connectionId, { route });
}

export function updateConnectionLabel(
  model: DrawingSheetCanvasModel,
  connectionId: string,
  label: string | undefined
): DrawingSheetCanvasModel {
  return updateConnection(model, connectionId, { label });
}

export function deleteConnection(
  model: DrawingSheetCanvasModel,
  connectionId: string
): DrawingSheetCanvasModel {
  return {
    ...model,
    connections: model.connections.filter(
      (connection) => connection.id !== connectionId
    )
  };
}

export function addAnnotation(
  model: DrawingSheetCanvasModel,
  annotation: DrawingAnnotation
): DrawingSheetCanvasModel {
  return {
    ...model,
    annotations: [...model.annotations, annotation]
  };
}

export function updateAnnotation(
  model: DrawingSheetCanvasModel,
  annotationId: string,
  updates: Partial<DrawingAnnotation>
): DrawingSheetCanvasModel {
  return {
    ...model,
    annotations: model.annotations.map((annotation) =>
      annotation.id === annotationId ? { ...annotation, ...updates } : annotation
    )
  };
}

export function moveAnnotation(
  model: DrawingSheetCanvasModel,
  annotationId: string,
  point: { x: number; y: number }
): DrawingSheetCanvasModel {
  return updateAnnotation(model, annotationId, point);
}

export function deleteAnnotation(
  model: DrawingSheetCanvasModel,
  annotationId: string
): DrawingSheetCanvasModel {
  return {
    ...model,
    annotations: model.annotations.filter(
      (annotation) => annotation.id !== annotationId
    )
  };
}
