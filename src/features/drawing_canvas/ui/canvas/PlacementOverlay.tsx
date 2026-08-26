import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent
} from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { NOTE_NUDGE_STEP } from "../../logic/services/drawing-annotations";
import { getPlacementBounds } from "../../logic/services/drawing-geometry";
import {
  getPanelEnclosureDisplayBounds,
  getPanelEnclosureTitle,
  isGeneratedPanelEnclosurePlacement,
  resolvePanelEnclosureLayoutScale
} from "../../logic/services/drawing-asset-containment";
import {
  getPanelConnectionViewBounds,
  isPanelConnectionViewPlacement
} from "../../logic/services/drawing-panel-connection-views";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement,
  normalizeLayoutHelperDimensionsForSymbol
} from "../../logic/services/drawing-backplane-layouts";
import {
  getBackplaneDisplayBounds,
  getParentPanelForBackplane,
  resolveBackplaneLayoutScale,
  resolveLayoutHelperDisplayPlacement
} from "../../logic/services/drawing-backplane-scale";
import { getRenderableSymbolForPlacement } from "../../logic/services/drawing-generated-symbols";
import {
  getLayoutDimensionDisplayGeometry,
  isLayoutDimensionPlacement,
  type LayoutDimensionDisplayGeometry
} from "../../logic/services/drawing-layout-dimensions";
import { isDinRailSymbol } from "../../logic/services/drawing-layout-labels";
import { isWireTrayPlacement } from "../../logic/services/drawing-wire-tray-layouts";
import type { DrawingCanvasSelection } from "../../logic/services/drawing-selection";
import type {
  DragState,
  DimensionSnapFeedback,
  PlacementRotationState,
  PlacementResizeState,
  ResizeHandle
} from "./types";
import {
  getRotationAngleFromPointer,
  normalizeRotation,
  rotatePoint,
  snap,
  toSvgPoint
} from "./utils/canvasGeometry";

type PlacementHandle = {
  key: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
  fixedPoint: { x: number; y: number };
};

type PlacementLengthHandle = PlacementHandle & {
  key: "length-start" | "length-end";
  label: "start" | "end";
};

function getPlacementHandles(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}, rotation: number): PlacementHandle[] {
  const center = getPlacementCenter(bounds);
  return [
    {
      key: "nw",
      ...rotatePoint({ x: bounds.x, y: bounds.y }, center, rotation),
      cursor: "nwse-resize",
      fixedPoint: {
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height
      }
    },
    {
      key: "ne",
      ...rotatePoint(
        { x: bounds.x + bounds.width, y: bounds.y },
        center,
        rotation
      ),
      cursor: "nesw-resize",
      fixedPoint: {
        x: bounds.x,
        y: bounds.y + bounds.height
      }
    },
    {
      key: "sw",
      ...rotatePoint(
        { x: bounds.x, y: bounds.y + bounds.height },
        center,
        rotation
      ),
      cursor: "nesw-resize",
      fixedPoint: {
        x: bounds.x + bounds.width,
        y: bounds.y
      }
    },
    {
      key: "se",
      ...rotatePoint(
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        center,
        rotation
      ),
      cursor: "nwse-resize",
      fixedPoint: {
        x: bounds.x,
        y: bounds.y
      }
    }
  ];
}

function getPlacementLengthHandles(
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  rotation: number
): PlacementLengthHandle[] {
  const center = getPlacementCenter(bounds);
  const start = rotatePoint(
    { x: bounds.x, y: center.y },
    center,
    rotation
  );
  const end = rotatePoint(
    { x: bounds.x + bounds.width, y: center.y },
    center,
    rotation
  );
  const axisRadians = (rotation * Math.PI) / 180;
  const cursor =
    Math.abs(Math.cos(axisRadians)) >= Math.abs(Math.sin(axisRadians))
      ? "ew-resize"
      : "ns-resize";

  return [
    {
      key: "length-start",
      label: "start",
      ...start,
      cursor,
      fixedPoint: end
    },
    {
      key: "length-end",
      label: "end",
      ...end,
      cursor,
      fixedPoint: start
    }
  ];
}

function getPlacementCenter(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    x: Number((bounds.x + bounds.width / 2).toFixed(2)),
    y: Number((bounds.y + bounds.height / 2).toFixed(2))
  };
}

function getRotationControl(
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  rotation: number,
  viewportZoom: number
) {
  const center = getPlacementCenter(bounds);
  const offset = Math.max(10, Math.min(18, 14 / viewportZoom));
  const topCenter = rotatePoint(
    { x: center.x, y: bounds.y },
    center,
    rotation
  );
  const handle = rotatePoint(
    { x: center.x, y: bounds.y - offset },
    center,
    rotation
  );

  return {
    center,
    handle,
    label: {
      x: Number((handle.x + Math.max(4, 5 / viewportZoom)).toFixed(2)),
      y: Number((handle.y - Math.max(4, 5 / viewportZoom)).toFixed(2))
    },
    topCenter
  };
}

function formatRotation(rotation: number): string {
  return `${Math.round(normalizeRotation(rotation))}\u00b0`;
}

function getDimensionControlHandles(
  geometry: LayoutDimensionDisplayGeometry
) {
  const offsetCursor =
    geometry.orientation === "horizontal" ? "ns-resize" : "ew-resize";
  const labelCursor =
    geometry.orientation === "horizontal" ? "ew-resize" : "ns-resize";

  return {
    start: {
      ...geometry.startWitness,
      cursor: "move"
    },
    end: {
      ...geometry.endWitness,
      cursor: "move"
    },
    offset: {
      ...geometry.dimensionEnd,
      cursor: offsetCursor
    },
    label: {
      ...geometry.label,
      cursor: labelCursor
    }
  };
}

function panelHeaderHeight(bounds: { height: number }): number {
  return Math.min(12, Math.max(8, bounds.height * 0.12));
}

export function PlacementOverlay({
  model,
  symbols,
  selectedPlacementId,
  selectedPlacementIds,
  connectionMode,
  viewportZoom,
  screenScale,
  dimensionSnapFeedback,
  dragState,
  onFocusCanvas,
  onSelectPlacement,
  onConnectionSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onPlacementRemove,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
  onRotationStart,
  onRotationMove,
  onRotationEnd,
  onRotationCancel
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selectedPlacementId?: string;
  selectedPlacementIds: ReadonlySet<string>;
  connectionMode: "idle" | "connecting";
  viewportZoom: number;
  screenScale: number;
  dimensionSnapFeedback: DimensionSnapFeedback | null;
  dragState: DragState | null;
  onFocusCanvas: () => void;
  onSelectPlacement: (
    placementId: string | undefined,
    options?: { additive?: boolean }
  ) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onDragStart: (state: DragState) => void;
  onDragMove: (input: {
    selection: DrawingCanvasSelection;
    delta: { x: number; y: number };
    baseModel?: DrawingModel;
    bypassGuides?: boolean;
  }) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
  onPlacementRemove: (placementId: string) => void;
  onResizeStart: (state: PlacementResizeState) => void;
  onResizeMove: (event: PointerEvent<SVGElement>) => void;
  onResizeEnd: () => void;
  onResizeCancel: () => void;
  onRotationStart: (state: PlacementRotationState) => void;
  onRotationMove: (event: PointerEvent<SVGElement>) => void;
  onRotationEnd: () => void;
  onRotationCancel: () => void;
}) {
  const panelPlacements = model.placements.filter(
    (placement) =>
      isGeneratedPanelEnclosurePlacement(placement) ||
      isPanelConnectionViewPlacement(placement)
  );
  const backplaneById = new Map(
    model.placements
      .filter(isBackplanePlacement)
      .map((placement) => [placement.id, placement])
  );
  const parentPanelByBackplaneId = new Map(
    [...backplaneById.values()].flatMap((placement) => {
      const parentPanel = getParentPanelForBackplane(
        model.placements,
        placement
      );

      return parentPanel ? [[placement.id, parentPanel] as const] : [];
    })
  );
  const renderPlacementForSheet = (
    placement: DrawingModel["placements"][number],
    symbol: ApprovedDrawingSymbol
  ) => {
    const parentBackplane =
      isLayoutHelperPlacement(placement) && placement.layoutParentId
        ? backplaneById.get(placement.layoutParentId)
        : undefined;
    const normalizedPlacement = normalizeLayoutHelperDimensionsForSymbol(
      placement,
      symbol
    );

    return parentBackplane
      ? resolveLayoutHelperDisplayPlacement({
          sheet: model.sheet,
          placement: normalizedPlacement,
          backplane: parentBackplane,
          parentPanel: parentPanelByBackplaneId.get(parentBackplane.id)
        })
      : normalizedPlacement;
  };
  const normalPlacements = model.placements.filter(
    (placement) =>
      !isGeneratedPanelEnclosurePlacement(placement) &&
      !isPanelConnectionViewPlacement(placement)
  );
  const snapGuideBackplane = dimensionSnapFeedback
    ? backplaneById.get(dimensionSnapFeedback.backplaneId)
    : undefined;
  const snapGuideBounds = snapGuideBackplane
    ? getBackplaneDisplayBounds(
        model.sheet,
        snapGuideBackplane,
        parentPanelByBackplaneId.get(snapGuideBackplane.id)
      )
    : undefined;

  return (
    <>
      {dimensionSnapFeedback && snapGuideBounds ? (
        <g
          data-testid="dimension-snap-guide"
          data-snap-kind={dimensionSnapFeedback.target.kind}
          className="pointer-events-none stroke-cyan-500"
        >
          <line
            x1={dimensionSnapFeedback.guideSheetPoint.x}
            y1={snapGuideBounds.y}
            x2={dimensionSnapFeedback.guideSheetPoint.x}
            y2={snapGuideBounds.y + snapGuideBounds.height}
            strokeWidth={0.8 / screenScale}
            strokeDasharray={`${3 / screenScale} ${3 / screenScale}`}
          />
          <line
            x1={snapGuideBounds.x}
            y1={dimensionSnapFeedback.guideSheetPoint.y}
            x2={snapGuideBounds.x + snapGuideBounds.width}
            y2={dimensionSnapFeedback.guideSheetPoint.y}
            strokeWidth={0.8 / screenScale}
            strokeDasharray={`${3 / screenScale} ${3 / screenScale}`}
          />
          <circle
            cx={dimensionSnapFeedback.guideSheetPoint.x}
            cy={dimensionSnapFeedback.guideSheetPoint.y}
            r={4 / screenScale}
            fill="#ecfeff"
            strokeWidth={1.1 / screenScale}
          >
            <title>{dimensionSnapFeedback.target.label}</title>
          </circle>
        </g>
      ) : null}
      {panelPlacements.map((placement) => {
        const isConnectionView = isPanelConnectionViewPlacement(placement);
        const bounds = isConnectionView
          ? getPanelConnectionViewBounds(placement)
          : getPanelEnclosureDisplayBounds(model.sheet, placement);
        const isSelected =
          selectedPlacementId === placement.id ||
          selectedPlacementIds.has(placement.id);
        const handleSize = Math.max(3, Math.min(6, 5 / viewportZoom));
        const headerHeight = isConnectionView ? 10 : panelHeaderHeight(bounds);
        const handles = getPlacementHandles(bounds, 0);
        const startPanelDrag = (event: PointerEvent<SVGRectElement>) => {
          if (event.button !== 0 || connectionMode === "connecting") {
            return;
          }

          const pointer = toSvgPoint(event, model.sheet);
          event.currentTarget.setPointerCapture(event.pointerId);
          onFocusCanvas();
          const additive = event.ctrlKey || event.metaKey || event.shiftKey;
          const selectedGroupIds =
            selectedPlacementIds.has(placement.id) && !additive
              ? [...selectedPlacementIds]
              : [placement.id];

          onSelectPlacement(placement.id, { additive });
          onConnectionSelect(undefined);
          onDragStart({
            placementId: placement.id,
            placementIds: selectedGroupIds,
            startPointer: pointer,
            startPlacement: { x: placement.x, y: placement.y },
            startModel: model
          });
        };
        const movePanelDrag = (event: PointerEvent<SVGRectElement>) => {
          if (!dragState || dragState.placementId !== placement.id) {
            return;
          }

          const pointer = toSvgPoint(event, model.sheet);
          const nextPrimaryX = snap(
            dragState.startPlacement.x + pointer.x - dragState.startPointer.x,
            NOTE_NUDGE_STEP
          );
          const nextPrimaryY = snap(
            dragState.startPlacement.y + pointer.y - dragState.startPointer.y,
            NOTE_NUDGE_STEP
          );

          onDragMove({
            selection: {
              placementIds: dragState.placementIds,
              annotationIds: []
            },
            delta: {
              x: Number((nextPrimaryX - dragState.startPlacement.x).toFixed(2)),
              y: Number((nextPrimaryY - dragState.startPlacement.y).toFixed(2))
            },
            baseModel: dragState.startModel,
            bypassGuides: event.altKey
          });
        };

        return (
          <g key={placement.id}>
            {isSelected ? (
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                className="pointer-events-none fill-transparent stroke-sky-600"
                strokeDasharray="3 2"
                strokeWidth={1}
              />
            ) : null}
            <rect
              data-placement-id={placement.id}
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={headerHeight}
              className="cursor-move fill-transparent"
              pointerEvents="all"
              onPointerDown={startPanelDrag}
              onPointerMove={movePanelDrag}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragCancel}
            >
              <title>{placement.tag} {isConnectionView ? placement.title : getPanelEnclosureTitle(placement)}</title>
            </rect>
            {[
              { key: "top", x: bounds.x, y: bounds.y, width: bounds.width, height: 2 },
              { key: "left", x: bounds.x, y: bounds.y, width: 2, height: bounds.height },
              {
                key: "right",
                x: bounds.x + bounds.width - 2,
                y: bounds.y,
                width: 2,
                height: bounds.height
              },
              {
                key: "bottom",
                x: bounds.x,
                y: bounds.y + bounds.height - 2,
                width: bounds.width,
                height: 2
              }
            ].map((zone) => (
              <rect
                key={zone.key}
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                className="cursor-move fill-transparent"
                pointerEvents="all"
                onPointerDown={startPanelDrag}
                onPointerMove={movePanelDrag}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragCancel}
              />
            ))}
            {isSelected ? (
              <g>
                {handles.map((handle) => (
                  <rect
                    key={handle.key}
                    data-resize-handle={handle.key}
                    x={handle.x - handleSize / 2}
                    y={handle.y - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    rx={handleSize * 0.2}
                    className="fill-white stroke-sky-600"
                    strokeWidth={0.8}
                    style={{ cursor: handle.cursor }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      onFocusCanvas();
                      onSelectPlacement(placement.id);
                      onResizeStart({
                        placementId: placement.id,
                        handle: handle.key,
                        fixedPoint: handle.fixedPoint,
                        baseSize: {
                          width: bounds.width,
                          height: bounds.height
                        },
                        physicalScaleFactor: isConnectionView
                          ? undefined
                          : resolvePanelEnclosureLayoutScale(
                              model.sheet,
                              placement
                            ).factor
                      });
                    }}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeEnd}
                    onPointerCancel={onResizeCancel}
                  >
                    <title>{isConnectionView ? "Resize panel connection reference" : "Resize panel enclosure"}</title>
                  </rect>
                ))}
                <g
                  data-testid="canvas-placement-delete"
                  role="button"
                  aria-label={`Delete ${placement.tag}`}
                  tabIndex={0}
                  transform={`translate(${bounds.x + bounds.width + 3} ${bounds.y - 10})`}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }

                    event.stopPropagation();
                    onPlacementRemove(placement.id);
                  }}
                  onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPlacementRemove(placement.id);
                    }
                  }}
                >
                  <rect
                    x="0"
                    y="0"
                    width="16"
                    height="8"
                    rx="2"
                    className="fill-white stroke-red-500"
                    strokeWidth="0.6"
                  />
                  <text
                    x="8"
                    y="5.7"
                    textAnchor="middle"
                    fontSize="5"
                    fontWeight="700"
                    fill="#dc2626"
                  >
                    x
                  </text>
                  <title>Delete panel</title>
                </g>
              </g>
            ) : null}
          </g>
        );
      })}
      {normalPlacements.map((placement) => {
        const symbol = getRenderableSymbolForPlacement(placement, symbols);

        if (!symbol) {
          return null;
        }

        const renderPlacement = renderPlacementForSheet(placement, symbol);
        const isDimension = isLayoutDimensionPlacement(placement);
        const parentBackplane =
          isDimension && placement.layoutParentId
            ? backplaneById.get(placement.layoutParentId)
            : undefined;
        const dimensionGeometry =
          isDimension && parentBackplane
            ? getLayoutDimensionDisplayGeometry({
                model,
                placement,
                backplane: parentBackplane
              })
            : undefined;
        const bounds = dimensionGeometry
          ? dimensionGeometry.bounds
          : isBackplanePlacement(placement)
            ? getBackplaneDisplayBounds(
                model.sheet,
                placement,
                parentPanelByBackplaneId.get(placement.id)
              )
            : getPlacementBounds(renderPlacement, symbol.metadata);
        const isSelected =
          selectedPlacementId === placement.id ||
          selectedPlacementIds.has(placement.id);
        const isLayoutHelper = isLayoutHelperPlacement(placement);
        const handleSize = isLayoutHelper
          ? Math.max(2.2, Math.min(4.2, 3.6 / viewportZoom))
          : Math.max(2.8, Math.min(5, 4.4 / viewportZoom));
        const rotation = normalizeRotation(placement.rotation);
        const canRotate = !isBackplanePlacement(placement) && !isDimension;
        const canResize =
          !isDimension &&
          (!isLayoutHelperPlacement(placement) ||
            symbol.metadata.resizable === true ||
            isBackplanePlacement(placement));
        const handles = canResize ? getPlacementHandles(bounds, rotation) : [];
        const lengthHandles =
          canResize &&
          (isWireTrayPlacement(placement) || isDinRailSymbol(symbol))
            ? getPlacementLengthHandles(bounds, rotation)
            : [];
        const dimensionHandles = dimensionGeometry
          ? getDimensionControlHandles(dimensionGeometry)
          : undefined;
        const rotationControl = getRotationControl(
          bounds,
          rotation,
          viewportZoom
        );
        const rotationLabel = formatRotation(rotation);
        const deleteButtonWidth = isDimension ? 12 / screenScale : 16;
        const deleteButtonHeight = isDimension ? 8 / screenScale : 8;
        const deleteButtonOffsetX = isDimension ? 5 / screenScale : 3;
        const deleteButtonOffsetY = isDimension ? 11 / screenScale : 10;

        return (
          <g key={placement.id}>
            <rect
              data-placement-id={placement.id}
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              transform={
                rotation
                  ? `rotate(${rotation} ${rotationControl.center.x} ${rotationControl.center.y})`
                  : undefined
              }
              className={[
                "cursor-move fill-transparent",
                isSelected && !isDimension
                  ? "stroke-sky-500"
                  : "stroke-transparent"
              ].join(" ")}
              pointerEvents="all"
              strokeDasharray={isSelected && !isDimension ? "2 2.8" : undefined}
              strokeWidth={
                isSelected && !isDimension
                  ? isLayoutHelper
                    ? 0.45
                    : 0.55
                  : 0
              }
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return;
                }

                if (connectionMode === "connecting") {
                  return;
                }

                const pointer = toSvgPoint(event, model.sheet);
                event.currentTarget.setPointerCapture(event.pointerId);
                onFocusCanvas();
                const additive =
                  event.ctrlKey || event.metaKey || event.shiftKey;
                const selectedGroupIds =
                  selectedPlacementIds.has(placement.id) && !additive
                    ? [...selectedPlacementIds]
                    : [placement.id];

                onSelectPlacement(placement.id, { additive });
                onConnectionSelect(undefined);
                onDragStart({
                  placementId: placement.id,
                  placementIds: selectedGroupIds,
                  startPointer: pointer,
                  startPlacement: { x: placement.x, y: placement.y },
                  startModel: model
                });
              }}
              onMouseDown={(event: MouseEvent<SVGRectElement>) => {
                if (event.button !== 0 || connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
              }}
              onPointerMove={(event) => {
                if (!dragState || dragState.placementId !== placement.id) {
                  return;
                }

                const pointer = toSvgPoint(event, model.sheet);
                const nextPrimaryX = snap(
                  dragState.startPlacement.x +
                    pointer.x -
                    dragState.startPointer.x,
                  NOTE_NUDGE_STEP
                );
                const nextPrimaryY = snap(
                  dragState.startPlacement.y +
                    pointer.y -
                    dragState.startPointer.y,
                  NOTE_NUDGE_STEP
                );

                onDragMove({
                  selection: {
                    placementIds: dragState.placementIds,
                    annotationIds: []
                  },
                  delta: {
                    x: Number(
                      (nextPrimaryX - dragState.startPlacement.x).toFixed(2)
                    ),
                    y: Number(
                      (nextPrimaryY - dragState.startPlacement.y).toFixed(2)
                    )
                  },
                  baseModel: dragState.startModel,
                  bypassGuides: event.altKey
                });
              }}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragCancel}
            />
            {isSelected ? (
              <g>
                {dimensionHandles ? (
                  <>
                    <line
                      data-testid="dimension-selection-line"
                      x1={dimensionGeometry?.dimensionStart.x}
                      y1={dimensionGeometry?.dimensionStart.y}
                      x2={dimensionGeometry?.dimensionEnd.x}
                      y2={dimensionGeometry?.dimensionEnd.y}
                      className="pointer-events-none stroke-sky-500"
                      strokeWidth={0.8 / screenScale}
                      opacity={0.64}
                    />
                    {([
                      ["dimension-start", dimensionHandles.start, "Dimension start"],
                      ["dimension-end", dimensionHandles.end, "Dimension end"]
                    ] as const).map(([handleKey, handle, title]) => (
                      <circle
                        key={handleKey}
                        data-dimension-handle={handleKey}
                        cx={handle.x}
                        cy={handle.y}
                        r={3.4 / screenScale}
                        className={
                          dimensionSnapFeedback?.placementId === placement.id &&
                          dimensionSnapFeedback.handle === handleKey
                            ? "fill-cyan-50 stroke-cyan-600"
                            : "fill-white stroke-slate-500"
                        }
                        strokeWidth={1.1 / screenScale}
                        style={{ cursor: handle.cursor }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }

                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          onFocusCanvas();
                          onSelectPlacement(placement.id);
                          onResizeStart({
                            placementId: placement.id,
                            handle: handleKey,
                            fixedPoint: handle,
                            baseSize: {
                              width: bounds.width,
                              height: bounds.height
                            },
                            physicalScaleFactor: isBackplanePlacement(placement)
                              ? resolveBackplaneLayoutScale(
                                  model.sheet,
                                  placement,
                                  parentPanelByBackplaneId.get(placement.id)
                                ).factor
                              : undefined
                          });
                        }}
                        onPointerMove={onResizeMove}
                        onPointerUp={onResizeEnd}
                        onPointerCancel={onResizeCancel}
                      >
                        <title>{title} witness point</title>
                      </circle>
                    ))}
                    <circle
                      data-dimension-handle="dimension-offset"
                      cx={dimensionHandles.offset.x}
                      cy={dimensionHandles.offset.y}
                      r={3.5 / screenScale}
                      className="fill-amber-100 stroke-amber-500"
                      strokeWidth={1.15 / screenScale}
                      style={{ cursor: dimensionHandles.offset.cursor }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }

                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFocusCanvas();
                        onSelectPlacement(placement.id);
                        onResizeStart({
                          placementId: placement.id,
                          handle: "dimension-offset",
                          fixedPoint: dimensionHandles.offset,
                          baseSize: {
                            width: bounds.width,
                            height: bounds.height
                          }
                        });
                      }}
                      onPointerMove={onResizeMove}
                      onPointerUp={onResizeEnd}
                      onPointerCancel={onResizeCancel}
                    >
                      <title>Move dimension line</title>
                    </circle>
                    <circle
                      data-dimension-handle="dimension-label"
                      cx={dimensionHandles.label.x}
                      cy={dimensionHandles.label.y}
                      r={3.2 / screenScale}
                      className="fill-amber-100 stroke-amber-500"
                      strokeWidth={1.05 / screenScale}
                      style={{ cursor: dimensionHandles.label.cursor }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }

                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFocusCanvas();
                        onSelectPlacement(placement.id);
                        onResizeStart({
                          placementId: placement.id,
                          handle: "dimension-label",
                          fixedPoint: dimensionHandles.label,
                          baseSize: {
                            width: bounds.width,
                            height: bounds.height
                          }
                        });
                      }}
                      onPointerMove={onResizeMove}
                      onPointerUp={onResizeEnd}
                      onPointerCancel={onResizeCancel}
                    >
                      <title>Move dimension label</title>
                    </circle>
                  </>
                ) : null}
                {lengthHandles.map((handle) => {
                  const radius = 5 / screenScale;
                  const arrowHalf = 2.8 / screenScale;
                  const arrowWing = 1.2 / screenScale;

                  return (
                    <g key={handle.key}>
                      <circle
                        data-resize-handle={handle.key}
                        data-length-resize-handle={handle.label}
                        aria-label={`Adjust ${placement.tag} length from the ${handle.label}`}
                        cx={handle.x}
                        cy={handle.y}
                        r={radius}
                        className="fill-cyan-50 stroke-cyan-600"
                        strokeWidth={1.1 / screenScale}
                        style={{ cursor: handle.cursor }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }

                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          onFocusCanvas();
                          onSelectPlacement(placement.id);
                          onResizeStart({
                            placementId: placement.id,
                            handle: handle.key,
                            fixedPoint: handle.fixedPoint,
                            center: rotationControl.center,
                            rotation,
                            baseSize: {
                              width: bounds.width,
                              height: bounds.height
                            }
                          });
                        }}
                        onPointerMove={onResizeMove}
                        onPointerUp={onResizeEnd}
                        onPointerCancel={onResizeCancel}
                      >
                        <title>
                          Adjust {placement.tag} length from the {handle.label} (width
                          locked)
                        </title>
                      </circle>
                      <path
                        d={[
                          `M ${handle.x - arrowHalf} ${handle.y}`,
                          `H ${handle.x + arrowHalf}`,
                          `M ${handle.x - arrowHalf} ${handle.y}`,
                          `L ${handle.x - arrowHalf + arrowWing} ${handle.y - arrowWing}`,
                          `M ${handle.x - arrowHalf} ${handle.y}`,
                          `L ${handle.x - arrowHalf + arrowWing} ${handle.y + arrowWing}`,
                          `M ${handle.x + arrowHalf} ${handle.y}`,
                          `L ${handle.x + arrowHalf - arrowWing} ${handle.y - arrowWing}`,
                          `M ${handle.x + arrowHalf} ${handle.y}`,
                          `L ${handle.x + arrowHalf - arrowWing} ${handle.y + arrowWing}`
                        ].join(" ")}
                        transform={`rotate(${rotation} ${handle.x} ${handle.y})`}
                        className="pointer-events-none fill-none stroke-cyan-700"
                        strokeWidth={0.8 / screenScale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}
                {handles.map((handle) => (
                  <rect
                    key={handle.key}
                    data-resize-handle={handle.key}
                    x={handle.x - handleSize / 2}
                    y={handle.y - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    rx={handleSize * 0.25}
                    className="fill-white stroke-sky-500"
                    strokeWidth={isLayoutHelper ? 0.45 : 0.6}
                    style={{ cursor: handle.cursor }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      onFocusCanvas();
                      onSelectPlacement(placement.id);
                      onResizeStart({
                        placementId: placement.id,
                        handle: handle.key,
                        fixedPoint: handle.fixedPoint,
                        center: rotationControl.center,
                        rotation,
                        baseSize: {
                          width: symbol.metadata.viewBox.width,
                          height: symbol.metadata.viewBox.height
                        }
                      });
                    }}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeEnd}
                    onPointerCancel={onResizeCancel}
                  >
                    <title>Resize placement</title>
                  </rect>
                ))}
                {canRotate ? (
                  <>
                    <line
                      x1={rotationControl.topCenter.x}
                      y1={rotationControl.topCenter.y}
                      x2={rotationControl.handle.x}
                      y2={rotationControl.handle.y}
                      className="pointer-events-none stroke-sky-500"
                      strokeDasharray="2 1.5"
                      strokeWidth={0.55}
                    />
                    <g
                      data-testid="canvas-placement-rotation-label"
                      className="pointer-events-none"
                      transform={`translate(${rotationControl.label.x} ${rotationControl.label.y})`}
                    >
                      <rect
                        x="0"
                        y="-7"
                        width="22"
                        height="8.5"
                        rx="2"
                        className="fill-white stroke-sky-200"
                        strokeWidth="0.45"
                      />
                      <text
                        x="11"
                        y="-1.2"
                        textAnchor="middle"
                        fontSize="4"
                        fontWeight="700"
                        fill="#1d4ed8"
                      >
                        {rotationLabel}
                      </text>
                    </g>
                    <circle
                      data-testid="canvas-placement-rotate-handle"
                      data-rotate-handle="true"
                      cx={rotationControl.handle.x}
                      cy={rotationControl.handle.y}
                      r={Math.max(3.4, Math.min(5.5, 4.4 / viewportZoom))}
                      className="fill-white stroke-sky-600"
                      strokeWidth={0.8}
                      style={{ cursor: "grab" }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }

                        const pointer = toSvgPoint(event, model.sheet);
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onFocusCanvas();
                        onSelectPlacement(placement.id);
                        onConnectionSelect(undefined);
                        onRotationStart({
                          placementId: placement.id,
                          center: rotationControl.center,
                          startPointerAngle: getRotationAngleFromPointer(
                            rotationControl.center,
                            pointer
                          ),
                          startRotation: rotation
                        });
                      }}
                      onPointerMove={onRotationMove}
                      onPointerUp={onRotationEnd}
                      onPointerCancel={onRotationCancel}
                    >
                      <title>
                        Rotate placement. Snaps near 0, 90, 180, and 270 degrees.
                      </title>
                    </circle>
                  </>
                ) : null}
                <g
                  data-testid="canvas-placement-delete"
                  role="button"
                  aria-label={`Delete ${placement.tag}`}
                  tabIndex={0}
                  transform={`translate(${bounds.x + bounds.width + deleteButtonOffsetX} ${bounds.y - deleteButtonOffsetY})`}
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }

                    event.stopPropagation();
                    onPlacementRemove(placement.id);
                  }}
                  onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPlacementRemove(placement.id);
                    }
                  }}
                >
                  <rect
                    x="0"
                    y="0"
                    width={deleteButtonWidth}
                    height={deleteButtonHeight}
                    rx={isDimension ? 2 / screenScale : 2}
                    className="fill-white stroke-red-500"
                    strokeWidth={isDimension ? 1 / screenScale : 0.6}
                  />
                  <text
                    x={deleteButtonWidth / 2}
                    y={isDimension ? 5.8 / screenScale : 5.7}
                    textAnchor="middle"
                    fontSize={isDimension ? 6 / screenScale : 5}
                    fontWeight="700"
                    fill="#dc2626"
                  >
                    x
                  </text>
                  <title>Delete placement</title>
                </g>
              </g>
            ) : null}
          </g>
        );
      })}
    </>
  );
}
