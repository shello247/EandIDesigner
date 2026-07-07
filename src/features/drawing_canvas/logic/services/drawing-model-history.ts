import type { DrawingModel } from "../../data/schema";
import type { DrawingCanvasSelection } from "./drawing-selection";

export type DrawingModelHistoryEntry = {
  model: DrawingModel;
  activeSheetId: string;
  selection: DrawingCanvasSelection;
};

export type DrawingModelHistoryState = {
  past: DrawingModelHistoryEntry[];
  future: DrawingModelHistoryEntry[];
};

export const DEFAULT_DRAWING_HISTORY_LIMIT = 50;

export function createEmptyDrawingHistory(): DrawingModelHistoryState {
  return {
    past: [],
    future: []
  };
}

export function pushDrawingHistoryEntry(
  history: DrawingModelHistoryState,
  entry: DrawingModelHistoryEntry,
  limit = DEFAULT_DRAWING_HISTORY_LIMIT
): DrawingModelHistoryState {
  return {
    past: [...history.past, entry].slice(-limit),
    future: []
  };
}

export function undoDrawingHistory(
  history: DrawingModelHistoryState,
  current: DrawingModelHistoryEntry
): {
  history: DrawingModelHistoryState;
  entry: DrawingModelHistoryEntry | null;
} {
  const entry = history.past.at(-1) ?? null;

  if (!entry) {
    return { history, entry: null };
  }

  return {
    entry,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future]
    }
  };
}

export function redoDrawingHistory(
  history: DrawingModelHistoryState,
  current: DrawingModelHistoryEntry
): {
  history: DrawingModelHistoryState;
  entry: DrawingModelHistoryEntry | null;
} {
  const entry = history.future[0] ?? null;

  if (!entry) {
    return { history, entry: null };
  }

  return {
    entry,
    history: {
      past: [...history.past, current],
      future: history.future.slice(1)
    }
  };
}
