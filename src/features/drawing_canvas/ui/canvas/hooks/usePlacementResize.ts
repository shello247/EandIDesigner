import { useCallback, useRef, useState, type PointerEvent } from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../../data/schema";
import type { ApprovedDrawingSymbol } from "../../../types";
import type { PlacementResizeState } from "../types";
import {
  calculatePanelEnclosureResizeUpdate,
  calculatePlacementDimensionResizeUpdate,
  calculatePlacementLengthResizeUpdate,
  calculatePlacementResizeUpdate,
  toSvgPoint
} from "../utils/canvasGeometry";
import {
  isGeneratedPanelEnclosurePlacement,
  resizePanelEnclosure
} from "../../../logic/services/drawing-asset-containment";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement,
  resizeBackplane
} from "../../../logic/services/drawing-backplane-layouts";
import { resizeLayoutHelperFromDisplayBounds } from "../../../logic/services/drawing-backplane-scale";
import { getRenderableSymbolForPlacement } from "../../../logic/services/drawing-generated-symbols";
import {
  isLayoutDimensionPlacement,
  resolveLayoutDimensionPointerUpdate
} from "../../../logic/services/drawing-layout-dimensions";
import {
  buildLayoutDimensionAttachmentTargets,
  resolveDimensionSnapToleranceMm,
  type DimensionAttachmentTarget
} from "../../../logic/services/drawing-dimension-snapping";
import type { DimensionSnapFeedback } from "../types";

export function usePlacementResize({
  model,
  symbols,
  screenScale,
  onPlacementChange
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  screenScale: number;
  onPlacementChange: (
    placementId: string,
    updates: Partial<DrawingModel["placements"][number]>
  ) => void;
}) {
  const resizeStateRef = useRef<PlacementResizeState | null>(null);
  const dimensionSnapContextRef = useRef<{
    backplaneId: string;
    targets: DimensionAttachmentTarget[];
    toleranceMm: number;
  } | null>(null);
  const [dimensionSnapFeedback, setDimensionSnapFeedback] =
    useState<DimensionSnapFeedback | null>(null);

  const handlePlacementResizeStart = useCallback(
    (state: PlacementResizeState) => {
      resizeStateRef.current = state;
      dimensionSnapContextRef.current = null;
      setDimensionSnapFeedback(null);

      if (
        state.handle !== "dimension-start" &&
        state.handle !== "dimension-end"
      ) {
        return;
      }

      const placement = model.placements.find(
        (candidate) => candidate.id === state.placementId
      );
      const backplane = placement?.layoutParentId
        ? model.placements.find(
            (candidate) =>
              candidate.id === placement.layoutParentId &&
              isBackplanePlacement(candidate)
          )
        : undefined;

      if (!placement || !backplane || !isLayoutDimensionPlacement(placement)) {
        return;
      }

      dimensionSnapContextRef.current = {
        backplaneId: backplane.id,
        targets: buildLayoutDimensionAttachmentTargets({
          model,
          backplane,
          excludePlacementId: placement.id
        }),
        toleranceMm: resolveDimensionSnapToleranceMm({
          sheet: model.sheet,
          backplane,
          screenScale
        })
      };
    },
    [model, screenScale]
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

      if (
        isLayoutDimensionPlacement(placement) &&
        (resizeState.handle === "dimension-start" ||
          resizeState.handle === "dimension-end" ||
          resizeState.handle === "dimension-offset" ||
          resizeState.handle === "dimension-label")
      ) {
        const parentBackplane = placement.layoutParentId
          ? model.placements.find(
              (candidate) =>
                candidate.id === placement.layoutParentId &&
                isBackplanePlacement(candidate)
            )
          : undefined;

        if (!parentBackplane) {
          return;
        }

        const snapContext = dimensionSnapContextRef.current;
        const result = resolveLayoutDimensionPointerUpdate({
          sheet: model.sheet,
          placement,
          backplane: parentBackplane,
          handle: resizeState.handle,
          pointer: toSvgPoint(event, model.sheet),
          attachmentTargets:
            snapContext?.backplaneId === parentBackplane.id
              ? snapContext.targets
              : [],
          snapToleranceMm:
            snapContext?.backplaneId === parentBackplane.id
              ? snapContext.toleranceMm
              : 0,
          model
        });

        onPlacementChange(resizeState.placementId, result.placement);

        const nextFeedback =
          result.snapAttachmentTarget &&
          result.guideSheetPoint &&
          (resizeState.handle === "dimension-start" ||
            resizeState.handle === "dimension-end")
            ? {
                placementId: placement.id,
                backplaneId: parentBackplane.id,
                handle: resizeState.handle,
                target: result.snapAttachmentTarget,
                guideSheetPoint: result.guideSheetPoint
              }
            : null;

        setDimensionSnapFeedback((current) => {
          if (
            current?.placementId === nextFeedback?.placementId &&
            current?.handle === nextFeedback?.handle &&
            current?.target.edge === nextFeedback?.target.edge &&
            current?.target.sourcePlacementId ===
              nextFeedback?.target.sourcePlacementId &&
            current?.guideSheetPoint.x === nextFeedback?.guideSheetPoint.x &&
            current?.guideSheetPoint.y === nextFeedback?.guideSheetPoint.y
          ) {
            return current;
          }

          return nextFeedback;
        });
        return;
      }

      if (placement.layoutDimensions) {
        const pointer = toSvgPoint(event, model.sheet);
        const dimensionUpdate =
          resizeState.handle === "length-start" ||
          resizeState.handle === "length-end"
            ? calculatePlacementLengthResizeUpdate(resizeState, pointer)
            : calculatePlacementDimensionResizeUpdate(resizeState, pointer);
        const parentBackplane =
          isLayoutHelperPlacement(placement) && placement.layoutParentId
            ? model.placements.find(
                (candidate) =>
                  candidate.id === placement.layoutParentId &&
                  isBackplanePlacement(candidate)
              )
            : undefined;

        onPlacementChange(
          resizeState.placementId,
          isBackplanePlacement(placement)
            ? resizeBackplane(model, placement, {
                x: dimensionUpdate.x,
                y: dimensionUpdate.y,
                width: dimensionUpdate.layoutDimensions.lengthMm,
                height: dimensionUpdate.layoutDimensions.widthMm
              })
            : parentBackplane
              ? resizeLayoutHelperFromDisplayBounds({
                  sheet: model.sheet,
                  placement,
                  backplane: parentBackplane,
                  bounds: {
                    x: dimensionUpdate.x,
                    y: dimensionUpdate.y,
                    width: dimensionUpdate.layoutDimensions.lengthMm,
                    height: dimensionUpdate.layoutDimensions.widthMm
                  }
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
    dimensionSnapContextRef.current = null;
    setDimensionSnapFeedback(null);
  }, []);

  const clearDimensionSnapFeedback = useCallback(() => {
    dimensionSnapContextRef.current = null;
    setDimensionSnapFeedback(null);
  }, []);

  return {
    handlePlacementResizeStart,
    updatePlacementFromResize,
    endPlacementResize,
    dimensionSnapFeedback,
    clearDimensionSnapFeedback
  };
}
