import type {
  DrawingAssetType,
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { isNonAssetDrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { duplicateSheet } from "../commands/drawing-sheet-commands";
import {
  allocateNextPlacementTag,
  buildDrawingAssetCatalog,
  createDrawingAssetId,
  getSymbolForPackagePlacement,
  isBreakerLikeSymbol,
  normalizeAssetTag,
  placementAssetId,
  type DrawingAssetCatalogItem
} from "./drawing-asset-identity";
import type { CopiedAssetResolutionMap } from "./drawing-asset-resolution";
import { deriveWireId } from "./drawing-identification";

export type SheetDuplicateAssetAction = "create" | "reference";

export type SheetDuplicateAssetChoice = {
  sourceAssetId: string;
  action: SheetDuplicateAssetAction;
  targetAssetId?: string;
  targetTag?: string;
};

export type SheetDuplicateAssetReferenceOption = {
  assetId: string;
  tag: string;
  title: string;
  sheetRefs: string[];
};

export type SheetDuplicateAssetRow = {
  sourceAssetId: string;
  sourceTag: string;
  title: string;
  type: DrawingAssetType;
  symbolId: string;
  versionId: string;
  compatibleAssets: SheetDuplicateAssetReferenceOption[];
  defaultAction: SheetDuplicateAssetAction;
  action: SheetDuplicateAssetAction;
  targetAssetId?: string;
  targetTag?: string;
  warnings: string[];
};

export type SheetDuplicatePlan = {
  sourceSheetId: string;
  sourceSheetNumber: number;
  sourceSheetName: string;
  sourceLabel?: string;
  targetLabel?: string;
  targetSheetName: string;
  assetRows: SheetDuplicateAssetRow[];
  warnings: string[];
  blockingErrors: string[];
  existingTags: string[];
  preserveAssetReferences?: boolean;
  isSectionTitlePage?: boolean;
};

export function suggestSheetDuplicateSourceLabel(
  sheetName: string | undefined
): string {
  const match = sheetName?.match(/\b(Tank\s*[-_ ]?\d+)\b/i);

  return match?.[1]?.trim() ?? "";
}

export function suggestSheetDuplicateTargetLabel(
  sourceLabel: string | undefined
): string {
  const match = sourceLabel?.match(/^(.*?)(\d+)(.*?)$/);

  if (!match) {
    return "";
  }

  const nextNumber = Number(match[2]) + 1;

  return `${match[1]}${nextNumber}${match[3]}`.trim();
}

export function suggestDuplicateSheetName({
  sheetName,
  sourceLabel,
  targetLabel
}: {
  sheetName: string;
  sourceLabel?: string;
  targetLabel?: string;
}): string {
  const source = sourceLabel?.trim();
  const target = targetLabel?.trim();

  if (source && target) {
    const renamed = sheetName.replace(
      new RegExp(escapeRegExp(source), "gi"),
      target
    );

    if (renamed !== sheetName) {
      return renamed.slice(0, 120);
    }
  }

  return `${sheetName} Copy`.slice(0, 120);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assetTypeForPlacement(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol | undefined
): DrawingAssetType {
  const tag = placement.tag.trim().toUpperCase();

  if (placement.role === "enclosure") {
    return placement.enclosure?.kind === "junction_box" ? "junction_box" : "panel";
  }

  if (placement.role === "cable_assembly") {
    return "cable";
  }

  if (placement.role === "terminal_block") {
    return "terminal_block";
  }

  if (isBreakerLikeSymbol(symbol) || tag.startsWith("MCB")) {
    return "breaker";
  }

  if (symbol?.category === "monitor" || tag.startsWith("TSM")) {
    return "controller";
  }

  if (symbol?.category === "instrument") {
    return "instrument";
  }

  return "other";
}

function shouldReferenceByDefault(placement: DrawingPlacement): boolean {
  return placement.role === "enclosure";
}

function canPreferLikelyExistingTarget(type: DrawingAssetType): boolean {
  return (
    type === "controller" ||
    type === "breaker" ||
    type === "terminal_block"
  );
}

function assetTitle(
  model: DrawingModel,
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol | undefined
): string {
  return (
    model.assets.find((asset) => asset.id === placementAssetId(placement))?.title ??
    placement.title ??
    placement.enclosure?.title ??
    symbol?.displayName ??
    placement.tag
  );
}

function sheetOccurrenceLabel(sheetNumber: number, sheetName: string): string {
  return `Sheet ${sheetNumber} - ${sheetName}`;
}

function compatibleReferenceOptions(
  catalog: DrawingAssetCatalogItem[],
  placement: DrawingPlacement,
  model: DrawingModel
): SheetDuplicateAssetReferenceOption[] {
  return catalog
    .filter(
      (asset) =>
        asset.symbolId === placement.symbolId &&
        asset.versionId === placement.versionId
    )
    .map((asset) => ({
      assetId: asset.assetId,
      tag: asset.tag,
      title:
        model.assets.find((record) => record.id === asset.assetId)?.title ??
        asset.symbolName ??
        asset.tag,
      sheetRefs: asset.placementRefs.map((reference) =>
        sheetOccurrenceLabel(reference.sheetNumber, reference.sheetName)
      )
    }));
}

function existingTags(model: DrawingModel): string[] {
  return [
    ...(model.assets ?? []).map((asset) => normalizeAssetTag(asset.tag)),
    ...model.sheets.flatMap((sheet) =>
      sheet.placements.map((placement) => normalizeAssetTag(placement.tag))
    )
  ].filter(Boolean);
}

function labelNumberDelta(
  sourceLabel: string | undefined,
  targetLabel: string | undefined
): number | undefined {
  const sourceMatch = sourceLabel?.match(/(\d+)/);
  const targetMatch = targetLabel?.match(/(\d+)/);

  if (!sourceMatch || !targetMatch) {
    return undefined;
  }

  return Number(targetMatch[1]) - Number(sourceMatch[1]);
}

function incrementTagNumber(tag: string, delta: number | undefined): string | undefined {
  if (delta === undefined || delta === 0) {
    return undefined;
  }

  const match = tag.match(/^(.*?)(\d+)(.*?)$/);

  if (!match) {
    return undefined;
  }

  const nextNumber = Number(match[2]) + delta;

  if (nextNumber < 0) {
    return undefined;
  }

  const paddedNumber = String(nextNumber).padStart(match[2].length, "0");

  return `${match[1]}${paddedNumber}${match[3]}`;
}

function findReferenceByTag(
  compatibleAssets: SheetDuplicateAssetReferenceOption[],
  tag: string | undefined
): SheetDuplicateAssetReferenceOption | undefined {
  const normalizedTag = normalizeAssetTag(tag);

  if (!normalizedTag) {
    return undefined;
  }

  return compatibleAssets.find(
    (asset) => normalizeAssetTag(asset.tag) === normalizedTag
  );
}

function canvasModelForSheet(
  model: DrawingModel,
  sheet: DrawingPackageSheet,
  connections: DrawingConnection[] = sheet.connections
): DrawingSheetCanvasModel {
  return {
    sheet: {
      ...sheet.page,
      titleBlock: model.titleBlock
    },
    placements: sheet.placements,
    connections,
    annotations: sheet.annotations
  };
}

function collectManualWireWarnings({
  model,
  sheet,
  symbols
}: {
  model: DrawingModel;
  sheet: DrawingPackageSheet;
  symbols: ApprovedDrawingSymbol[];
}): string[] {
  const canvasModel = canvasModelForSheet(model, sheet);

  return sheet.connections.flatMap((connection) => {
    const derivedWireId = deriveWireId(canvasModel, symbols, connection);

    if (
      connection.wireId &&
      derivedWireId &&
      normalizeAssetTag(connection.wireId) !== normalizeAssetTag(derivedWireId)
    ) {
      return [
        `${connection.wireId} is a manual wire ID and will be preserved on the duplicate.`
      ];
    }

    return [];
  });
}

function validatePlan(plan: SheetDuplicatePlan): SheetDuplicatePlan {
  const blockingErrors: string[] = [];
  const warnings: string[] = [...plan.warnings];
  const existing = new Set(plan.existingTags);
  const createTags = new Map<string, string>();

  if (!plan.targetSheetName.trim()) {
    blockingErrors.push("Enter a new sheet name.");
  }

  for (const row of plan.assetRows) {
    if (row.action === "reference") {
      const validReference = row.compatibleAssets.some(
        (asset) => asset.assetId === row.targetAssetId
      );

      if (!row.targetAssetId || !validReference) {
        blockingErrors.push(`${row.sourceTag} needs a valid existing asset reference.`);
      }

      continue;
    }

    const normalizedTag = normalizeAssetTag(row.targetTag);

    if (!normalizedTag) {
      blockingErrors.push(`${row.sourceTag} needs a target asset tag.`);
      continue;
    }

    if (existing.has(normalizedTag)) {
      blockingErrors.push(
        `${row.targetTag} is already used by another asset in this drawing.`
      );
    }

    const earlierSourceAssetId = createTags.get(normalizedTag);

    if (earlierSourceAssetId && earlierSourceAssetId !== row.sourceAssetId) {
      blockingErrors.push(`${row.targetTag} is assigned to more than one new asset.`);
    }

    createTags.set(normalizedTag, row.sourceAssetId);
  }

  if (
    !plan.isSectionTitlePage &&
    (!plan.sourceLabel?.trim() || !plan.targetLabel?.trim())
  ) {
    warnings.push("Sheet name replacement is not configured.");
  }

  return {
    ...plan,
    warnings: [...new Set(warnings)],
    blockingErrors
  };
}

export function buildSheetDuplicatePlan({
  model,
  symbols,
  sourceSheetId,
  sourceLabel,
  targetLabel,
  targetSheetName,
  choices = []
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sourceSheetId: string;
  sourceLabel?: string;
  targetLabel?: string;
  targetSheetName?: string;
  choices?: SheetDuplicateAssetChoice[];
}): SheetDuplicatePlan {
  const sourceSheet =
    model.sheets.find((sheet) => sheet.id === sourceSheetId) ?? model.sheets[0];
  const sourceSheetNumber =
    model.sheets.findIndex((sheet) => sheet.id === sourceSheet.id) + 1;
  const catalog = buildDrawingAssetCatalog(model, symbols);
  const reservedTags = new Set<string>();
  const choiceMap = new Map(choices.map((choice) => [choice.sourceAssetId, choice]));
  const rowMap = new Map<SheetDuplicateAssetRow["sourceAssetId"], SheetDuplicateAssetRow>();
  const delta = labelNumberDelta(sourceLabel, targetLabel);
  const preserveAssetReferences =
    sourceSheet.panelDrawingContext?.kind === "detailed_panel_wiring";

  sourceSheet.placements.forEach((placement) => {
    if (isNonAssetDrawingPlacement(placement)) {
      return;
    }
    const sourceAssetId = placementAssetId(placement);

    if (rowMap.has(sourceAssetId)) {
      return;
    }

    const symbol = getSymbolForPackagePlacement(placement, symbols);
    const type = assetTypeForPlacement(placement, symbol);
    const compatibleAssets = compatibleReferenceOptions(catalog, placement, model);
    const likelyTargetTag = incrementTagNumber(placement.tag, delta);
    const likelyTargetAsset = canPreferLikelyExistingTarget(type)
      ? findReferenceByTag(compatibleAssets, likelyTargetTag)
      : undefined;
    const defaultAction: SheetDuplicateAssetAction =
      preserveAssetReferences || shouldReferenceByDefault(placement) || likelyTargetAsset
        ? "reference"
        : "create";
    const allocatedTag = allocateNextPlacementTag(model, placement, symbols, {
      reservedTags
    });
    const choice = choiceMap.get(sourceAssetId);
    const action = preserveAssetReferences ? "reference" : choice?.action ?? defaultAction;
    const defaultReference =
      likelyTargetAsset ??
      compatibleAssets.find((asset) => asset.assetId === sourceAssetId) ??
      compatibleAssets[0];
    const targetAssetId =
      action === "reference"
        ? preserveAssetReferences
          ? sourceAssetId
          : choice?.targetAssetId ?? defaultReference?.assetId
        : choice?.targetAssetId;
    const targetAsset = compatibleAssets.find((asset) => asset.assetId === targetAssetId);
    const targetTag =
      action === "reference"
        ? targetAsset?.tag ?? defaultReference?.tag ?? placement.tag
        : choice?.targetTag ?? allocatedTag;

    if (action === "create") {
      reservedTags.add(targetTag);
    }

    rowMap.set(sourceAssetId, {
      sourceAssetId,
      sourceTag: placement.tag,
      title: assetTitle(model, placement, symbol),
      type,
      symbolId: placement.symbolId,
      versionId: placement.versionId,
      compatibleAssets,
      defaultAction,
      action,
      targetAssetId,
      targetTag,
      warnings:
        likelyTargetAsset && action === "create"
          ? [
              `${likelyTargetAsset.tag} already exists as a compatible target asset.`
            ]
          : []
    });
  });

  const plan: SheetDuplicatePlan = {
    sourceSheetId: sourceSheet.id,
    sourceSheetNumber,
    sourceSheetName: sourceSheet.name,
    sourceLabel: sourceLabel?.trim() || undefined,
    targetLabel: targetLabel?.trim() || undefined,
    targetSheetName:
      targetSheetName ??
      suggestDuplicateSheetName({
        sheetName: sourceSheet.name,
        sourceLabel,
        targetLabel
      }),
    assetRows: [...rowMap.values()],
    warnings: collectManualWireWarnings({ model, sheet: sourceSheet, symbols }),
    blockingErrors: [],
    existingTags: existingTags(model),
    preserveAssetReferences,
    isSectionTitlePage: sourceSheet.kind === "section_title"
  };

  return validatePlan(plan);
}

export function updateSheetDuplicateChoice(
  plan: SheetDuplicatePlan,
  choice: SheetDuplicateAssetChoice
): SheetDuplicatePlan {
  if (plan.preserveAssetReferences) {
    return plan;
  }
  const assetRows = plan.assetRows.map((row) => {
    if (row.sourceAssetId !== choice.sourceAssetId) {
      return row;
    }

    const targetAsset = row.compatibleAssets.find(
      (asset) => asset.assetId === choice.targetAssetId
    );

    return {
      ...row,
      action: choice.action,
      targetAssetId:
        choice.action === "reference"
          ? choice.targetAssetId ?? row.targetAssetId
          : choice.targetAssetId,
      targetTag:
        choice.action === "reference"
          ? targetAsset?.tag ?? row.targetTag
          : choice.targetTag ?? row.targetTag
    };
  });

  return validatePlan({
    ...plan,
    assetRows
  });
}

export function applySheetDuplicatePlan({
  model,
  symbols,
  plan
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  plan: SheetDuplicatePlan;
}): { model: DrawingModel; sheetId: string } {
  const validatedPlan = validatePlan(plan);

  if (validatedPlan.blockingErrors.length > 0) {
    throw new Error(validatedPlan.blockingErrors.join(" "));
  }

  const catalog = buildDrawingAssetCatalog(model, symbols);
  const assetMapping: CopiedAssetResolutionMap = new Map();

  for (const row of validatedPlan.assetRows) {
    if (row.action === "reference") {
      const targetAsset = catalog.find((asset) => asset.assetId === row.targetAssetId);

      if (!targetAsset) {
        throw new Error(`${row.sourceTag} needs a valid existing asset reference.`);
      }

      assetMapping.set(row.sourceAssetId, {
        assetId: targetAsset.assetId,
        tag: targetAsset.tag
      });
      continue;
    }

    if (!row.targetTag?.trim()) {
      throw new Error(`${row.sourceTag} needs a target asset tag.`);
    }

    assetMapping.set(row.sourceAssetId, {
      assetId: createDrawingAssetId(),
      tag: row.targetTag.trim()
    });
  }

  return duplicateSheet(model, validatedPlan.sourceSheetId, symbols, {
    duplicateMode: validatedPlan.preserveAssetReferences
      ? "same-system"
      : "new-system",
    assetMapping,
    name: validatedPlan.targetSheetName
  });
}
