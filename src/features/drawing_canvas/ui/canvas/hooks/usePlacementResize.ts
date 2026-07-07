import { useCallback, useRef, type PointerEvent } from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import type { ApprovedDrawingSymbol } from "../../../types";
import type { PlacementResizeState } from "../types";
import {
  calculatePanelEnclosureResizeUpdate,
  calculatePlacementDimensionResizeUpdate,
  calculatePlacementResizeUpdate,
  toSvgPoint
} from "../utils/canvasGeometry";
import {
  isGeneratedPanelEnclosurePlacement,
  resizePanelEnclosure
} from "../../../logic/services/drawing-asset-containment";
import {
  isBackplanePlacement,
  resizeBackplane
} from "../../../logic/services/drawing-backplane-layouts";
import { getRenderableSymbolForPlacement } from "../../../logic/services/drawing-generated-symbols";

export function usePlacementResize({
  model,
  symbols,
  onPlacementChange
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
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

      if (isGeneratedPanelEnclosurePlacement(placement)) {
        onPlacementChange(
          resizeState.placementId,
          resizePanelEnclosure(
            placement,
            calculatePanelEnclosureResizeUpdate(
              resizeState,
              toSvgPoint(event, model.sheet)
            )
          )
        );
        return;
      }

      const symbol = getRenderableSymbolForPlacement(placement, symbols);

      if (!placement || !symbol) {
        return;
      }

      if (placement.layoutDimensions) {
        const dimensionUpdate = calculatePlacementDimensionResizeUpdate(
          resizeState,
          toSvgPoint(event, model.sheet)
        );

        onPlacementChange(
          resizeState.placementId,
          isBackplanePlacement(placement)
            ? resizeBackplane(model, placement, {
                x: dimensionUpdate.x,
                y: dimensionUpdate.y,
                width: dimensionUpdate.layoutDimensions.lengthMm,
                height: dimensionUpdate.layoutDimensions.widthMm
              })
            : dimensionUpdate
        );
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
    [model, onPlacementChange, symbols]
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
