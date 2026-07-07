import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import type { PlacementRotationState } from "../types";
import {
  calculatePlacementRotationUpdate,
  toSvgPoint
} from "../utils/canvasGeometry";

export function usePlacementRotation({
  model,
  onPlacementChange
}: {
  model: DrawingModel;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const rotationStateRef = useRef<PlacementRotationState | null>(null);

  const handlePlacementRotationStart = useCallback(
    (state: PlacementRotationState) => {
      rotationStateRef.current = state;
    },
    []
  );

  const updatePlacementFromRotation = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const rotationState = rotationStateRef.current;

      if (!rotationState) {
        return;
      }

      onPlacementChange(
        rotationState.placementId,
        calculatePlacementRotationUpdate(
          rotationState,
          toSvgPoint(event, model.sheet)
        )
      );
    },
    [model.sheet, onPlacementChange]
  );

  const endPlacementRotation = useCallback(() => {
    rotationStateRef.current = null;
  }, []);

  return {
    handlePlacementRotationStart,
    updatePlacementFromRotation,
    endPlacementRotation
  };
}
