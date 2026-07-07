import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import {
  removeRouteControlPoint,
  updateRoutePoint
} from "../../../logic/services/connection-route-geometry";
import type { ConnectionSegment, RouteDragState } from "../types";
import { toSvgPoint } from "../utils/canvasGeometry";

export function useRoutePointDrag({
  model,
  connectionSegments,
  selectedConnectionSegment,
  onFocusCanvas,
  onConnectionSelect,
  onConnectionRouteChange,
  setSelectedRoutePointId,
  onGestureStart,
  onGestureEnd
}: {
  model: DrawingModel;
  connectionSegments: ConnectionSegment[];
  selectedConnectionSegment: ConnectionSegment | null;
  onFocusCanvas: () => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onConnectionRouteChange: (
    connectionId: string,
    route: NonNullable<ConnectionSegment["connection"]["route"]>
  ) => void;
  setSelectedRoutePointId: (pointId: string | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const routeDragStateRef = useRef<RouteDragState | null>(null);

  const updateDraggedRoutePoint = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const routeDragState = routeDragStateRef.current;

      if (!routeDragState || routeDragState.pointerId !== event.pointerId) {
        return;
      }

      const segment = connectionSegments.find(
        (candidate) => candidate.connection.id === routeDragState.connectionId
      );

      if (!segment) {
        return;
      }

      event.preventDefault();
      onConnectionRouteChange(
        routeDragState.connectionId,
        updateRoutePoint({
          route: segment.route,
          pointId: routeDragState.pointId,
          point: toSvgPoint(event, model.sheet),
          sheet: model.sheet
        })
      );
    },
    [connectionSegments, model.sheet, onConnectionRouteChange]
  );

  const handleRoutePointPointerDown = useCallback(
    (pointId: string, event: PointerEvent<SVGRectElement>) => {
      if (event.button !== 0 || !selectedConnectionSegment) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onFocusCanvas();
      onConnectionSelect(selectedConnectionSegment.connection.id);
      setSelectedRoutePointId(pointId);
      onGestureStart();
      routeDragStateRef.current = {
        connectionId: selectedConnectionSegment.connection.id,
        pointId,
        pointerId: event.pointerId
      };
    },
    [
      onConnectionSelect,
      onFocusCanvas,
      onGestureStart,
      selectedConnectionSegment,
      setSelectedRoutePointId
    ]
  );

  const endRoutePointDrag = useCallback(() => {
    routeDragStateRef.current = null;
    onGestureEnd();
  }, [onGestureEnd]);

  const deleteRoutePoint = useCallback(
    (pointId: string) => {
      if (!selectedConnectionSegment) {
        return;
      }

      routeDragStateRef.current = null;
      onConnectionRouteChange(
        selectedConnectionSegment.connection.id,
        removeRouteControlPoint(selectedConnectionSegment.route, pointId)
      );
      setSelectedRoutePointId(null);
    },
    [onConnectionRouteChange, selectedConnectionSegment, setSelectedRoutePointId]
  );

  return {
    updateDraggedRoutePoint,
    handleRoutePointPointerDown,
    endRoutePointDrag,
    deleteRoutePoint
  };
}
