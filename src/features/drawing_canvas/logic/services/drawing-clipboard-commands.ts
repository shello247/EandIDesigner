import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { isNonAssetDrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { isTerminalBlockModuleSymbol } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import { replaceSheetFromCanvasModel, toSheetCanvasModel } from "../commands/drawing-sheet-commands";
import {
  preserveMappedDrawingAssets,
  resolveCopiedPlacementAsset,
  type AssetDuplicateMode,
  type CopiedAssetResolutionMap
} from "./drawing-asset-resolution";
import { placementAssetId } from "./drawing-asset-identity";
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

function isSamePanelPhysicalCopy({
  source,
  target,
  placement
}: {
  source?: DrawingPackageSheet;
  target: DrawingPackageSheet;
  placement: DrawingPlacement;
}): boolean {
  if (
    !source ||
    source.id !== target.id ||
    !placement.containerAssetId ||
    placement.layoutKind ||
    placement.role === "enclosure" ||
    isNonAssetDrawingPlacement(placement)
  ) {
    return false;
  }

  return target.placements.some(
    (candidate) =>
      candidate.role === "enclosure" &&
      !isNonAssetDrawingPlacement(candidate) &&
      placementAssetId(candidate) === placement.containerAssetId
  );
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

  const containsStructuredTerminalStrip = params.clipboard.placements.some(
    (placement) =>
      Boolean(
        placement.assetId &&
          params.model.assets.find((asset) => asset.id === placement.assetId)
            ?.terminalStrip
      )
  );

  if (containsStructuredTerminalStrip) {
    throw new Error(
      "Use Reuse terminal strip in Properties to copy or represent this assembly."
    );
  }

  const copiedSingularTerminalModule = params.clipboard.placements.find(
    (placement) => {
      const symbol = params.symbols.find(
        (candidate) =>
          candidate.symbolId === placement.symbolId &&
          candidate.versionId === placement.versionId
      );

      return isTerminalBlockModuleSymbol(symbol);
    }
  );

  if (copiedSingularTerminalModule) {
    throw new Error(
      "Individual terminal modules cannot be pasted. Use Terminal Strip."
    );
  }

  const source = params.model.sheets.find(
    (sheet) => sheet.id === params.clipboard.sourceSheetId
  );
  const copiedAssetPlacements = params.clipboard.placements.filter(
    (placement) => Boolean(placement.assetId)
  );
  const targetPanelAssetId = target.panelDrawingContext?.panelAssetId;
  const sourcePanelAssetId = source?.panelDrawingContext?.panelAssetId;
  if (copiedAssetPlacements.length > 0 && (targetPanelAssetId || sourcePanelAssetId)) {
    if (!targetPanelAssetId || !sourcePanelAssetId) {
      throw new Error(
        "Detailed Panel equipment must already exist in the panel inventory. Add it from the Panel Engineering Workbench."
      );
    }
    if (targetPanelAssetId !== sourcePanelAssetId) {
      throw new Error(
        "Detailed Panel components cannot be pasted into a different physical panel."
      );
    }
    if (target.id === source?.id) {
      throw new Error(
        "A physical asset can appear only once on a Detailed Panel Drawing. Choose another existing asset from the Panel Engineering Workbench."
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
      newPlacementId: id,
      createNewPhysicalAsset: isSamePanelPhysicalCopy({
        source,
        target,
        placement
      })
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

  const annotations = params.clipboard.annotations.map((annotation, index) => ({
    ...annotation,
    id: `ann_${idPrefix}_${index + 1}`
  }));
  const targetCanvasModel = toSheetCanvasModel(params.model, target.id);
  const nextCanvasModel: DrawingSheetCanvasModel = {
    ...targetCanvasModel,
    placements: [...targetCanvasModel.placements, ...placements],
    annotations: [...targetCanvasModel.annotations, ...annotations]
  };

  return {
    model: preserveMappedDrawingAssets(
      replaceSheetFromCanvasModel(params.model, target.id, nextCanvasModel),
      assetMapping
    ),
    selection: {
      placementIds: placements.map((placement) => placement.id),
      annotationIds: annotations.map((annotation) => annotation.id)
    }
  };
}
