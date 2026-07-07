import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent
} from "react";
import type { DrawingSheetCanvasModel as DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getPlacementBounds } from "../../logic/services/drawing-geometry";
import {
  getPanelEnclosureBounds,
  getPanelEnclosureTitle,
  isGeneratedPanelEnclosurePlacement
} from "../../logic/services/drawing-asset-containment";
import { isBackplanePlacement } from "../../logic/services/drawing-backplane-layouts";
import { getRenderableSymbolForPlacement } from "../../logic/services/drawing-generated-symbols";
import type { DrawingCanvasSelection } from "../../logic/services/drawing-selection";
import type {
  DragState,
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
  dragState,
  onFocusCanvas,
  onSelectPlacement,
  onConnectionSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPlacementRemove,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onRotationStart,
  onRotationMove,
  onRotationEnd
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  selectedPlacementId?: string;
  selectedPlacementIds: ReadonlySet<string>;
  connectionMode: "idle" | "connecting";
  viewportZoom: number;
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
  }) => void;
  onDragEnd: () => void;
  onPlacementRemove: (placementId: string) => void;
  onResizeStart: (state: PlacementResizeState) => void;
  onResizeMove: (event: PointerEvent<SVGRectElement>) => void;
  onResizeEnd: () => void;
  onRotationStart: (state: PlacementRotationState) => void;
  onRotationMove: (event: PointerEvent<SVGElement>) => void;
  onRotationEnd: () => void;
}) {
  const panelPlacements = model.placements.filter(
    isGeneratedPanelEnclosurePlacement
  );
  const normalPlacements = model.placements.filter(
    (placement) => !isGeneratedPanelEnclosurePlacement(placement)
  );

  return (
    <>
      {panelPlacements.map((placement) => {
        const bounds = getPanelEnclosureBounds(placement);
        const isSelected =
          selectedPlacementId === placement.id ||
          selectedPlacementIds.has(placement.id);
        const handleSize = Math.max(3, Math.min(6, 5 / viewportZoom));
        const headerHeight = panelHeaderHeight(bounds);
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
            model.sheet.gridSize
          );
          const nextPrimaryY = snap(
            dragState.startPlacement.y + pointer.y - dragState.startPointer.y,
            model.sheet.gridSize
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
            baseModel: dragState.startModel
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
              onPointerCancel={onDragEnd}
            >
              <title>{placement.tag} {getPanelEnclosureTitle(placement)}</title>
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
                onPointerCancel={onDragEnd}
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
                        }
                      });
                    }}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeEnd}
                    onPointerCancel={onResizeEnd}
                  >
                    <title>Resize panel enclosure</title>
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

        const bounds = getPlacementBounds(placement, symbol.metadata);
        const isSelected =
          selectedPlacementId === placement.id ||
          selectedPlacementIds.has(placement.id);
        const handleSize = Math.max(3, Math.min(6, 5 / viewportZoom));
        const rotation = normalizeRotation(placement.rotation);
        const canRotate = !isBackplanePlacement(placement);
        const handles = getPlacementHandles(bounds, rotation);
        const rotationControl = getRotationControl(
          bounds,
          rotation,
          viewportZoom
        );
        const rotationLabel = formatRotation(rotation);

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
                isSelected ? "stroke-sky-600" : "stroke-transparent"
              ].join(" ")}
              pointerEvents="all"
              strokeDasharray={isSelected ? "3 2" : undefined}
              strokeWidth={isSelected ? 1 : 0}
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
                  model.sheet.gridSize
                );
                const nextPrimaryY = snap(
                  dragState.startPlacement.y +
                    pointer.y -
                    dragState.startPointer.y,
                  model.sheet.gridSize
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
                  baseModel: dragState.startModel
                });
              }}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            />
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
                    onPointerCancel={onResizeEnd}
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
                      onPointerCancel={onRotationEnd}
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
