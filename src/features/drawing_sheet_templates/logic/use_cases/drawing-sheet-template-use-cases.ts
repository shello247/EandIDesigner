import type {
  ApprovedDrawingSymbol,
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement
} from "@/features/drawing_canvas/api/template-contracts";
import {
  allocateNextTagFromPrefix,
  allocateNextPackageTag,
  buildDrawingAssetCatalog,
  canReferenceExistingAsset,
  createDrawingAssetId,
  deriveWireId,
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID,
  getSymbolForPackagePlacement,
  isBreakerLikeSymbol,
  isGeneratedPanelEnclosurePlacement,
  normalizeAssetTag,
  PANEL_ENCLOSURE_TAG_PREFIX,
  placementAssetId,
  remapLayoutDimensionAttachmentPlacementIds
} from "@/features/drawing_canvas/api/template-contracts";
import {
  drawingSheetTemplateModelSchema,
  type DrawingSheetTemplateAsset,
  type DrawingSheetTemplateModel,
  type DrawingSheetTemplatePlacement,
  type TemplateAssetResolutionMode
} from "../../data/schema";

export type TemplateAssetResolutionChoice = {
  templateAssetId: string;
  mode: TemplateAssetResolutionMode;
  tag?: string;
  targetAssetId?: string;
};

export type TemplateImportWarning = {
  code:
    | "duplicate_tag"
    | "missing_symbol"
    | "invalid_reference"
    | "missing_resolution"
    | "missing_container";
  message: string;
  templateAssetId?: string;
};

export type TemplateImportResult = {
  model: DrawingModel;
  sheetId: string;
  warnings: TemplateImportWarning[];
};

export type TemplateImportAssetPlan = {
  templateAsset: DrawingSheetTemplateAsset;
  symbol?: ApprovedDrawingSymbol;
  compatibleAssets: ReturnType<typeof buildDrawingAssetCatalog>;
  defaultMode: TemplateAssetResolutionMode;
  suggestedTag: string;
  targetAssetId?: string;
  canReference: boolean;
  warnings: TemplateImportWarning[];
};

export type TemplateImportPlan = {
  assets: TemplateImportAssetPlan[];
  warnings: TemplateImportWarning[];
  canImport: boolean;
};

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "template"
  );
}

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

function uniqueSheetName(model: DrawingModel, name: string): string {
  const existing = new Set(model.sheets.map((sheet) => sheet.name.trim()));
  const base = name.trim() || `Sheet ${model.sheets.length + 1}`;

  if (!existing.has(base)) {
    return base.slice(0, 120);
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} ${index}`;

    if (!existing.has(candidate)) {
      return candidate.slice(0, 120);
    }
  }

  return `${base} ${Date.now()}`.slice(0, 120);
}

function symbolForTemplateAsset(
  asset: DrawingSheetTemplateAsset,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  return symbols.find(
    (symbol) =>
      symbol.symbolId === asset.symbolId && symbol.versionId === asset.versionId
  );
}

function templateAssetIdForPlacement(index: number, placement: DrawingPlacement) {
  return `ta_${index + 1}_${slug(placement.tag || placement.id)}`;
}

function defaultTemplateAssetResolutionMode(input: {
  placement: DrawingPlacement;
  symbol?: ApprovedDrawingSymbol;
}): TemplateAssetResolutionMode {
  if (isGeneratedPanelEnclosurePlacement(input.placement)) {
    return "reference";
  }

  if (input.symbol?.category === "monitor") {
    return "reference";
  }

  if (
    (!isBreakerLikeSymbol(input.symbol) &&
      input.symbol?.category === "terminal_block") ||
    input.placement.role === "terminal_block"
  ) {
    return "reference";
  }

  return "create";
}

function requiredSymbolsForAssets(
  assets: DrawingSheetTemplateAsset[]
): DrawingSheetTemplateModel["metadata"]["requiredSymbols"] {
  const byKey = new Map<
    string,
    DrawingSheetTemplateModel["metadata"]["requiredSymbols"][number]
  >();

  assets.forEach((asset) => {
    if (
      asset.symbolId === GENERATED_PANEL_ENCLOSURE_SYMBOL_ID &&
      asset.versionId === GENERATED_PANEL_ENCLOSURE_VERSION_ID
    ) {
      return;
    }

    const key = `${asset.symbolId}:${asset.versionId}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        symbolId: asset.symbolId,
        versionId: asset.versionId,
        symbolKey: asset.symbolKey,
        displayName: asset.symbolName
      });
    }
  });

  return [...byKey.values()];
}

export function createSheetTemplateModel(input: {
  model: DrawingModel;
  sheetId: string;
  symbols: ApprovedDrawingSymbol[];
  summary?: string;
  keywords?: string[];
  sourceDrawingId?: string;
}): DrawingSheetTemplateModel {
  const sheet = input.model.sheets.find(
    (candidate) => candidate.id === input.sheetId
  );

  if (!sheet) {
    throw new Error("Source sheet was not found.");
  }

  const templateAssetIdByAssetId = new Map<string, string>();
  const assets: DrawingSheetTemplateAsset[] = [];

  sheet.placements.forEach((placement) => {
    const assetId = placementAssetId(placement);

    if (templateAssetIdByAssetId.has(assetId)) {
      return;
    }

    const symbol = getSymbolForPackagePlacement(placement, input.symbols);
    const templateAssetId = templateAssetIdForPlacement(assets.length, placement);
    templateAssetIdByAssetId.set(assetId, templateAssetId);
    assets.push({
      templateAssetId,
      originalAssetId: assetId,
      originalTag: placement.tag,
      role: placement.role,
      symbolId: placement.symbolId,
      versionId: placement.versionId,
      symbolKey: symbol?.symbolKey,
      symbolName: symbol?.displayName,
      category: symbol?.category,
      defaultResolutionMode: defaultTemplateAssetResolutionMode({
        placement,
        symbol
      })
    });
  });

  const placements: DrawingSheetTemplatePlacement[] = sheet.placements.map(
    (placement) => {
      const templatePlacement = { ...placement };
      delete templatePlacement.assetId;

      return {
        ...templatePlacement,
        containerAssetId: placement.containerAssetId
          ? templateAssetIdByAssetId.get(placement.containerAssetId)
          : undefined,
        templateAssetId:
          templateAssetIdByAssetId.get(placementAssetId(placement)) ??
          templateAssetIdForPlacement(assets.length, placement)
      };
    }
  );

  return drawingSheetTemplateModelSchema.parse({
    version: 1,
    sheet: {
      name: sheet.name,
      description: sheet.description,
      page: sheet.page,
      placements,
      connections: sheet.connections,
      annotations: sheet.annotations
    },
    assets,
    metadata: {
      summary: input.summary,
      keywords: input.keywords ?? [],
      requiredSymbols: requiredSymbolsForAssets(assets),
      assetCount: assets.length,
      source: {
        drawingId: input.sourceDrawingId,
        sheetId: sheet.id,
        sheetName: sheet.name
      }
    }
  });
}

export function buildTemplateImportPlan(input: {
  model: DrawingModel;
  template: DrawingSheetTemplateModel;
  symbols: ApprovedDrawingSymbol[];
}): TemplateImportPlan {
  const catalog = buildDrawingAssetCatalog(input.model, input.symbols);
  const reservedTags = new Set<string>();
  const assets: TemplateImportAssetPlan[] = input.template.assets.map((asset) => {
    const symbol = symbolForTemplateAsset(asset, input.symbols);
    const warnings: TemplateImportWarning[] = [];
    const isGeneratedPanel =
      asset.symbolId === GENERATED_PANEL_ENCLOSURE_SYMBOL_ID &&
      asset.versionId === GENERATED_PANEL_ENCLOSURE_VERSION_ID;

    if (!symbol && !isGeneratedPanel) {
      warnings.push({
        code: "missing_symbol",
        templateAssetId: asset.templateAssetId,
        message: `Approved symbol for ${asset.originalTag} is no longer available.`
      });
    }

    const canReference = Boolean(
      isGeneratedPanel || (symbol && canReferenceExistingAsset(symbol))
    );
    const compatibleAssets =
      symbol || isGeneratedPanel
        ? catalog.filter(
            (candidate) =>
              candidate.symbolId === asset.symbolId &&
              candidate.versionId === asset.versionId
          )
      : [];
    const exactTagMatch = compatibleAssets.find(
      (candidate) =>
        normalizeAssetTag(candidate.tag) === normalizeAssetTag(asset.originalTag)
    );
    const defaultMode: TemplateAssetResolutionMode =
      canReference &&
      asset.defaultResolutionMode === "reference" &&
      exactTagMatch
        ? "reference"
        : "create";
    const suggestedTag = symbol
      ? allocateNextPackageTag(input.model, symbol, { reservedTags })
      : isGeneratedPanel
        ? allocateNextTagFromPrefix({
            model: input.model,
            prefix: PANEL_ENCLOSURE_TAG_PREFIX,
            reservedTags
          })
        : asset.originalTag;

    if (defaultMode === "create") {
      reservedTags.add(suggestedTag);
    }

    return {
      templateAsset: asset,
      symbol,
      compatibleAssets,
      defaultMode,
      suggestedTag,
      targetAssetId: defaultMode === "reference" ? exactTagMatch?.assetId : undefined,
      canReference,
      warnings
    };
  });
  const warnings = assets.flatMap((asset) => asset.warnings);

  return {
    assets,
    warnings,
    canImport: warnings.every((warning) => warning.code !== "missing_symbol")
  };
}

function remapConnection(
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

function toCanvasModel(input: {
  titleBlock: DrawingModel["titleBlock"];
  sheet: DrawingPackageSheet["page"];
  placements: DrawingPlacement[];
  connections: DrawingConnection[];
}) {
  return {
    sheet: {
      ...input.sheet,
      titleBlock: input.titleBlock
    },
    placements: input.placements,
    connections: input.connections,
    annotations: []
  };
}

function shouldRegenerateWireId(
  currentWireId: string | undefined,
  derivedWireId: string | undefined
): boolean {
  return Boolean(
    currentWireId &&
      derivedWireId &&
      currentWireId.trim().toUpperCase() === derivedWireId.trim().toUpperCase()
  );
}

function findChoice(
  choices: TemplateAssetResolutionChoice[],
  templateAssetId: string
): TemplateAssetResolutionChoice | undefined {
  return choices.find((choice) => choice.templateAssetId === templateAssetId);
}

export function instantiateTemplateSheet(input: {
  model: DrawingModel;
  template: DrawingSheetTemplateModel;
  symbols: ApprovedDrawingSymbol[];
  choices: TemplateAssetResolutionChoice[];
  insertAfterSheetId?: string;
}): TemplateImportResult {
  const plan = buildTemplateImportPlan({
    model: input.model,
    template: input.template,
    symbols: input.symbols
  });
  const warnings: TemplateImportWarning[] = [...plan.warnings];

  if (!plan.canImport) {
    throw new Error("Template cannot be imported until missing symbols are resolved.");
  }

  const catalog = buildDrawingAssetCatalog(input.model, input.symbols);
  const usedTags = new Map<string, string>();
  const assetResolution = new Map<
    string,
    { assetId: string; tag: string; templateAsset: DrawingSheetTemplateAsset }
  >();

  for (const assetPlan of plan.assets) {
    const choice = findChoice(
      input.choices,
      assetPlan.templateAsset.templateAssetId
    );

    if (!choice) {
      warnings.push({
        code: "missing_resolution",
        templateAssetId: assetPlan.templateAsset.templateAssetId,
        message: `No asset resolution was provided for ${assetPlan.templateAsset.originalTag}.`
      });
      continue;
    }

    if (choice.mode === "reference") {
      const target = catalog.find(
        (candidate) =>
          candidate.assetId === choice.targetAssetId &&
          candidate.symbolId === assetPlan.templateAsset.symbolId &&
          candidate.versionId === assetPlan.templateAsset.versionId
      );

      if (!target) {
        warnings.push({
          code: "invalid_reference",
          templateAssetId: assetPlan.templateAsset.templateAssetId,
          message: `Existing asset reference for ${assetPlan.templateAsset.originalTag} is not valid.`
        });
        continue;
      }

      assetResolution.set(assetPlan.templateAsset.templateAssetId, {
        assetId: target.assetId,
        tag: target.tag,
        templateAsset: assetPlan.templateAsset
      });
      continue;
    }

    const tag = choice.tag?.trim() || assetPlan.suggestedTag;
    const normalizedTag = normalizeAssetTag(tag);
    const existingAsset = catalog.find(
      (candidate) => candidate.normalizedTag === normalizedTag
    );
    const earlierTemplateAsset = usedTags.get(normalizedTag);

    if (existingAsset || earlierTemplateAsset) {
      throw new Error(
        `${tag} is already used by another asset in this drawing. Reference the existing asset or choose a unique tag.`
      );
    }

    usedTags.set(normalizedTag, assetPlan.templateAsset.templateAssetId);
    assetResolution.set(assetPlan.templateAsset.templateAssetId, {
      assetId: createDrawingAssetId(
        `${assetPlan.templateAsset.templateAssetId}_${Date.now()}`
      ),
      tag,
      templateAsset: assetPlan.templateAsset
    });
  }

  if (assetResolution.size !== input.template.assets.length) {
    throw new Error("Template import has incomplete asset resolutions.");
  }

  const newSheetId = createSheetId(input.model);
  const idPrefix = newSheetId.replace(/[^A-Za-z0-9_]+/g, "_");
  const placementIdMap = new Map<string, string>();
  const templatePlacementsAsDrawingPlacements: DrawingPlacement[] =
    input.template.sheet.placements.map((placement) => ({
      ...placement,
      assetId: placement.templateAssetId,
      tag:
        input.template.assets.find(
          (asset) => asset.templateAssetId === placement.templateAssetId
        )?.originalTag ?? placement.tag
    }));

  input.template.sheet.placements.forEach((placement, index) => {
    placementIdMap.set(placement.id, `pl_${idPrefix}_${index + 1}`);
  });

  const placements: DrawingPlacement[] = input.template.sheet.placements.map(
    (placement) => {
      const id = placementIdMap.get(placement.id) ?? placement.id;
      const resolution = assetResolution.get(placement.templateAssetId);
      const containerResolution = placement.containerAssetId
        ? assetResolution.get(placement.containerAssetId)
        : undefined;

      if (placement.containerAssetId && !containerResolution) {
        warnings.push({
          code: "missing_container",
          templateAssetId: placement.templateAssetId,
          message: `${placement.tag} referenced a panel that could not be resolved during import.`
        });
      }

      return remapLayoutDimensionAttachmentPlacementIds({
        ...placement,
        id,
        assetId: resolution?.assetId ?? createDrawingAssetId(id),
        containerAssetId: containerResolution?.assetId,
        layoutParentId: placement.layoutParentId
          ? placementIdMap.get(placement.layoutParentId)
          : undefined,
        tag: resolution?.tag ?? placement.tag
      }, (placementId) => placementIdMap.get(placementId));
    }
  );

  const beforeCanvas = toCanvasModel({
    titleBlock: input.model.titleBlock,
    sheet: input.template.sheet.page,
    placements: templatePlacementsAsDrawingPlacements,
    connections: input.template.sheet.connections
  });
  const connections: DrawingConnection[] = input.template.sheet.connections.map(
    (connection, connectionIndex) => {
      const remapped = remapConnection(connection, placementIdMap);
      const afterCanvas = toCanvasModel({
        titleBlock: input.model.titleBlock,
        sheet: input.template.sheet.page,
        placements,
        connections: [remapped]
      });
      const oldDerivedWireId = deriveWireId(
        beforeCanvas,
        input.symbols,
        connection
      );
      const newDerivedWireId = deriveWireId(afterCanvas, input.symbols, remapped);

      return {
        ...remapped,
        id: `conn_${idPrefix}_${connectionIndex + 1}`,
        wireId: shouldRegenerateWireId(connection.wireId, oldDerivedWireId)
          ? newDerivedWireId
          : connection.wireId,
        route: remapped.route
          ? {
              ...remapped.route,
              points: remapped.route.points.map((point, pointIndex) => ({
                ...point,
                id: `rt_${idPrefix}_${connectionIndex + 1}_${pointIndex + 1}`
              }))
            }
          : undefined
      };
    }
  );
  const annotations = input.template.sheet.annotations.map((annotation, index) => ({
    ...annotation,
    id: `ann_${idPrefix}_${index + 1}`
  }));
  const sheet: DrawingPackageSheet = {
    id: newSheetId,
    name: uniqueSheetName(input.model, input.template.sheet.name),
    kind: "drawing",
    description: input.template.sheet.description,
    page: input.template.sheet.page,
    placements,
    connections,
    annotations
  };
  const activeIndex = input.model.sheets.findIndex(
    (candidate) => candidate.id === input.insertAfterSheetId
  );
  const insertAt = activeIndex >= 0 ? activeIndex + 1 : input.model.sheets.length;

  return {
    model: {
      ...input.model,
      sheets: [
        ...input.model.sheets.slice(0, insertAt),
        sheet,
        ...input.model.sheets.slice(insertAt)
      ]
    },
    sheetId: newSheetId,
    warnings
  };
}
