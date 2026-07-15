import { useRef, type PointerEvent } from "react";
import type {
  DrawingAnnotation,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import {
  clampAnnotationPosition,
  clampPointToSheet,
  getAnnotationSize
} from "../../logic/services/drawing-annotations";
import type { AnnotationDragState, AnnotationLeaderDragState } from "./types";
import { toSvgPoint } from "./utils/canvasGeometry";

const TARGET_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23a78bfa' stroke='%236d28d9' stroke-width='2'/%3E%3Cpath d='M12 5v14M5 12h14M9 8l3-3 3 3M9 16l3 3 3-3M8 9l-3 3 3 3M16 9l3 3-3 3' stroke='%231f2937' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 12 12, move";

function visibleNoteAnnotations(model: DrawingModel): DrawingAnnotation[] {
  return model.annotations.filter((annotation) => annotation.kind !== "title");
}

export function NoteBlockOverlay({
  model,
  selectedAnnotationId,
  selectedAnnotationIds,
  selectedAnnotationLeaderId,
  viewportZoom,
  onFocusCanvas,
  onAnnotationSelect,
  onAnnotationLeaderSelect,
  onAnnotationChange,
  onAnnotationGroupChange,
  onGestureStart,
  onGestureEnd,
  onGestureCancel
}: {
  model: DrawingModel;
  selectedAnnotationId?: string;
  selectedAnnotationIds: ReadonlySet<string>;
  selectedAnnotationLeaderId?: string | null;
  viewportZoom: number;
  onFocusCanvas: () => void;
  onAnnotationSelect: (
    annotationId: string | undefined,
    options?: { additive?: boolean }
  ) => void;
  onAnnotationLeaderSelect: (annotationId: string | null) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
  onAnnotationGroupChange: (
    updates: Array<{
      annotationId: string;
      updates: Partial<DrawingAnnotation>;
    }>
  ) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onGestureCancel: () => void;
}) {
  const dragStateRef = useRef<AnnotationDragState | null>(null);
  const leaderDragStateRef = useRef<AnnotationLeaderDragState | null>(null);

  const startDrag = (
    annotation: DrawingAnnotation,
    event: PointerEvent<SVGRectElement>
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusCanvas();
    onAnnotationSelect(annotation.id, {
      additive: event.ctrlKey || event.metaKey || event.shiftKey
    });
    onAnnotationLeaderSelect(null);
    onGestureStart();
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const annotationIds =
      selectedAnnotationIds.has(annotation.id) && !additive
        ? [...selectedAnnotationIds]
        : [annotation.id];
    dragStateRef.current = {
      annotationId: annotation.id,
      annotationIds,
      pointerId: event.pointerId,
      startPointer: toSvgPoint(event, model.sheet),
      startAnnotation: { x: annotation.x, y: annotation.y },
      startAnnotations: Object.fromEntries(
        model.annotations
          .filter((candidate) => annotationIds.includes(candidate.id))
          .map((candidate) => [
            candidate.id,
            { x: candidate.x, y: candidate.y }
          ])
      )
    };
  };

  const updateDrag = (event: PointerEvent<SVGRectElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const annotation = model.annotations.find(
      (candidate) => candidate.id === dragState.annotationId
    );

    if (!annotation) {
      return;
    }

    event.preventDefault();
    const pointer = toSvgPoint(event, model.sheet);
    const delta = {
      x: pointer.x - dragState.startPointer.x,
      y: pointer.y - dragState.startPointer.y
    };

    onAnnotationGroupChange(
      dragState.annotationIds.flatMap((annotationId) => {
        const currentAnnotation = model.annotations.find(
          (candidate) => candidate.id === annotationId
        );

        if (!currentAnnotation) {
          return [];
        }

        const startPosition = dragState.startAnnotations[annotationId];

        if (!startPosition) {
          return [];
        }

        return [
          {
            annotationId,
            updates: clampAnnotationPosition(
              currentAnnotation,
              {
                x: startPosition.x + delta.x,
                y: startPosition.y + delta.y
              },
              model.sheet
            )
          }
        ];
      })
    );
  };

  const endDrag = () => {
    dragStateRef.current = null;
    onGestureEnd();
  };

  const cancelDrag = () => {
    dragStateRef.current = null;
    onGestureCancel();
  };

  const startLeaderDrag = (
    annotation: DrawingAnnotation,
    event: PointerEvent<SVGCircleElement>
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusCanvas();
    onAnnotationSelect(annotation.id);
    onAnnotationLeaderSelect(annotation.id);
    onGestureStart();
    leaderDragStateRef.current = {
      annotationId: annotation.id,
      pointerId: event.pointerId
    };
  };

  const updateLeaderDrag = (event: PointerEvent<SVGCircleElement>) => {
    const dragState = leaderDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const annotation = model.annotations.find(
      (candidate) => candidate.id === dragState.annotationId
    );

    if (!annotation?.leader) {
      return;
    }

    event.preventDefault();
    const target = clampPointToSheet(toSvgPoint(event, model.sheet), model.sheet);
    onAnnotationChange(annotation.id, {
      leader: {
        ...annotation.leader,
        targetX: target.x,
        targetY: target.y
      }
    });
  };

  const endLeaderDrag = () => {
    leaderDragStateRef.current = null;
    onGestureEnd();
  };

  const cancelLeaderDrag = () => {
    leaderDragStateRef.current = null;
    onGestureCancel();
  };

  return (
    <g data-testid="canvas-note-overlay">
      {visibleNoteAnnotations(model).map((annotation) => {
        const isSelected =
          selectedAnnotationId === annotation.id ||
          selectedAnnotationIds.has(annotation.id);
        const isLeaderSelected = selectedAnnotationLeaderId === annotation.id;
        const size = getAnnotationSize(annotation);
        const handleRadius = Math.max(1.5, Math.min(3, 2.4 / viewportZoom));

        return (
          <g key={annotation.id}>
            <rect
              data-testid="canvas-note-hit"
              data-annotation-id={annotation.id}
              x={annotation.x}
              y={annotation.y}
              width={size.width}
              height={size.height}
              rx={1.2}
              className={[
                "cursor-move fill-transparent",
                isSelected ? "stroke-violet-400" : "stroke-transparent"
              ].join(" ")}
              strokeWidth={isSelected ? 0.45 / viewportZoom : 0}
              onPointerDown={(event) => startDrag(annotation, event)}
              onPointerMove={updateDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAnnotationSelect(annotation.id, {
                  additive: event.ctrlKey || event.metaKey || event.shiftKey
                });
                onAnnotationLeaderSelect(null);
              }}
            />
            {isSelected && annotation.leader?.enabled ? (
              <circle
                data-testid="canvas-note-leader-target"
                cx={annotation.leader.targetX}
                cy={annotation.leader.targetY}
                r={handleRadius}
                className={[
                  "fill-violet-300",
                  isLeaderSelected ? "stroke-violet-950" : "stroke-violet-700"
                ].join(" ")}
                style={{ cursor: TARGET_CURSOR }}
                strokeWidth={0.55 / viewportZoom}
                onPointerDown={(event) => startLeaderDrag(annotation, event)}
                onPointerMove={updateLeaderDrag}
                onPointerUp={endLeaderDrag}
                onPointerCancel={cancelLeaderDrag}
              >
                <title>Drag note leader target</title>
              </circle>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
