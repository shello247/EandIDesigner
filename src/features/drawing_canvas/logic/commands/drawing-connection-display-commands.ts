import type { PanelConnectionDisplayMode } from "@/features/drawing_panel_wiring/api/public";
import { isConnectedWireScheduleAnnotation } from "@/features/drawing_connected_wire_schedule/api/public";
import {
  drawingPackageModelSchema,
  type DrawingModel
} from "../../data/schema";
import { connectionDisplayModeScheduleScope } from "../services/drawing-placement-connection-display";

export function updateDrawingConnectionDisplayMode(input: {
  model: DrawingModel;
  sheetId: string;
  placementId: string;
  mode: PanelConnectionDisplayMode;
}): DrawingModel {
  const sourceSheet = input.model.sheets.find(
    (sheet) => sheet.id === input.sheetId
  );
  const sourcePlacement = sourceSheet?.placements.find(
    (placement) => placement.id === input.placementId
  );
  if (!sourceSheet || !sourcePlacement) {
    throw new Error("The linked equipment occurrence is unavailable.");
  }

  const directlyLinkedSchedules = sourceSheet.annotations
    .filter(isConnectedWireScheduleAnnotation)
    .filter(
      (annotation) =>
        annotation.schedule.sourcePlacementId === input.placementId
    );
  const continuationSetIds = new Set(
    directlyLinkedSchedules.flatMap((annotation) =>
      annotation.schedule.pagination?.continuationSetId
        ? [annotation.schedule.pagination.continuationSetId]
        : []
    )
  );
  const linkedScheduleIds = new Set(
    input.model.sheets.flatMap((sheet) =>
      sheet.annotations.flatMap((annotation) => {
        if (!isConnectedWireScheduleAnnotation(annotation)) return [];
        const directlyLinked =
          sheet.id === input.sheetId &&
          annotation.schedule.sourcePlacementId === input.placementId;
        const continuationLinked = Boolean(
          annotation.schedule.pagination?.continuationSetId &&
            continuationSetIds.has(
              annotation.schedule.pagination.continuationSetId
            )
        );
        return directlyLinked || continuationLinked ? [annotation.id] : [];
      })
    )
  );
  const placementKeys = new Set([`${input.sheetId}:${input.placementId}`]);
  for (const sheet of input.model.sheets) {
    for (const annotation of sheet.annotations) {
      if (
        isConnectedWireScheduleAnnotation(annotation) &&
        linkedScheduleIds.has(annotation.id)
      ) {
        placementKeys.add(
          `${sheet.id}:${annotation.schedule.sourcePlacementId}`
        );
      }
    }
  }
  const scheduleScope = connectionDisplayModeScheduleScope(input.mode);

  return drawingPackageModelSchema.parse({
    ...input.model,
    sheets: input.model.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) =>
        placementKeys.has(`${sheet.id}:${placement.id}`)
          ? { ...placement, connectionDisplayMode: input.mode }
          : placement
      ),
      annotations: sheet.annotations.map((annotation) =>
        isConnectedWireScheduleAnnotation(annotation) &&
        linkedScheduleIds.has(annotation.id)
          ? {
              ...annotation,
              schedule: { ...annotation.schedule, scope: scheduleScope }
            }
          : annotation
      )
    }))
  });
}
