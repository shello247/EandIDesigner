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
  hasSelectedConnection,
  guidedConnectionDraftActive,
  hasGuidedConnectionWaypoints,
  onConnectionCancel,
  onGestureCancel,
  onClearSelection,
  onCopySelection,
  onDeleteSelectedRoutePoint,
  onDeleteSelectedConnection,
  onRemoveLastConnectionWaypoint,
  onDeleteSelection,
  onNudgeSelected,
  onPasteSelection,
  onRedo,
  onUndo
}: {
  connectionMode: "idle" | "connecting";
  selection: DrawingCanvasSelection;
  canDeleteSelectedRoutePoint: boolean;
  hasSelectedConnection: boolean;
  guidedConnectionDraftActive: boolean;
  hasGuidedConnectionWaypoints: boolean;
  onConnectionCancel: () => void;
  onGestureCancel: () => void;
  onClearSelection: () => void;
  onCopySelection: () => void;
  onDeleteSelectedRoutePoint: () => void;
  onDeleteSelectedConnection: () => void;
  onRemoveLastConnectionWaypoint: () => void;
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
        onGestureCancel();
        if (connectionMode === "connecting") {
          onConnectionCancel();
          return;
        }

        onClearSelection();
        return;
      }

      if (
        connectionMode === "connecting" &&
        guidedConnectionDraftActive &&
        event.key === "Backspace"
      ) {
        event.preventDefault();
        if (hasGuidedConnectionWaypoints) {
          onRemoveLastConnectionWaypoint();
        }
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
        hasSelectedConnection &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        onDeleteSelectedConnection();
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
      guidedConnectionDraftActive,
      hasGuidedConnectionWaypoints,
      hasSelectedConnection,
      onClearSelection,
      onConnectionCancel,
      onGestureCancel,
      onCopySelection,
      onDeleteSelectedRoutePoint,
      onDeleteSelectedConnection,
      onDeleteSelection,
      onNudgeSelected,
      onPasteSelection,
      onRedo,
      onRemoveLastConnectionWaypoint,
      onUndo,
      selection.annotationIds.length,
      selection.placementIds.length
    ]
  );
}
