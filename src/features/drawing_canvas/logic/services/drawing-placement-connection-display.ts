import type {
  PanelConnectionDisplayMode,
  PlacementWireContextRequest
} from "@/features/drawing_panel_wiring/api/public";
import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement
} from "../../data/schema";

export type DrawingConnectionDisplayMode = PanelConnectionDisplayMode;

export function getPlacementConnectionDisplayMode(
  placement: DrawingPlacement,
  sheet?: Pick<DrawingPackageSheet, "panelDrawingContext">
): DrawingConnectionDisplayMode {
  if (placement.connectionDisplayMode) {
    return placement.connectionDisplayMode;
  }

  return sheet?.panelDrawingContext?.kind === "detailed_panel_wiring"
    ? "external_connected"
    : "sheet_only";
}

export function connectionDisplayModeShowsInternal(
  mode: DrawingConnectionDisplayMode
): boolean {
  return mode === "internal_connected" || mode === "all_connected";
}

export function connectionDisplayModeShowsExternal(
  mode: DrawingConnectionDisplayMode
): boolean {
  return mode === "external_connected" || mode === "all_connected";
}

export function connectionDisplayModeScheduleScope(
  mode: DrawingConnectionDisplayMode
): "sheet_routes" | "all_connected" {
  return mode === "sheet_only" ? "sheet_routes" : "all_connected";
}

export function sheetHasCompleteWiringDisplay(
  sheet: DrawingPackageSheet
): boolean {
  return sheet.placements.some(
    (placement) =>
      getPlacementConnectionDisplayMode(placement, sheet) !== "sheet_only"
  );
}

export function collectPlacementWireContextRequests(
  model: DrawingModel
): PlacementWireContextRequest[] {
  return model.sheets.flatMap((sheet) =>
    sheet.placements.flatMap((placement) => {
      const mode = getPlacementConnectionDisplayMode(placement, sheet);
      return mode === "sheet_only"
        ? []
        : [{ sheetId: sheet.id, placementId: placement.id, mode }];
    })
  );
}

export function buildPlacementConnectionDisplayModeIndex(
  model: DrawingModel
): ReadonlyMap<string, DrawingConnectionDisplayMode> {
  const index = new Map<string, DrawingConnectionDisplayMode>();
  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      index.set(
        `${sheet.id}:${placement.id}`,
        getPlacementConnectionDisplayMode(placement, sheet)
      );
    }
  }
  return index;
}
