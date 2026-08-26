import { useEffect, useRef, type PointerEvent } from "react";
import type {
  DrawingAnnotation,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import {
  clampConnectedWireScheduleWidth,
  createConnectedWireScheduleLayout,
  isConnectedWireScheduleAnnotation,
  resizeConnectedWireScheduleColumns,
  type ConnectedWireScheduleColumnRatios,
  type ConnectedWireScheduleConfig,
  type ConnectedWireScheduleProjection
} from "@/features/drawing_connected_wire_schedule/api/public";
import { toSvgPoint } from "./utils/canvasGeometry";

type MoveState = {
  pointerId: number;
  target: SVGRectElement;
  annotationId: string;
  startPointer: { x: number; y: number };
  start: { x: number; y: number };
};

type ResizeState = {
  pointerId: number;
  target: SVGRectElement;
  annotationId: string;
  startPointerX: number;
  startWidth: number;
};

type ColumnResizeState = {
  pointerId: number;
  target: SVGRectElement;
  annotationId: string;
  dividerIndex: number;
  startPointerX: number;
  startWidth: number;
  startRatios: ConnectedWireScheduleColumnRatios;
  startSchedule: ConnectedWireScheduleConfig;
};

export function ConnectedWireScheduleOverlay({
  model,
  projections,
  selectedAnnotationId,
  viewportZoom,
  onFocusCanvas,
  onAnnotationSelect,
  onAnnotationChange,
  onGestureStart,
  onGestureEnd,
  onGestureCancel
}: {
  model: DrawingModel;
  projections: ReadonlyMap<string, ConnectedWireScheduleProjection>;
  selectedAnnotationId?: string;
  viewportZoom: number;
  onFocusCanvas: () => void;
  onAnnotationSelect: (annotationId: string | undefined) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onGestureCancel: () => void;
}) {
  const moveStateRef = useRef<MoveState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const columnResizeStateRef = useRef<ColumnResizeState | null>(null);
  const schedules = model.annotations.filter(isConnectedWireScheduleAnnotation);

  const startMove = (
    annotation: (typeof schedules)[number],
    event: PointerEvent<SVGRectElement>
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusCanvas();
    onAnnotationSelect(annotation.id);
    onGestureStart();
    moveStateRef.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      annotationId: annotation.id,
      startPointer: toSvgPoint(event, model.sheet),
      start: { x: annotation.x, y: annotation.y }
    };
  };

  const updateMove = (event: PointerEvent<SVGRectElement>) => {
    const state = moveStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const annotation = schedules.find(
      (candidate) => candidate.id === state.annotationId
    );
    const projection = annotation ? projections.get(annotation.id) : undefined;
    if (!annotation || !projection) return;
    const pointer = toSvgPoint(event, model.sheet);
    const layout = createConnectedWireScheduleLayout({
      annotation,
      projection,
      sheet: model.sheet
    });
    const x = Math.max(
      0,
      Math.min(model.sheet.width - layout.width, state.start.x + pointer.x - state.startPointer.x)
    );
    const y = Math.max(
      0,
      Math.min(
        Math.max(0, model.sheet.height - layout.height),
        state.start.y + pointer.y - state.startPointer.y
      )
    );
    onAnnotationChange(annotation.id, {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2))
    });
  };

  const endMove = () => {
    if (!moveStateRef.current) return;
    moveStateRef.current = null;
    onGestureEnd();
  };
  const cancelMove = () => {
    if (!moveStateRef.current) return;
    moveStateRef.current = null;
    onGestureCancel();
  };

  const startResize = (
    annotation: (typeof schedules)[number],
    event: PointerEvent<SVGRectElement>
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusCanvas();
    onAnnotationSelect(annotation.id);
    onGestureStart();
    resizeStateRef.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      annotationId: annotation.id,
      startPointerX: toSvgPoint(event, model.sheet).x,
      startWidth: annotation.width
    };
  };

  const updateResize = (event: PointerEvent<SVGRectElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointerX = toSvgPoint(event, model.sheet).x;
    onAnnotationChange(state.annotationId, {
      width: clampConnectedWireScheduleWidth(
        state.startWidth + pointerX - state.startPointerX,
        model.sheet.width
      )
    });
  };

  const endResize = () => {
    if (!resizeStateRef.current) return;
    resizeStateRef.current = null;
    onGestureEnd();
  };
  const cancelResize = () => {
    if (!resizeStateRef.current) return;
    resizeStateRef.current = null;
    onGestureCancel();
  };

  const startColumnResize = (
    annotation: (typeof schedules)[number],
    layout: ReturnType<typeof createConnectedWireScheduleLayout>,
    dividerIndex: number,
    event: PointerEvent<SVGRectElement>
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusCanvas();
    onAnnotationSelect(annotation.id);
    onGestureStart();
    columnResizeStateRef.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      annotationId: annotation.id,
      dividerIndex,
      startPointerX: toSvgPoint(event, model.sheet).x,
      startWidth: layout.width,
      startRatios: layout.columnRatios,
      startSchedule: annotation.schedule
    };
  };

  const updateColumnResize = (event: PointerEvent<SVGRectElement>) => {
    const state = columnResizeStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointerX = toSvgPoint(event, model.sheet).x;
    onAnnotationChange(state.annotationId, {
      schedule: {
        ...state.startSchedule,
        columnRatios: resizeConnectedWireScheduleColumns({
          ratios: state.startRatios,
          dividerIndex: state.dividerIndex,
          delta: pointerX - state.startPointerX,
          tableWidth: state.startWidth
        })
      }
    });
  };

  const endColumnResize = () => {
    if (!columnResizeStateRef.current) return;
    columnResizeStateRef.current = null;
    onGestureEnd();
  };

  const cancelColumnResize = () => {
    if (!columnResizeStateRef.current) return;
    columnResizeStateRef.current = null;
    onGestureCancel();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active =
        moveStateRef.current ??
        resizeStateRef.current ??
        columnResizeStateRef.current;
      if (!active) return;
      event.preventDefault();
      if (active.target.hasPointerCapture(active.pointerId)) {
        active.target.releasePointerCapture(active.pointerId);
      }
      if (moveStateRef.current) cancelMove();
      if (resizeStateRef.current) cancelResize();
      if (columnResizeStateRef.current) cancelColumnResize();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <g data-testid="connected-wire-schedule-overlay">
      {schedules.map((annotation) => {
        const projection = projections.get(annotation.id);
        if (!projection) return null;
        const layout = createConnectedWireScheduleLayout({
          annotation,
          projection,
          sheet: model.sheet
        });
        const selected = selectedAnnotationId === annotation.id;
        const handleWidth = Math.max(1.6, 4 / viewportZoom);
        const dividerHitWidth = Math.max(2.4, 8 / viewportZoom);
        return (
          <g key={annotation.id}>
            <rect
              data-testid="connected-wire-schedule-hit"
              data-annotation-id={annotation.id}
              x={annotation.x}
              y={annotation.y}
              width={layout.width}
              height={layout.height}
              fill="transparent"
              stroke={selected ? "#8b5cf6" : "transparent"}
              strokeWidth={selected ? 0.5 / viewportZoom : 0}
              className="cursor-move"
              onPointerDown={(event) => startMove(annotation, event)}
              onPointerMove={updateMove}
              onPointerUp={endMove}
              onPointerCancel={cancelMove}
              onLostPointerCapture={cancelMove}
            />
            {selected ? (
              <g data-testid="connected-wire-schedule-column-handles">
                {layout.columns.slice(0, -1).map((column, dividerIndex) => {
                  const dividerX =
                    annotation.x + column.x + column.width;
                  return (
                    <g key={column.key}>
                      <line
                        x1={dividerX}
                        y1={annotation.y + layout.titleHeight}
                        x2={dividerX}
                        y2={annotation.y + layout.height}
                        stroke="#0891b2"
                        strokeWidth={0.65 / viewportZoom}
                        strokeOpacity={0.58}
                        pointerEvents="none"
                      />
                      <rect
                        data-testid="connected-wire-schedule-column-resize-handle"
                        data-column-key={column.key}
                        data-divider-index={dividerIndex}
                        x={dividerX - dividerHitWidth / 2}
                        y={annotation.y + layout.titleHeight}
                        width={dividerHitWidth}
                        height={layout.height - layout.titleHeight}
                        fill="#22d3ee"
                        fillOpacity={0.06}
                        className="cursor-ew-resize"
                        onPointerDown={(event) =>
                          startColumnResize(
                            annotation,
                            layout,
                            dividerIndex,
                            event
                          )
                        }
                        onPointerMove={updateColumnResize}
                        onPointerUp={endColumnResize}
                        onPointerCancel={cancelColumnResize}
                        onLostPointerCapture={cancelColumnResize}
                      >
                        <title>
                          Drag to resize {column.label} and the next column
                        </title>
                      </rect>
                    </g>
                  );
                })}
              </g>
            ) : null}
            {selected ? (
              <rect
                data-testid="connected-wire-schedule-resize-handle"
                x={annotation.x + layout.width - handleWidth / 2}
                y={annotation.y}
                width={handleWidth}
                height={layout.height}
                rx={handleWidth / 2}
                fill="#22d3ee"
                fillOpacity={0.28}
                stroke="#0891b2"
                strokeWidth={0.45 / viewportZoom}
                className="cursor-ew-resize"
                onPointerDown={(event) => startResize(annotation, event)}
                onPointerMove={updateResize}
                onPointerUp={endResize}
                onPointerCancel={cancelResize}
                onLostPointerCapture={cancelResize}
              >
                <title>Drag to resize schedule width</title>
              </rect>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
