import type {
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingSectionTitlePage,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { createDefaultDrawingSheet } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  resolveCopiedPlacementAsset,
  type AssetDuplicateMode,
  type CopiedAssetResolutionMap
} from "../services/drawing-asset-resolution";
import { deriveWireId } from "../services/drawing-identification";

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
  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? {
            ...sheet,
            kind: "section_title",
            sectionTitlePage: {
              ...(sheet.sectionTitlePage ?? {}),
              ...(updates.title === undefined
                ? {}
                : { title: normalizeOptionalText(updates.title, 160) }),
              ...(updates.subtitle === undefined
                ? {}
                : { subtitle: normalizeOptionalText(updates.subtitle, 400) }),
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
  name?: string
): { model: DrawingModel; sheetId: string } {
  const sheetId = createSheetId(model);
  const sheetNumber = model.sheets.length + 1;
  const sheet = createDefaultDrawingSheet({
    id: sheetId,
    name: normalizeSheetName(name, `Sheet ${sheetNumber}`)
  });

  return {
    model: {
      ...model,
      sheets: [...model.sheets, sheet]
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
  } = {}
): { model: DrawingModel; sheetId: string } {
  const sheetId = createSheetId(model);
  const sheetNumber = model.sheets.length + 1;
  const title =
    normalizeOptionalText(input.title, 160) ?? `Section ${sheetNumber}`;
  const sheet = {
    ...createDefaultDrawingSheet({
      id: sheetId,
      name: normalizeSheetName(input.name, `${title} Title Page`)
    }),
    kind: "section_title" as const,
    sectionTitlePage: {
      title,
      subtitle: normalizeOptionalText(input.subtitle, 400),
      sectionNumber: normalizeOptionalText(input.sectionNumber, 80)
    },
    placements: [],
    connections: [],
    annotations: []
  };

  return {
    model: {
      ...model,
      sheets: [...model.sheets, sheet]
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

function remapEndpoint(
  connection: DrawingConnection,
  placementIdMap: Map<string, string>
): DrawingConnection {
  return {
    ...connection,
    from: {
      ...connection.from,
      placementId:
        placementIdMap.get(connection.from.placementId) ??
        connection.from.placementId
    },
    to: {
      ...connection.to,
      placementId:
        placementIdMap.get(connection.to.placementId) ?? connection.to.placementId
    },
    cablePlacementId: connection.cablePlacementId
      ? placementIdMap.get(connection.cablePlacementId) ??
        connection.cablePlacementId
      : undefined
  };
}

function connectionCablePlacementId(
  connection: DrawingConnection,
  placements: DrawingPackageSheet["placements"]
): string | undefined {
  if (connection.cablePlacementId) {
    return connection.cablePlacementId;
  }

  const fromPlacement = placements.find(
    (placement) => placement.id === connection.from.placementId
  );
  const toPlacement = placements.find(
    (placement) => placement.id === connection.to.placementId
  );

  if (fromPlacement?.role === "cable_assembly") {
    return fromPlacement.id;
  }

  if (toPlacement?.role === "cable_assembly") {
    return toPlacement.id;
  }

  return undefined;
}

function toCanvasModel(
  model: DrawingModel,
  sheet: DrawingPackageSheet,
  overrides: {
    placements?: DrawingPackageSheet["placements"];
    connections?: DrawingConnection[];
  } = {}
): DrawingSheetCanvasModel {
  return {
    sheet: {
      ...sheet.page,
      titleBlock: model.titleBlock
    },
    placements: overrides.placements ?? sheet.placements,
    connections: overrides.connections ?? sheet.connections,
    annotations: sheet.annotations
  };
}

function shouldRegenerateCopiedWireId(
  wireId: string | undefined,
  oldDerivedWireId: string | undefined
): boolean {
  return Boolean(
    wireId &&
      oldDerivedWireId &&
      wireId.trim().toUpperCase() === oldDerivedWireId.trim().toUpperCase()
  );
}

export function duplicateSheet(
  model: DrawingModel,
  sheetId: string,
  symbols: ApprovedDrawingSymbol[] = [],
  options: {
    duplicateMode?: AssetDuplicateMode;
    assetMapping?: CopiedAssetResolutionMap;
    insertAt?: number;
    name?: string;
  } = {}
): { model: DrawingModel; sheetId: string } {
  const sourceIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  const source = sourceIndex >= 0 ? model.sheets[sourceIndex] : model.sheets[0];
  const newSheetId = createSheetId(model);
  const idPrefix = newSheetId.replace(/[^A-Za-z0-9_]+/g, "_");
  const placementIdMap = new Map<string, string>();
  const reservedTags = new Set<string>();
  const assetMapping = options.assetMapping ?? new Map();
  const duplicateMode = options.duplicateMode ?? "same-system";

  source.placements.forEach((placement, index) => {
    const id = `pl_${idPrefix}_${index + 1}`;
    placementIdMap.set(placement.id, id);
  });

  const placements = source.placements.map((placement) => {
    const id = placementIdMap.get(placement.id) ?? placement.id;
    const assetResolution = resolveCopiedPlacementAsset({
      model,
      placement,
      symbols,
      duplicateMode,
      reservedTags,
      assetMapping,
      newPlacementId: id
    });

    return {
      ...placement,
      id,
      assetId: assetResolution.assetId,
      tag: assetResolution.tag,
      layoutParentId: placement.layoutParentId
        ? placementIdMap.get(placement.layoutParentId)
        : undefined
    };
  });

  const connections = source.connections.map((connection, connectionIndex) => {
    const remappedConnection = remapEndpoint(connection, placementIdMap);
    const oldCablePlacementId = connectionCablePlacementId(
      connection,
      source.placements
    );
    const oldCablePlacement = oldCablePlacementId
      ? source.placements.find((placement) => placement.id === oldCablePlacementId)
      : undefined;
    const oldDerivedWireId = oldCablePlacement
      ? deriveWireId(toCanvasModel(model, source), symbols, connection)
      : undefined;
    const newDerivedWireId = oldCablePlacement
      ? deriveWireId(
          toCanvasModel(model, source, {
            placements,
            connections: [remappedConnection]
          }),
          symbols,
          remappedConnection
        )
      : undefined;

    return {
      ...remappedConnection,
      id: `conn_${idPrefix}_${connectionIndex + 1}`,
      wireId: shouldRegenerateCopiedWireId(
        remappedConnection.wireId,
        oldDerivedWireId
      )
        ? newDerivedWireId
        : remappedConnection.wireId,
      route: remappedConnection.route
        ? {
            ...remappedConnection.route,
            points: remappedConnection.route.points.map((point, pointIndex) => ({
              ...point,
              id: `rt_${idPrefix}_${connectionIndex + 1}_${pointIndex + 1}`
            }))
          }
        : undefined
    };
  });

  const annotations = source.annotations.map((annotation, index) => ({
    ...annotation,
    id: `ann_${idPrefix}_${index + 1}`
  }));

  const duplicate: DrawingPackageSheet = {
    ...source,
    id: newSheetId,
    name: normalizeSheetName(
      options.name ?? `${source.name} Copy`,
      `Sheet ${model.sheets.length + 1}`
    ),
    page: { ...source.page },
    placements,
    connections,
    annotations
  };

  const insertAt =
    options.insertAt === undefined
      ? sourceIndex >= 0
        ? sourceIndex + 1
        : model.sheets.length
      : Math.max(0, Math.min(options.insertAt, model.sheets.length));

  return {
    model: {
      ...model,
      sheets: [
        ...model.sheets.slice(0, insertAt),
        duplicate,
        ...model.sheets.slice(insertAt)
      ]
    },
    sheetId: newSheetId
  };
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
