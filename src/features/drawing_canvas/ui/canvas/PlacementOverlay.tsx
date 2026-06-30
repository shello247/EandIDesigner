import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent
} from "react";
import type { DrawingModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getPlacementBounds } from "../../logic/services/drawing-geometry";
import type {
  DragState,
  PlacementResizeState,
  ResizeHandle
} from "./types";
import { packageKey, snap, toSvgPoint } from "./utils/canvasGeometry";

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
}): PlacementHandle[] {
  return [
    {
      key: "nw",
      x: bounds.x,
      y: bounds.y,
      cursor: "nwse-resize",
      fixedPoint: {
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height
      }
    },
    {
      key: "ne",
      x: bounds.x + bounds.width,
      y: bounds.y,
      cursor: "nesw-resize",
      fixedPoint: {
        x: bounds.x,
        y: bounds.y + bounds.height
      }
    },
    {
      key: "sw",
      x: bounds.x,
      y: bounds.y + bounds.height,
      cursor: "nesw-resize",
      fixedPoint: {
        x: bounds.x + bounds.width,
        y: bounds.y
      }
    },
    {
      key: "se",
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
      cursor: "nwse-resize",
      fixedPoint: {
        x: bounds.x,
        y: bounds.y
      }
    }
  ];
}

export function PlacementOverlay({
  model,
  symbolsByKey,
  selectedPlacementId,
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
  onResizeEnd
}: {
  model: DrawingModel;
  symbolsByKey: ReadonlyMap<string, ApprovedDrawingSymbol>;
  selectedPlacementId?: string;
  connectionMode: "idle" | "connecting";
  viewportZoom: number;
  dragState: DragState | null;
  onFocusCanvas: () => void;
  onSelectPlacement: (placementId: string | undefined) => void;
  onConnectionSelect: (connectionId: string | undefined) => void;
  onDragStart: (state: DragState) => void;
  onDragMove: (placementId: string, x: number, y: number) => void;
  onDragEnd: () => void;
  onPlacementRemove: (placementId: string) => void;
  onResizeStart: (state: PlacementResizeState) => void;
  onResizeMove: (event: PointerEvent<SVGRectElement>) => void;
  onResizeEnd: () => void;
}) {
  return (
    <>
      {model.placements.map((placement) => {
        const symbol = symbolsByKey.get(
          packageKey(placement.symbolId, placement.versionId)
        );

        if (!symbol) {
          return null;
        }

        const bounds = getPlacementBounds(placement, symbol.metadata);
        const isSelected = selectedPlacementId === placement.id;
        const handleSize = Math.max(3, Math.min(6, 5 / viewportZoom));
        const handles = getPlacementHandles(bounds);

        return (
          <g key={placement.id}>
            <rect
              data-placement-id={placement.id}
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
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
                onSelectPlacement(placement.id);
                onConnectionSelect(undefined);
                onDragStart({
                  placementId: placement.id,
                  startPointer: pointer,
                  startPlacement: { x: placement.x, y: placement.y }
                });
              }}
              onMouseDown={(event: MouseEvent<SVGRectElement>) => {
                if (event.button !== 0 || connectionMode === "connecting") {
                  return;
                }

                onFocusCanvas();
                onSelectPlacement(placement.id);
                onConnectionSelect(undefined);
              }}
              onPointerMove={(event) => {
                if (!dragState || dragState.placementId !== placement.id) {
                  return;
                }

                const pointer = toSvgPoint(event, model.sheet);
                onDragMove(
                  placement.id,
                  snap(
                    dragState.startPlacement.x +
                      pointer.x -
                      dragState.startPointer.x,
                    model.sheet.gridSize
                  ),
                  snap(
                    dragState.startPlacement.y +
                      pointer.y -
                      dragState.startPointer.y,
                    model.sheet.gridSize
                  )
                );
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
