import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingModel } from "../../../data/schema";
import type {
  PlacementTitleDragState,
  PlacementTitleLabel
} from "../types";
import { toSvgPoint } from "../utils/canvasGeometry";

export function usePlacementTitleDrag({
  model,
  placementTitleLabels,
  selectedPlacementTitle,
  onFocusCanvas,
  onSelectPlacement,
  onConnectionSelect,
  onPlacementChange
}: {
  model: DrawingModel;
  placementTitleLabels: PlacementTitleLabel[];
  selectedPlacementTitle: PlacementTitleLabel | null;
  onFocusCanvas: () => void;
  onSelectPlacement: (placementId: string | undefined) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const placementTitleDragStateRef = useRef<PlacementTitleDragState | null>(null);

  const updateDraggedPlacementTitle = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const dragState = placementTitleDragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const label = placementTitleLabels.find(
        (candidate) => candidate.placementId === dragState.placementId
      );

      if (!label) {
        return;
      }

      event.preventDefault();
      const pointer = toSvgPoint(event, model.sheet);
      onPlacementChange(dragState.placementId, {
        labelPosition: {
          x: Number((pointer.x + dragState.labelOffset.x).toFixed(2)),
          y: Number((pointer.y + dragState.labelOffset.y).toFixed(2))
        }
      });
    },
    [model.sheet, onPlacementChange, placementTitleLabels]
  );

  const handlePlacementTitlePointerDown = useCallback(
    (
      handlePoint: { x: number; y: number },
      event: PointerEvent<SVGCircleElement>
    ) => {
      if (event.button !== 0 || !selectedPlacementTitle) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onFocusCanvas();
      onSelectPlacement(selectedPlacementTitle.placementId);
      onConnectionSelect(undefined);
      placementTitleDragStateRef.current = {
        placementId: selectedPlacementTitle.placementId,
        pointerId: event.pointerId,
        labelOffset: {
          x: selectedPlacementTitle.point.x - handlePoint.x,
          y: selectedPlacementTitle.point.y - handlePoint.y
        }
      };
    },
    [
      onConnectionSelect,
      onFocusCanvas,
      onSelectPlacement,
      selectedPlacementTitle
    ]
  );

  const endPlacementTitleDrag = useCallback(() => {
    placementTitleDragStateRef.current = null;
  }, []);

  return {
    updateDraggedPlacementTitle,
    handlePlacementTitlePointerDown,
    endPlacementTitleDrag
  };
}
