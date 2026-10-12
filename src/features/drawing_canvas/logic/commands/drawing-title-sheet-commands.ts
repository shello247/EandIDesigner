import { createTitleSheet, type DrawingModel } from "../../data/schema";

export function canConvertFirstSheetToTitleSheet(model: DrawingModel, sheetId: string): boolean {
  const first = model.sheets[0];
  return first?.id === sheetId && first.kind === "drawing" &&
    !first.description?.trim() && !first.sectionTitlePage && !first.panelDrawingContext &&
    first.placements.length === 0 && first.connections.length === 0 && first.annotations.length === 0 &&
    !model.sheets.some((sheet) => sheet.kind === "title_sheet");
}

export function convertFirstSheetToTitleSheet(model: DrawingModel, sheetId: string): DrawingModel {
  if (!canConvertFirstSheetToTitleSheet(model, sheetId)) {
    throw new Error("Only a blank first drawing sheet can be converted to a Title Sheet. Existing content is preserved.");
  }
  const first = model.sheets[0];
  return {
    ...model,
    sheets: [{ ...createTitleSheet(first.id), page: first.page }, ...model.sheets.slice(1)]
  };
}
