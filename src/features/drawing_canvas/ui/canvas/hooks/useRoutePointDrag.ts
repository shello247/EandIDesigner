import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent
} from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import { removeRouteControlPoint } from "../../../logic/services/connection-route-geometry";
import {
  resolveRoutePointDrag,
  type RouteAlignmentFeedback
} from "../../../logic/services/connection-route-alignment";
import type { ConnectionSegment, RouteDragState } from "../types";
import {
  getSvgPixelsPerUnit,
  toSvgPoint
} from "../utils/canvasGeometry";

export function useRoutePointDrag({
  model,
  selectedConnectionSegment,
  onFocusCanvas,
  onConnectionSelect,
  onConnectionRouteChange,
  setSelectedRoutePointId,
  onGestureStart,
  onGestureEnd,
  onGestureCancel
}: {
  model: DrawingModel;
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
  onGestureCancel: () => void;
}) {
  const routeDragStateRef = useRef<RouteDragState | null>(null);
  const [alignmentFeedback, setAlignmentFeedback] = useState<
    RouteAlignmentFeedback[]
  >([]);

  const clearRoutePointGesture = useCallback(() => {
    routeDragStateRef.current = null;
    setAlignmentFeedback([]);
  }, []);

  const updateDraggedRoutePoint = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const routeDragState = routeDragStateRef.current;

      if (!routeDragState || routeDragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const pointer = toSvgPoint(event, model.sheet);
      if (!event.shiftKey) {
        routeDragState.axisLock = undefined;
      } else if (!routeDragState.axisLock) {
        const deltaX =
          Math.abs(pointer.x - routeDragState.startPointer.x) *
          routeDragState.pixelsPerUnit.x;
        const deltaY =
          Math.abs(pointer.y - routeDragState.startPointer.y) *
          routeDragState.pixelsPerUnit.y;
        if (Math.hypot(deltaX, deltaY) >= 3) {
          routeDragState.axisLock = deltaX >= deltaY ? "x" : "y";
        }
      }

      const result = resolveRoutePointDrag({
        route: routeDragState.startRoute,
        pointId: routeDragState.pointId,
        proposedPoint: pointer,
        startPoint: routeDragState.startPoint,
        sheet: model.sheet,
        pixelsPerUnit: routeDragState.pixelsPerUnit,
        activeSnapState: routeDragState.activeSnapState,
        axisLock: routeDragState.axisLock,
        bypassSnapping: event.altKey
      });
      routeDragState.activeSnapState = result.snapState;
      setAlignmentFeedback(result.feedback);
      onConnectionRouteChange(routeDragState.connectionId, result.route);
    },
    [model.sheet, onConnectionRouteChange]
  );

  const handleRoutePointPointerDown = useCallback(
    (pointId: string, event: PointerEvent<SVGRectElement>) => {
      if (event.button !== 0 || !selectedConnectionSegment) {
        return;
      }

      const startPoint = selectedConnectionSegment.route.points.find(
        (point) => point.id === pointId
      );
      if (!startPoint || startPoint.kind === "endpoint") {
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
        pointerId: event.pointerId,
        startRoute: selectedConnectionSegment.route,
        startPointer: toSvgPoint(event, model.sheet),
        startPoint,
        pixelsPerUnit: getSvgPixelsPerUnit(event.currentTarget, model.sheet),
        activeSnapState: {}
      };
    },
    [
      model.sheet,
      onConnectionSelect,
      onFocusCanvas,
      onGestureStart,
      selectedConnectionSegment,
      setSelectedRoutePointId
    ]
  );

  const endRoutePointDrag = useCallback(() => {
    if (!routeDragStateRef.current) {
      return;
    }
    clearRoutePointGesture();
    onGestureEnd();
  }, [clearRoutePointGesture, onGestureEnd]);

  const cancelRoutePointDrag = useCallback(() => {
    if (!routeDragStateRef.current) {
      return false;
    }
    clearRoutePointGesture();
    onGestureCancel();
    return true;
  }, [clearRoutePointGesture, onGestureCancel]);

  useEffect(() => {
    const active = routeDragStateRef.current;
    if (
      active &&
      selectedConnectionSegment?.connection.id !== active.connectionId
    ) {
      clearRoutePointGesture();
      onGestureCancel();
    }
  }, [
    clearRoutePointGesture,
    onGestureCancel,
    selectedConnectionSegment?.connection.id
  ]);

  const deleteRoutePoint = useCallback(
    (pointId: string) => {
      if (!selectedConnectionSegment) {
        return;
      }

      clearRoutePointGesture();
      onConnectionRouteChange(
        selectedConnectionSegment.connection.id,
        removeRouteControlPoint(selectedConnectionSegment.route, pointId)
      );
      setSelectedRoutePointId(null);
    },
    [
      clearRoutePointGesture,
      onConnectionRouteChange,
      selectedConnectionSegment,
      setSelectedRoutePointId
    ]
  );

  return {
    updateDraggedRoutePoint,
    handleRoutePointPointerDown,
    endRoutePointDrag,
    cancelRoutePointDrag,
    deleteRoutePoint,
    alignmentFeedback
  };
}
