import { useCallback, type KeyboardEvent } from "react";
import type { DrawingCanvasSelection } from "../../../logic/services/drawing-selection";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

export function useCanvasKeyboardShortcuts({
  connectionMode,
  selection,
  canDeleteSelectedRoutePoint,
  onConnectionCancel,
  onClearSelection,
  onCopySelection,
  onDeleteSelectedRoutePoint,
  onDeleteSelection,
  onNudgeSelected,
  onPasteSelection,
  onRedo,
  onUndo
}: {
  connectionMode: "idle" | "connecting";
  selection: DrawingCanvasSelection;
  canDeleteSelectedRoutePoint: boolean;
  onConnectionCancel: () => void;
  onClearSelection: () => void;
  onCopySelection: () => void;
  onDeleteSelectedRoutePoint: () => void;
  onDeleteSelection: () => void;
  onNudgeSelected: (direction: "up" | "down" | "left" | "right") => void;
  onPasteSelection: () => void;
  onRedo: () => void;
  onUndo: () => void;
}) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const isControlKey = event.ctrlKey || event.metaKey;

      if (isControlKey) {
        const key = event.key.toLowerCase();

        if (key === "c") {
          event.preventDefault();
          onCopySelection();
          return;
        }

        if (key === "v") {
          event.preventDefault();
          onPasteSelection();
          return;
        }

        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            onRedo();
          } else {
            onUndo();
          }
          return;
        }

        if (key === "y") {
          event.preventDefault();
          onRedo();
          return;
        }
      }

      const arrowDirection = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right"
      }[event.key] as "up" | "down" | "left" | "right" | undefined;

      if (arrowDirection) {
        event.preventDefault();
        onNudgeSelected(arrowDirection);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (connectionMode === "connecting") {
          onConnectionCancel();
          return;
        }

        onClearSelection();
        return;
      }

      if (
        canDeleteSelectedRoutePoint &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        onDeleteSelectedRoutePoint();
        return;
      }

      if (
        (selection.placementIds.length > 0 || selection.annotationIds.length > 0) &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        onDeleteSelection();
      }
    },
    [
      canDeleteSelectedRoutePoint,
      connectionMode,
      onClearSelection,
      onConnectionCancel,
      onCopySelection,
      onDeleteSelectedRoutePoint,
      onDeleteSelection,
      onNudgeSelected,
      onPasteSelection,
      onRedo,
      onUndo,
      selection.annotationIds.length,
      selection.placementIds.length
    ]
  );
}
