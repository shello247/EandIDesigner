import type {
  DrawingAnnotation,
  DrawingConnection,
  DrawingConnectionRoute,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { placementAssetId } from "../services/drawing-asset-identity";
import { clearLayoutDimensionAttachmentToPlacement } from "../services/drawing-layout-dimensions";
import {
  containedPlacementIdsForPanels,
  isGeneratedPanelEnclosurePlacement
} from "../services/drawing-asset-containment";
import { isPanelConnectionViewPlacement } from "../services/drawing-panel-connection-views";
import {
  moveConnectionRoute,
  movePlacementWithAttachedLabel
} from "../services/drawing-movement";

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
  const currentPlacement = model.placements.find(
    (placement) => placement.id === placementId
  );
  const nextX = updates.x ?? currentPlacement?.x;
  const nextY = updates.y ?? currentPlacement?.y;
  const panelDelta =
    currentPlacement &&
    (isGeneratedPanelEnclosurePlacement(currentPlacement) ||
      isPanelConnectionViewPlacement(currentPlacement)) &&
    nextX !== undefined &&
    nextY !== undefined
      ? {
          x: Number((nextX - currentPlacement.x).toFixed(2)),
          y: Number((nextY - currentPlacement.y).toFixed(2))
        }
      : undefined;
  const containedIds = panelDelta
    ? new Set(containedPlacementIdsForPanels(model, [placementId]))
    : new Set<string>();

  return {
    ...model,
    placements: model.placements.map((placement) => {
      if (placement.id === placementId) {
        return { ...placement, ...updates };
      }

      return panelDelta && containedIds.has(placement.id)
        ? movePlacementWithAttachedLabel(placement, panelDelta)
        : placement;
    }),
    connections: panelDelta
      ? model.connections.map((connection) =>
          connection.route &&
          containedIds.has(connection.from.placementId) &&
          containedIds.has(connection.to.placementId)
            ? {
                ...connection,
                route: moveConnectionRoute(connection.route, panelDelta)
              }
            : connection
        )
      : model.connections
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
    deletedPlacement?.role === "enclosure" &&
    !isPanelConnectionViewPlacement(deletedPlacement)
      ? placementAssetId(deletedPlacement)
      : undefined;
  const deletedLayoutParentId =
    deletedPlacement?.layoutKind === "backplane" ? deletedPlacement.id : undefined;
  const deletedConnectionViewChildIds = new Set(
    isPanelConnectionViewPlacement(deletedPlacement)
      ? model.placements
          .filter((placement) => placement.layoutParentId === placementId)
          .map((placement) => placement.id)
      : []
  );

  return {
    ...model,
    placements: model.placements
      .filter(
        (placement) =>
          placement.id !== placementId &&
          !deletedConnectionViewChildIds.has(placement.id)
      )
      .map((placement) => {
        const withoutDeletedDimensionAttachment =
          clearLayoutDimensionAttachmentToPlacement(placement, placementId);
        const withoutDeletedContainer =
          deletedAssetId &&
          withoutDeletedDimensionAttachment.containerAssetId === deletedAssetId
            ? {
                ...withoutDeletedDimensionAttachment,
                containerAssetId: undefined
              }
            : withoutDeletedDimensionAttachment;

        return deletedLayoutParentId &&
          withoutDeletedContainer.layoutParentId === deletedLayoutParentId
          ? { ...withoutDeletedContainer, layoutParentId: undefined }
          : withoutDeletedContainer;
      }),
    connections: model.connections.filter(
      (connection) =>
        connection.from.placementId !== placementId &&
        connection.to.placementId !== placementId &&
        connection.cablePlacementId !== placementId &&
        !deletedConnectionViewChildIds.has(connection.from.placementId) &&
        !deletedConnectionViewChildIds.has(connection.to.placementId) &&
        (!connection.cablePlacementId ||
          !deletedConnectionViewChildIds.has(connection.cablePlacementId))
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
    annotations: model.annotations.map((annotation): DrawingAnnotation => {
      if (annotation.id !== annotationId) return annotation;
      return {
        ...annotation,
        ...updates,
        id: annotation.id,
        kind: annotation.kind
      } as DrawingAnnotation;
    })
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
