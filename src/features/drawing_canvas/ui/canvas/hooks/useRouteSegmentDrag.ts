import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent
} from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import {
  resolveRouteSegmentDrag,
  type RouteAlignmentFeedback
} from "../../../logic/services/connection-route-alignment";
import type { ConnectionSegment, RouteSegmentDragState } from "../types";
import {
  getSvgPixelsPerUnit,
  toSvgPoint
} from "../utils/canvasGeometry";

export function useRouteSegmentDrag({
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
  const routeSegmentDragStateRef = useRef<RouteSegmentDragState | null>(null);
  const [alignmentFeedback, setAlignmentFeedback] = useState<
    RouteAlignmentFeedback[]
  >([]);

  const clearRouteSegmentGesture = useCallback(() => {
    routeSegmentDragStateRef.current = null;
    setAlignmentFeedback([]);
  }, []);

  const updateDraggedRouteSegment = useCallback(
    (event: PointerEvent<SVGPathElement>) => {
      const dragState = routeSegmentDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const pointer = toSvgPoint(event, model.sheet);
      const result = resolveRouteSegmentDrag({
        route: dragState.startRoute,
        segmentKey: dragState.segmentKey,
        delta: {
          x: pointer.x - dragState.startPointer.x,
          y: pointer.y - dragState.startPointer.y
        },
        sheet: model.sheet,
        pixelsPerUnit: dragState.pixelsPerUnit,
        activeSnapState: dragState.activeSnapState,
        bypassSnapping: event.altKey
      });
      dragState.activeSnapState = result.snapState;
      setAlignmentFeedback(result.feedback);
      onConnectionRouteChange(dragState.connectionId, result.route);
    },
    [model.sheet, onConnectionRouteChange]
  );

  const handleRouteSegmentPointerDown = useCallback(
    (segmentKey: string, event: PointerEvent<SVGPathElement>) => {
      if (event.button !== 0 || !selectedConnectionSegment) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onFocusCanvas();
      onConnectionSelect(selectedConnectionSegment.connection.id);
      setSelectedRoutePointId(null);
      onGestureStart();
      routeSegmentDragStateRef.current = {
        connectionId: selectedConnectionSegment.connection.id,
        segmentKey,
        pointerId: event.pointerId,
        startRoute: selectedConnectionSegment.route,
        startPointer: toSvgPoint(event, model.sheet),
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

  const endRouteSegmentDrag = useCallback(() => {
    if (!routeSegmentDragStateRef.current) {
      return;
    }
    clearRouteSegmentGesture();
    onGestureEnd();
  }, [clearRouteSegmentGesture, onGestureEnd]);

  const cancelRouteSegmentDrag = useCallback(() => {
    if (!routeSegmentDragStateRef.current) {
      return false;
    }
    clearRouteSegmentGesture();
    onGestureCancel();
    return true;
  }, [clearRouteSegmentGesture, onGestureCancel]);

  useEffect(() => {
    const active = routeSegmentDragStateRef.current;
    if (
      active &&
      selectedConnectionSegment?.connection.id !== active.connectionId
    ) {
      clearRouteSegmentGesture();
      onGestureCancel();
    }
  }, [
    clearRouteSegmentGesture,
    onGestureCancel,
    selectedConnectionSegment?.connection.id
  ]);

  return {
    handleRouteSegmentPointerDown,
    updateDraggedRouteSegment,
    endRouteSegmentDrag,
    cancelRouteSegmentDrag,
    alignmentFeedback
  };
}
