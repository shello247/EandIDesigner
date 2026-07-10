import type { DrawingModel } from "../../data/schema";
import { getDrawingSheetPresentation } from "./drawing-sheet-presentation";

export type SheetLoaderRow = {
  sheetId: string;
  sheetNumber: number;
  name: string;
  typeLabel: "Drawing" | "Section Title" | "Detailed Panel";
  description: string;
  placementCount: number;
  assetCount: number;
  connectionCount: number;
};

export function buildSheetLoaderRows(model: DrawingModel): SheetLoaderRow[] {
  return model.sheets.map((sheet, index) => {
    const assetIds = new Set(
      sheet.placements
        .map((placement) => placement.assetId)
        .filter((assetId): assetId is string => Boolean(assetId))
    );
    if (sheet.panelDrawingContext?.panelAssetId) {
      assetIds.add(sheet.panelDrawingContext.panelAssetId);
    }
    const presentation = getDrawingSheetPresentation(sheet);

    return {
      sheetId: sheet.id,
      sheetNumber: index + 1,
      name: sheet.name,
      typeLabel: presentation.typeLabel,
      description: sheet.description ?? "",
      placementCount: sheet.placements.length,
      assetCount: assetIds.size,
      connectionCount: sheet.connections.length
    };
  });
}

export function filterSheetLoaderRows(
  rows: SheetLoaderRow[],
  query: string
): SheetLoaderRow[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) =>
    [
      `sheet ${row.sheetNumber}`,
      String(row.sheetNumber),
      row.name,
      row.typeLabel,
      row.description
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}
