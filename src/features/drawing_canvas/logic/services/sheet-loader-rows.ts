import type { DrawingModel } from "../../data/schema";
import { getDrawingSheetPresentation } from "./drawing-sheet-presentation";
import {
  buildDrawingSectionIndex,
  type DrawingSectionIndex
} from "./drawing-sections";

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

export type SheetLoaderGroup =
  | {
      id: "front_matter";
      kind: "front_matter";
      title: "Front Matter";
      startSheetNumber: number;
      endSheetNumber: number;
      rows: SheetLoaderRow[];
    }
  | {
      id: string;
      kind: "section";
      sectionNumber: number;
      title: string;
      startSheetNumber: number;
      endSheetNumber: number;
      titlePage: SheetLoaderRow;
      rows: SheetLoaderRow[];
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
    const description =
      sheet.description ||
      (sheet.kind === "section_title"
        ? sheet.sectionTitlePage?.subtitle ?? ""
        : "");

    return {
      sheetId: sheet.id,
      sheetNumber: index + 1,
      name: sheet.name,
      typeLabel: presentation.typeLabel,
      description,
      placementCount: sheet.placements.length,
      assetCount: assetIds.size,
      connectionCount: sheet.connections.length
    };
  });
}

export function buildSheetLoaderGroups(
  model: DrawingModel,
  sectionIndex: DrawingSectionIndex = buildDrawingSectionIndex(model)
): SheetLoaderGroup[] {
  const rows = buildSheetLoaderRows(model);
  const rowsById = new Map(rows.map((row) => [row.sheetId, row]));
  const groups: SheetLoaderGroup[] = [];

  if (sectionIndex.frontMatterSheetIds.length > 0) {
    const frontMatterRows = sectionIndex.frontMatterSheetIds.flatMap((sheetId) => {
      const row = rowsById.get(sheetId);
      return row ? [row] : [];
    });
    groups.push({
      id: "front_matter",
      kind: "front_matter",
      title: "Front Matter",
      startSheetNumber: frontMatterRows[0]?.sheetNumber ?? 1,
      endSheetNumber:
        frontMatterRows.at(-1)?.sheetNumber ?? frontMatterRows[0]?.sheetNumber ?? 1,
      rows: frontMatterRows
    });
  }

  for (const section of sectionIndex.sections) {
    const titlePage = rowsById.get(section.titlePageSheetId);
    if (!titlePage) continue;
    const memberRows = section.memberSheetIds.flatMap((sheetId) => {
      const row = rowsById.get(sheetId);
      return row ? [row] : [];
    });
    groups.push({
      id: section.id,
      kind: "section",
      sectionNumber: section.number,
      title: section.title,
      startSheetNumber: titlePage.sheetNumber,
      endSheetNumber: memberRows.at(-1)?.sheetNumber ?? titlePage.sheetNumber,
      titlePage,
      rows: memberRows
    });
  }

  return groups;
}

function rowMatchesQuery(row: SheetLoaderRow, normalizedQuery: string): boolean {
  return [
    `sheet ${row.sheetNumber}`,
    String(row.sheetNumber),
    row.name,
    row.typeLabel,
    row.description
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function filterSheetLoaderGroups(
  groups: SheetLoaderGroup[],
  query: string
): SheetLoaderGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    const groupMatches =
      group.kind === "front_matter"
        ? "front matter".includes(normalizedQuery)
        : `section ${group.sectionNumber} ${group.title}`
            .toLowerCase()
            .includes(normalizedQuery) ||
          rowMatchesQuery(group.titlePage, normalizedQuery);
    if (groupMatches) return [group];

    const rows = group.rows.filter((row) =>
      rowMatchesQuery(row, normalizedQuery)
    );
    return rows.length > 0 ? [{ ...group, rows }] : [];
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
    rowMatchesQuery(row, normalizedQuery)
  );
}
