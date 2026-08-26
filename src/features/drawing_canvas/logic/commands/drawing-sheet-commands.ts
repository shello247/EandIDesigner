import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingSectionTitlePage,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { createDefaultDrawingSheet } from "../../data/schema";

function nextSheetIndex(model: DrawingModel): number {
  const usedIndexes = new Set(
    model.sheets
      .map((sheet) => sheet.id.match(/^sheet_(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number(value))
  );

  for (let index = 1; index <= model.sheets.length + 2; index += 1) {
    if (!usedIndexes.has(index)) {
      return index;
    }
  }

  return model.sheets.length + 1;
}

function createSheetId(model: DrawingModel): string {
  return `sheet_${nextSheetIndex(model)}`;
}

function normalizeSheetName(name: string | undefined, fallback: string): string {
  const normalized = name ?? "";

  return normalized.length > 0 ? normalized.slice(0, 120) : fallback;
}

function normalizeSheetDescription(description: string | undefined): string | undefined {
  const normalized = description ?? "";

  return normalized.length > 0 ? normalized.slice(0, 400) : undefined;
}

function normalizeOptionalText(
  value: string | undefined,
  maxLength: number
): string | undefined {
  const normalized = value ?? "";

  return normalized.length > 0 ? normalized.slice(0, maxLength) : undefined;
}

export function getActiveSheet(
  model: DrawingModel,
  sheetId: string | undefined
): DrawingPackageSheet {
  return (
    model.sheets.find((sheet) => sheet.id === sheetId) ?? model.sheets[0]
  );
}

export function getActiveSheetId(
  model: DrawingModel,
  sheetId: string | undefined
): string {
  return getActiveSheet(model, sheetId).id;
}

export function getSheetNumber(
  model: DrawingModel,
  sheetId: string | undefined
): number {
  const index = model.sheets.findIndex((sheet) => sheet.id === sheetId);

  return index >= 0 ? index + 1 : 1;
}

export function toSheetCanvasModel(
  model: DrawingModel,
  sheetId: string | undefined
): DrawingSheetCanvasModel {
  const sheet = getActiveSheet(model, sheetId);

  return {
    sheet: {
      ...sheet.page,
      titleBlock: model.titleBlock
    },
    placements: sheet.placements,
    connections: sheet.connections,
    annotations: sheet.annotations
  };
}

export function replaceSheetFromCanvasModel(
  model: DrawingModel,
  sheetId: string,
  canvasModel: DrawingSheetCanvasModel
): DrawingModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? {
            ...sheet,
            page: {
              size: canvasModel.sheet.size,
              width: canvasModel.sheet.width,
              height: canvasModel.sheet.height,
              gridSize: canvasModel.sheet.gridSize
            },
            placements: canvasModel.placements,
            connections: canvasModel.connections,
            annotations: canvasModel.annotations
          }
        : sheet
    )
  };
}

export function updatePackageTitleBlock(
  model: DrawingModel,
  updates: Partial<DrawingModel["titleBlock"]>
): DrawingModel {
  return {
    ...model,
    titleBlock: {
      ...model.titleBlock,
      ...updates
    }
  };
}

export function updateSheetMetadata(
  model: DrawingModel,
  sheetId: string,
  updates: {
    name?: string;
    description?: string;
  }
): DrawingModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet, index) =>
      sheet.id === sheetId
        ? {
            ...sheet,
            name:
              updates.name === undefined
                ? sheet.name
                : normalizeSheetName(updates.name, `Sheet ${index + 1}`),
            description:
              updates.description === undefined
                ? sheet.description
                : normalizeSheetDescription(updates.description)
          }
        : sheet
    )
  };
}

export function updateSectionTitlePage(
  model: DrawingModel,
  sheetId: string,
  updates: Partial<DrawingSectionTitlePage>
): DrawingModel {
  const normalizedSubtitle =
    updates.subtitle === undefined
      ? undefined
      : normalizeOptionalText(updates.subtitle, 400);

  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? {
            ...sheet,
            kind: "section_title",
            description:
              updates.subtitle === undefined
                ? sheet.description
                : normalizedSubtitle,
            sectionTitlePage: {
              ...(sheet.sectionTitlePage ?? {}),
              ...(updates.title === undefined
                ? {}
                : { title: normalizeOptionalText(updates.title, 160) }),
              ...(updates.subtitle === undefined
                ? {}
                : { subtitle: normalizedSubtitle }),
              ...(updates.sectionNumber === undefined
                ? {}
                : {
                    sectionNumber: normalizeOptionalText(
                      updates.sectionNumber,
                      80
                    )
                  })
            }
          }
        : sheet
    )
  };
}

export function addDrawingSheet(
  model: DrawingModel,
  name?: string,
  options: { insertAt?: number } = {}
): { model: DrawingModel; sheetId: string } {
  const sheetId = createSheetId(model);
  const sheetNumber = model.sheets.length + 1;
  const sheet = createDefaultDrawingSheet({
    id: sheetId,
    name: normalizeSheetName(name, `Sheet ${sheetNumber}`)
  });

  const insertAt = Math.max(
    0,
    Math.min(options.insertAt ?? model.sheets.length, model.sheets.length)
  );

  return {
    model: {
      ...model,
      sheets: [
        ...model.sheets.slice(0, insertAt),
        sheet,
        ...model.sheets.slice(insertAt)
      ]
    },
    sheetId
  };
}

export function addSectionTitlePage(
  model: DrawingModel,
  input: {
    name?: string;
    title?: string;
    subtitle?: string;
    sectionNumber?: string;
  } = {},
  options: { insertAt?: number } = {}
): { model: DrawingModel; sheetId: string } {
  const sheetId = createSheetId(model);
  const sheetNumber = model.sheets.length + 1;
  const title =
    normalizeOptionalText(input.title, 160) ?? `Section ${sheetNumber}`;
  const subtitle = normalizeOptionalText(input.subtitle, 400);
  const sheet = {
    ...createDefaultDrawingSheet({
      id: sheetId,
      name: normalizeSheetName(input.name, `${title} Title Page`)
    }),
    kind: "section_title" as const,
    description: subtitle,
    sectionTitlePage: {
      title,
      subtitle
    },
    placements: [],
    connections: [],
    annotations: []
  };

  const insertAt = Math.max(
    0,
    Math.min(options.insertAt ?? model.sheets.length, model.sheets.length)
  );

  return {
    model: {
      ...model,
      sheets: [
        ...model.sheets.slice(0, insertAt),
        sheet,
        ...model.sheets.slice(insertAt)
      ]
    },
    sheetId
  };
}

export function addSheet(
  model: DrawingModel,
  name?: string
): { model: DrawingModel; sheetId: string } {
  return addDrawingSheet(model, name);
}

export function renameSheet(
  model: DrawingModel,
  sheetId: string,
  name: string
): DrawingModel {
  return updateSheetMetadata(model, sheetId, { name });
}

export function moveSheet(
  model: DrawingModel,
  sheetId: string,
  direction: -1 | 1
): DrawingModel {
  const currentIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  const nextIndex = currentIndex + direction;

  if (
    currentIndex < 0 ||
    nextIndex < 0 ||
    nextIndex >= model.sheets.length
  ) {
    return model;
  }

  const sheets = [...model.sheets];
  const [sheet] = sheets.splice(currentIndex, 1);
  sheets.splice(nextIndex, 0, sheet);

  return {
    ...model,
    sheets
  };
}

export function moveSheetToEnd(
  model: DrawingModel,
  sheetId: string
): DrawingModel {
  const currentIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);

  if (currentIndex < 0 || currentIndex === model.sheets.length - 1) {
    return model;
  }

  const sheets = [...model.sheets];
  const [sheet] = sheets.splice(currentIndex, 1);
  sheets.push(sheet);

  return {
    ...model,
    sheets
  };
}

export function deleteSheet(
  model: DrawingModel,
  sheetId: string
): { model: DrawingModel; activeSheetId: string } {
  if (model.sheets.length <= 1) {
    return {
      model,
      activeSheetId: model.sheets[0].id
    };
  }

  const deletedIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  const sheets = model.sheets.filter((sheet) => sheet.id !== sheetId);
  const fallbackIndex = Math.max(0, Math.min(deletedIndex, sheets.length - 1));

  return {
    model: {
      ...model,
      sheets
    },
    activeSheetId: sheets[fallbackIndex].id
  };
}
