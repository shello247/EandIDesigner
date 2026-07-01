import type { DrawingAnnotation, DrawingModel } from "../../data/schema";

export const DEFAULT_NOTE_WIDTH = 70;
export const DEFAULT_NOTE_HEIGHT = 24;
export const NOTE_NUDGE_STEP = 1;

export function getAnnotationSize(annotation: DrawingAnnotation): {
  width: number;
  height: number;
} {
  return {
    width: annotation.width ?? DEFAULT_NOTE_WIDTH,
    height: annotation.height ?? DEFAULT_NOTE_HEIGHT
  };
}

export function clampPointToSheet(
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
): { x: number; y: number } {
  return {
    x: Number(Math.max(0, Math.min(sheet.width, point.x)).toFixed(2)),
    y: Number(Math.max(0, Math.min(sheet.height, point.y)).toFixed(2))
  };
}

export function clampAnnotationPosition(
  annotation: DrawingAnnotation,
  point: { x: number; y: number },
  sheet: DrawingModel["sheet"]
): { x: number; y: number } {
  const size = getAnnotationSize(annotation);

  return {
    x: Number(Math.max(0, Math.min(sheet.width - size.width, point.x)).toFixed(2)),
    y: Number(Math.max(0, Math.min(sheet.height - size.height, point.y)).toFixed(2))
  };
}

export function getLeaderStartPoint(annotation: DrawingAnnotation): {
  x: number;
  y: number;
} {
  const size = getAnnotationSize(annotation);
  const target = annotation.leader
    ? { x: annotation.leader.targetX, y: annotation.leader.targetY }
    : { x: annotation.x + size.width + 18, y: annotation.y + size.height / 2 };
  const center = {
    x: annotation.x + size.width / 2,
    y: annotation.y + size.height / 2
  };
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx >= 0 ? annotation.x + size.width : annotation.x,
      y: Number(center.y.toFixed(2))
    };
  }

  return {
    x: Number(center.x.toFixed(2)),
    y: dy >= 0 ? annotation.y + size.height : annotation.y
  };
}

export function createDefaultNoteAnnotation(input: {
  id: string;
  point: { x: number; y: number };
  sheet: DrawingModel["sheet"];
}): DrawingAnnotation {
  const position = clampAnnotationPosition(
    {
      id: input.id,
      title: "Note",
      text: "",
      x: input.point.x,
      y: input.point.y,
      width: DEFAULT_NOTE_WIDTH,
      height: DEFAULT_NOTE_HEIGHT,
      kind: "note"
    },
    input.point,
    input.sheet
  );

  return {
    id: input.id,
    title: "Note",
    text: "",
    x: position.x,
    y: position.y,
    width: DEFAULT_NOTE_WIDTH,
    height: DEFAULT_NOTE_HEIGHT,
    kind: "note"
  };
}
