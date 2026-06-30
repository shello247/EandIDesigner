import { useCallback, type KeyboardEvent } from "react";

export function useCanvasKeyboardShortcuts({
  connectionMode,
  selectedPlacementId,
  canDeleteSelectedRoutePoint,
  onConnectionCancel,
  onClearSelection,
  onDeleteSelectedRoutePoint,
  onPlacementRemove
}: {
  connectionMode: "idle" | "connecting";
  selectedPlacementId?: string;
  canDeleteSelectedRoutePoint: boolean;
  onConnectionCancel: () => void;
  onClearSelection: () => void;
  onDeleteSelectedRoutePoint: () => void;
  onPlacementRemove: (placementId: string) => void;
}) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
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
        selectedPlacementId &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        onPlacementRemove(selectedPlacementId);
      }
    },
    [
      canDeleteSelectedRoutePoint,
      connectionMode,
      onClearSelection,
      onConnectionCancel,
      onDeleteSelectedRoutePoint,
      onPlacementRemove,
      selectedPlacementId
    ]
  );
}
