import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingModel } from "../../../data/schema";
import { updateRouteLabelPosition } from "../../../logic/services/connection-route-geometry";
import type { ConnectionSegment, RouteLabelDragState } from "../types";
import { toSvgPoint } from "../utils/canvasGeometry";

export function useRouteLabelDrag({
  model,
  connectionSegments,
  selectedConnectionSegment,
  onFocusCanvas,
  onConnectionSelect,
  onConnectionRouteChange,
  setSelectedRoutePointId
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
}) {
  const routeLabelDragStateRef = useRef<RouteLabelDragState | null>(null);

  const updateDraggedRouteLabel = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const routeLabelDragState = routeLabelDragStateRef.current;

      if (
        !routeLabelDragState ||
        routeLabelDragState.pointerId !== event.pointerId
      ) {
        return;
      }

      const segment = connectionSegments.find(
        (candidate) =>
          candidate.connection.id === routeLabelDragState.connectionId
      );

      if (!segment) {
        return;
      }

      event.preventDefault();
      const pointer = toSvgPoint(event, model.sheet);
      onConnectionRouteChange(
        routeLabelDragState.connectionId,
        updateRouteLabelPosition({
          route: segment.route,
          point: {
            x: pointer.x + routeLabelDragState.labelOffset.x,
            y: pointer.y + routeLabelDragState.labelOffset.y
          },
          sheet: model.sheet
        })
      );
    },
    [connectionSegments, model.sheet, onConnectionRouteChange]
  );

  const handleRouteLabelPointerDown = useCallback(
    (
      handlePoint: { x: number; y: number },
      event: PointerEvent<SVGCircleElement>
    ) => {
      if (event.button !== 0 || !selectedConnectionSegment) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onFocusCanvas();
      onConnectionSelect(selectedConnectionSegment.connection.id);
      setSelectedRoutePointId(null);
      routeLabelDragStateRef.current = {
        connectionId: selectedConnectionSegment.connection.id,
        pointerId: event.pointerId,
        labelOffset: {
          x: selectedConnectionSegment.labelPoint.x - handlePoint.x,
          y: selectedConnectionSegment.labelPoint.y - handlePoint.y
        }
      };
    },
    [onConnectionSelect, onFocusCanvas, selectedConnectionSegment, setSelectedRoutePointId]
  );

  const endRouteLabelDrag = useCallback(() => {
    routeLabelDragStateRef.current = null;
  }, []);

  return {
    updateDraggedRouteLabel,
    handleRouteLabelPointerDown,
    endRouteLabelDrag
  };
}
