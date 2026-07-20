import {
  buildCompatiblePanelAssetOptions,
  validatePanelComponentPlacement
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingPackageModelSchema,
  type DrawingAssetRecord,
  type DrawingAssetType,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement,
  type DrawingPlacementRole
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";
import { findNextPanelOccurrencePosition } from "./drawing-panel-occurrence-commands";

export type PanelComponentPlacementResult = {
  model: DrawingModel;
  placement: DrawingPlacement;
  asset: DrawingAssetRecord;
  warnings: string[];
  affectedIds: string[];
};

function detailedPanelSheet(
  model: DrawingModel,
  sheetId: string
): DrawingPackageSheet & {
  panelDrawingContext: NonNullable<DrawingPackageSheet["panelDrawingContext"]>;
} {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) {
    throw new Error("The Detailed Panel Drawing sheet no longer exists.");
  }
  if (sheet.panelDrawingContext?.kind !== "detailed_panel_wiring") {
    throw new Error(
      "Panel components can only be placed on a Detailed Panel Drawing."
    );
  }
  return sheet as DrawingPackageSheet & {
    panelDrawingContext: NonNullable<DrawingPackageSheet["panelDrawingContext"]>;
  };
}

function occurrenceId(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `panel_component_${suffix}`;
}

function roleForAssetType(type: DrawingAssetType): DrawingPlacementRole {
  return type === "terminal_block" ? "terminal_block" : "device";
}

function panelComponentCapability(symbol: ApprovedDrawingSymbol) {
  const capability = symbol.metadata.panelWiring;
  if (!capability) {
    throw new Error(
      "This symbol is not approved for Detailed Panel component placement."
    );
  }
  const validation = validatePanelComponentPlacement(symbol);
  if (validation.blockingReasons.length > 0) {
    throw new Error(validation.blockingReasons[0]);
  }
  return { capability, warnings: validation.warnings };
}

function assertNotRepresented(
  sheet: DrawingPackageSheet,
  assetId: string
): void {
  if (sheet.placements.some((placement) => placement.assetId === assetId)) {
    throw new Error(
      "This physical asset is already represented on the Detailed Panel Drawing."
    );
  }
}

function addPlacement(
  model: DrawingModel,
  sheetId: string,
  placement: DrawingPlacement
): DrawingModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? { ...sheet, placements: [...sheet.placements, placement] }
        : sheet
    )
  };
}

function draftPlacement({
  asset,
  symbol,
  panelAssetId
}: {
  asset: DrawingAssetRecord;
  symbol: ApprovedDrawingSymbol;
  panelAssetId: string;
}): DrawingPlacement {
  return {
    id: occurrenceId(),
    assetId: asset.id,
    containerAssetId: panelAssetId,
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    role: roleForAssetType(asset.type),
    tag: asset.tag,
    title: asset.title,
    x: 0,
    y: 0,
    rotation: 0,
    scale: symbol.metadata.panelWiring?.schematicScale ?? 0.34
  };
}

export function createAndPlacePanelAsset(input: {
  model: DrawingModel;
  sheetId: string;
  symbol: ApprovedDrawingSymbol;
  tag?: string;
  title?: string;
  symbols?: ApprovedDrawingSymbol[];
}): PanelComponentPlacementResult {
  void input;
  throw new Error(
    "Create physical equipment from the panel layout before referencing it on a Detailed Panel Drawing."
  );
}

export function placeExistingPanelAsset({
  model: inputModel,
  sheetId,
  symbol,
  assetId,
  symbols = []
}: {
  model: DrawingModel;
  sheetId: string;
  symbol: ApprovedDrawingSymbol;
  assetId: string;
  symbols?: ApprovedDrawingSymbol[];
}): PanelComponentPlacementResult {
  const model = drawingPackageModelSchema.parse(inputModel);
  const sheet = detailedPanelSheet(model, sheetId);
  const { warnings } = panelComponentCapability(symbol);
  assertNotRepresented(sheet, assetId);

  const asset = model.assets?.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new Error("The selected package asset no longer exists.");
  }
  const compatible = buildCompatiblePanelAssetOptions({
    source: createPanelWiringSource(model, symbols),
    panelAssetId: sheet.panelDrawingContext.panelAssetId,
    detailedSheetId: sheetId,
    symbol
  }).some((candidate) => candidate.assetId === assetId);
  if (!compatible) {
    throw new Error(
      "The selected asset is not a compatible unrepresented asset associated with this panel."
    );
  }

  const draft = draftPlacement({
    asset,
    symbol,
    panelAssetId: sheet.panelDrawingContext.panelAssetId
  });
  const position = findNextPanelOccurrencePosition({
    sheet,
    placement: draft,
    symbols
  });
  const placement = { ...draft, ...position };

  return {
    model: drawingPackageModelSchema.parse(
      addPlacement(model, sheetId, placement)
    ),
    placement,
    asset,
    warnings,
    affectedIds: [asset.id, placement.id, sheetId]
  };
}

export function createNewPanelAssetIdentityFromOccurrence(input: {
  model: DrawingModel;
  sheetId: string;
  placementId: string;
  symbol: ApprovedDrawingSymbol;
  tag: string;
}): PanelComponentPlacementResult {
  void input;
  throw new Error(
    "Create physical equipment from the panel layout before referencing it on a Detailed Panel Drawing."
  );
}

export {
  findNextPanelOccurrencePosition as findNextPanelComponentPosition,
  removePanelAssetOccurrence as removePanelComponentOccurrence
} from "./drawing-panel-occurrence-commands";
