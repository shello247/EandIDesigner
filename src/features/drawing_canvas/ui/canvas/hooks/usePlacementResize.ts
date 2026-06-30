import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingModel } from "../../../data/schema";
import type { ApprovedDrawingSymbol } from "../../../types";
import type { PlacementResizeState } from "../types";
import {
  calculatePlacementResizeUpdate,
  packageKey,
  toSvgPoint
} from "../utils/canvasGeometry";

export function usePlacementResize({
  model,
  symbolsByKey,
  onPlacementChange
}: {
  model: DrawingModel;
  symbolsByKey: ReadonlyMap<string, ApprovedDrawingSymbol>;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const resizeStateRef = useRef<PlacementResizeState | null>(null);

  const handlePlacementResizeStart = useCallback(
    (state: PlacementResizeState) => {
      resizeStateRef.current = state;
    },
    []
  );

  const updatePlacementFromResize = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      const placement = model.placements.find(
        (candidate) => candidate.id === resizeState.placementId
      );
      const symbol = placement
        ? symbolsByKey.get(packageKey(placement.symbolId, placement.versionId))
        : undefined;

      if (!placement || !symbol) {
        return;
      }

      onPlacementChange(
        resizeState.placementId,
        calculatePlacementResizeUpdate(
          resizeState,
          toSvgPoint(event, model.sheet)
        )
      );
    },
    [model.placements, model.sheet, onPlacementChange, symbolsByKey]
  );

  const endPlacementResize = useCallback(() => {
    resizeStateRef.current = null;
  }, []);

  return {
    handlePlacementResizeStart,
    updatePlacementFromResize,
    endPlacementResize
  };
}
