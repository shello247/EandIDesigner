import type {
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { replaceSheetFromCanvasModel, toSheetCanvasModel } from "../commands/drawing-sheet-commands";
import {
  resolveCopiedPlacementAsset,
  type AssetDuplicateMode,
  type CopiedAssetResolutionMap
} from "./drawing-asset-resolution";
import { deriveWireId } from "./drawing-identification";
import {
  EMPTY_CANVAS_SELECTION,
  isCanvasSelectionEmpty,
  normalizeCanvasSelection,
  type DrawingCanvasSelection
} from "./drawing-selection";

export type DrawingCanvasClipboard = {
  version: 1;
  sourceSheetId: string;
  placements: DrawingPlacement[];
  connections: DrawingConnection[];
  annotations: DrawingSheetCanvasModel["annotations"];
};

export type PasteClipboardResult = {
  model: DrawingModel;
  selection: DrawingCanvasSelection;
};

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

function createPasteIdPrefix(sheet: DrawingPackageSheet): string {
  return `paste_${sanitizeIdPart(sheet.id)}_${Date.now()}`;
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

function connectionIsInternal(
  connection: DrawingConnection,
  placementIds: ReadonlySet<string>
): boolean {
  return (
    placementIds.has(connection.from.placementId) &&
    placementIds.has(connection.to.placementId) &&
    (!connection.cablePlacementId || placementIds.has(connection.cablePlacementId))
  );
}

function toCanvasModel(
  model: DrawingModel,
  sheet: DrawingPackageSheet,
  overrides: {
    placements?: DrawingPlacement[];
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

function connectionCablePlacementId(
  connection: DrawingConnection,
  placements: DrawingPlacement[]
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

export function copySelectionToClipboard(params: {
  model: DrawingModel;
  sheetId: string;
  selection: DrawingCanvasSelection;
}): DrawingCanvasClipboard | null {
  const source = params.model.sheets.find((sheet) => sheet.id === params.sheetId);

  if (!source) {
    return null;
  }

  const canvasModel = toSheetCanvasModel(params.model, source.id);
  const selection = normalizeCanvasSelection(params.selection, canvasModel);

  if (isCanvasSelectionEmpty(selection)) {
    return null;
  }

  const placementIds = new Set(selection.placementIds);
  const annotationIds = new Set(selection.annotationIds);

  return {
    version: 1,
    sourceSheetId: source.id,
    placements: source.placements.filter((placement) =>
      placementIds.has(placement.id)
    ),
    connections: source.connections.filter((connection) =>
      connectionIsInternal(connection, placementIds)
    ),
    annotations: source.annotations.filter((annotation) =>
      annotationIds.has(annotation.id)
    )
  };
}

export function pasteClipboardToSheet(params: {
  model: DrawingModel;
  sheetId: string;
  clipboard: DrawingCanvasClipboard;
  symbols: ApprovedDrawingSymbol[];
  idPrefix?: string;
  duplicateMode?: AssetDuplicateMode;
  assetMapping?: CopiedAssetResolutionMap;
}): PasteClipboardResult {
  const target = params.model.sheets.find((sheet) => sheet.id === params.sheetId);

  if (!target) {
    return {
      model: params.model,
      selection: { ...EMPTY_CANVAS_SELECTION }
    };
  }

  const idPrefix = sanitizeIdPart(params.idPrefix ?? createPasteIdPrefix(target));
  const placementIdMap = new Map<string, string>();
  const reservedTags = new Set<string>();
  const assetMapping = params.assetMapping ?? new Map();
  const duplicateMode = params.duplicateMode ?? "same-system";

  params.clipboard.placements.forEach((placement, index) => {
    const id = `pl_${idPrefix}_${index + 1}`;
    placementIdMap.set(placement.id, id);
  });

  const placements = params.clipboard.placements.map((placement) => {
    const id = placementIdMap.get(placement.id) ?? placement.id;
    const assetResolution = resolveCopiedPlacementAsset({
      model: params.model,
      placement,
      symbols: params.symbols,
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

  const pastedConnections = params.clipboard.connections.map(
    (connection, connectionIndex) => {
      const remappedConnection = remapEndpoint(connection, placementIdMap);
      const oldCablePlacementId = connectionCablePlacementId(
        connection,
        params.clipboard.placements
      );
      const oldCablePlacement = oldCablePlacementId
        ? params.clipboard.placements.find(
            (placement) => placement.id === oldCablePlacementId
          )
        : undefined;
      const oldCanvas = toCanvasModel(params.model, target, {
        placements: params.clipboard.placements,
        connections: params.clipboard.connections
      });
      const newCanvas = toCanvasModel(params.model, target, {
        placements,
        connections: [remappedConnection]
      });
      const oldDerivedWireId = oldCablePlacement
        ? deriveWireId(oldCanvas, params.symbols, connection)
        : undefined;
      const newDerivedWireId = oldCablePlacement
        ? deriveWireId(newCanvas, params.symbols, remappedConnection)
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
    }
  );
  const annotations = params.clipboard.annotations.map((annotation, index) => ({
    ...annotation,
    id: `ann_${idPrefix}_${index + 1}`
  }));
  const targetCanvasModel = toSheetCanvasModel(params.model, target.id);
  const nextCanvasModel: DrawingSheetCanvasModel = {
    ...targetCanvasModel,
    placements: [...targetCanvasModel.placements, ...placements],
    connections: [...targetCanvasModel.connections, ...pastedConnections],
    annotations: [...targetCanvasModel.annotations, ...annotations]
  };

  return {
    model: replaceSheetFromCanvasModel(params.model, target.id, nextCanvasModel),
    selection: {
      placementIds: placements.map((placement) => placement.id),
      annotationIds: annotations.map((annotation) => annotation.id)
    }
  };
}
