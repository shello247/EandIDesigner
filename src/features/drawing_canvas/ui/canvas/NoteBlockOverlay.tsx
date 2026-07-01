import { useRef, type PointerEvent } from "react";
import type { DrawingAnnotation, DrawingModel } from "../../data/schema";
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
  selectedAnnotationLeaderId,
  viewportZoom,
  onFocusCanvas,
  onAnnotationSelect,
  onAnnotationLeaderSelect,
  onAnnotationChange
}: {
  model: DrawingModel;
  selectedAnnotationId?: string;
  selectedAnnotationLeaderId?: string | null;
  viewportZoom: number;
  onFocusCanvas: () => void;
  onAnnotationSelect: (annotationId: string | undefined) => void;
  onAnnotationLeaderSelect: (annotationId: string | null) => void;
  onAnnotationChange: (
    annotationId: string,
    updates: Partial<DrawingAnnotation>
  ) => void;
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
    onAnnotationSelect(annotation.id);
    onAnnotationLeaderSelect(null);
    dragStateRef.current = {
      annotationId: annotation.id,
      pointerId: event.pointerId,
      startPointer: toSvgPoint(event, model.sheet),
      startAnnotation: { x: annotation.x, y: annotation.y }
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
    const position = clampAnnotationPosition(
      annotation,
      {
        x: dragState.startAnnotation.x + pointer.x - dragState.startPointer.x,
        y: dragState.startAnnotation.y + pointer.y - dragState.startPointer.y
      },
      model.sheet
    );

    onAnnotationChange(annotation.id, position);
  };

  const endDrag = () => {
    dragStateRef.current = null;
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
  };

  return (
    <g data-testid="canvas-note-overlay">
      {visibleNoteAnnotations(model).map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id;
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
              onPointerCancel={endDrag}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAnnotationSelect(annotation.id);
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
                onPointerCancel={endLeaderDrag}
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
