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
import { remapLayoutDimensionAttachmentPlacementIds } from "./drawing-layout-dimensions";
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

function remapLayoutParentId(
  placement: DrawingPlacement,
  placementIdMap: Map<string, string>,
  target: DrawingPackageSheet
): string | undefined {
  if (!placement.layoutParentId) {
    return undefined;
  }

  const copiedParentId = placementIdMap.get(placement.layoutParentId);

  if (copiedParentId) {
    return copiedParentId;
  }

  return target.placements.some(
    (candidate) => candidate.id === placement.layoutParentId
  )
    ? placement.layoutParentId
    : undefined;
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

  const source = params.model.sheets.find(
    (sheet) => sheet.id === params.clipboard.sourceSheetId
  );
  const copiedAssetPlacements = params.clipboard.placements.filter(
    (placement) => Boolean(placement.assetId)
  );
  const targetPanelAssetId = target.panelDrawingContext?.panelAssetId;
  const sourcePanelAssetId = source?.panelDrawingContext?.panelAssetId;
  const copiedPatternIds = new Set(
    params.clipboard.connections.flatMap((connection) =>
      connection.panelPatternId ? [connection.panelPatternId] : []
    )
  );

  if (copiedPatternIds.size > 0) {
    if (!targetPanelAssetId || targetPanelAssetId !== sourcePanelAssetId) {
      throw new Error(
        "Connection patterns can only be represented on another Detailed Panel Drawing for the same physical panel."
      );
    }
    const duplicatePattern = target.connections.find(
      (connection) =>
        connection.panelPatternId && copiedPatternIds.has(connection.panelPatternId)
    );
    if (duplicatePattern) {
      throw new Error(
        "This physical connection pattern is already represented on the target sheet."
      );
    }
  }

  if (copiedAssetPlacements.length > 0 && (targetPanelAssetId || sourcePanelAssetId)) {
    if (!targetPanelAssetId || !sourcePanelAssetId) {
      throw new Error(
        "Detailed Panel equipment must already exist in the panel inventory. Add it from the Panel Work Queue."
      );
    }
    if (targetPanelAssetId !== sourcePanelAssetId) {
      throw new Error(
        "Detailed Panel components cannot be pasted into a different physical panel."
      );
    }
    if (target.id === source?.id) {
      throw new Error(
        "A physical asset can appear only once on a Detailed Panel Drawing. Choose another existing asset from the Panel Work Queue."
      );
    }
    const targetAssetIds = new Set(
      target.placements.flatMap((placement) =>
        placement.assetId ? [placement.assetId] : []
      )
    );
    const duplicate = copiedAssetPlacements.find(
      (placement) => placement.assetId && targetAssetIds.has(placement.assetId)
    );
    if (duplicate) {
      throw new Error(
        `${duplicate.tag} is already represented on the target Detailed Panel Drawing.`
      );
    }
    if (
      copiedAssetPlacements.some(
        (placement) => placement.containerAssetId !== targetPanelAssetId
      )
    ) {
      throw new Error(
        "Only components associated with this physical panel can be pasted here."
      );
    }
  }

  const idPrefix = sanitizeIdPart(params.idPrefix ?? createPasteIdPrefix(target));
  const placementIdMap = new Map<string, string>();
  const reservedTags = new Set<string>();
  const assetMapping = new Map(params.assetMapping ?? []);
  if (targetPanelAssetId && sourcePanelAssetId === targetPanelAssetId) {
    for (const placement of copiedAssetPlacements) {
      if (placement.assetId) {
        assetMapping.set(placement.assetId, {
          assetId: placement.assetId,
          tag: placement.tag
        });
      }
    }
  }
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

    return remapLayoutDimensionAttachmentPlacementIds({
      ...placement,
      id,
      assetId: assetResolution.assetId,
      tag: assetResolution.tag,
      layoutParentId: remapLayoutParentId(placement, placementIdMap, target)
    }, (placementId) =>
      placementIdMap.get(placementId) ??
      (target.placements.some((candidate) => candidate.id === placementId)
        ? placementId
        : undefined)
    );
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
