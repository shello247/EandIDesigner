import {
  createDrawingAssetId,
  getPanelEnclosureTitle,
  getSymbolForPackagePlacement,
  assertUniqueAssetTag,
  isBreakerLikeSymbol,
  isGeneratedPanelEnclosurePlacement,
  isGeneratedTerminalBlockReference,
  normalizeAssetTag,
  placementAssetId,
  isNonAssetDrawingPlacement,
  renameDrawingAssetTag,
  type ApprovedDrawingSymbol,
  type DrawingAssetRecord,
  type DrawingAssetType,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  isNetworkDeviceDrawingSymbol,
  normalizeNetworkDeviceDrawingAssets
} from "@/features/drawing_canvas/logic/services/drawing-network-device-assets";
import {
  managedAssetCreateInputSchema,
  managedAssetUpdateInputSchema,
  type ManagedAssetCreateInput,
  type ManagedAssetUpdateInput
} from "../../data/schema";

export type ManagedAssetSheetReference = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
  referenceKind: "placement" | "containment" | "panel_context";
  placementId?: string;
};

export type ManagedAssetCatalogItem = DrawingAssetRecord & {
  normalizedTag: string;
  occurrenceCount: number;
  sheetRefs: ManagedAssetSheetReference[];
  symbolKey?: string;
  symbolName?: string;
  warnings: string[];
};

export type AssetDeletionBlocker = {
  code: "placement" | "containment" | "panel_context";
  message: string;
  sheetRefs: ManagedAssetSheetReference[];
};

const ASSET_TYPE_LABELS: Record<DrawingAssetType, string> = {
  instrument: "Instrument",
  controller: "Controller",
  panel: "Panel",
  junction_box: "Junction Box",
  terminal_block: "Terminal Block",
  breaker: "Breaker",
  fuse: "Fuse",
  relay: "Relay",
  power_supply: "Power Supply",
  isolator: "Isolator",
  converter: "Converter",
  io_module: "I/O Module",
  network_device: "Network Device",
  earth_bar: "Earth Bar",
  cable: "Cable",
  other: "Asset"
};

const ASSET_TYPE_PREFIXES: Record<DrawingAssetType, string> = {
  instrument: "LIT",
  controller: "TSM",
  panel: "PDP",
  junction_box: "JB",
  terminal_block: "TB",
  breaker: "MCB",
  fuse: "FU",
  relay: "K",
  power_supply: "PSU",
  isolator: "ISO",
  converter: "CV",
  io_module: "IO",
  network_device: "SW",
  earth_bar: "EB",
  cable: "C",
  other: "EQ"
};

const ASSET_TYPE_STARTS: Record<DrawingAssetType, number> = {
  instrument: 101,
  controller: 101,
  panel: 101,
  junction_box: 1,
  terminal_block: 101,
  breaker: 101,
  fuse: 101,
  relay: 101,
  power_supply: 101,
  isolator: 101,
  converter: 101,
  io_module: 101,
  network_device: 101,
  earth_bar: 101,
  cable: 101,
  other: 101
};

export function assetTypeLabel(type: DrawingAssetType): string {
  return ASSET_TYPE_LABELS[type];
}

function symbolDescriptor(symbol: ApprovedDrawingSymbol | undefined): string {
  if (!symbol) {
    return "";
  }

  return `${symbol.symbolKey} ${symbol.model ?? ""} ${symbol.displayName}`.toUpperCase();
}

export function classifyManagedAssetFromPlacement(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): DrawingAssetType {
  const symbol = getSymbolForPackagePlacement(placement, symbols);
  const descriptor = symbolDescriptor(symbol);
  const tag = placement.tag.trim().toUpperCase();

  if (isGeneratedPanelEnclosurePlacement(placement)) {
    return placement.enclosure.kind === "junction_box" ? "junction_box" : "panel";
  }

  if (placement.role === "cable_assembly") {
    return "cable";
  }

  if (isGeneratedTerminalBlockReference(placement)) {
    return "terminal_block";
  }

  if (isNetworkDeviceDrawingSymbol(symbol)) {
    return "network_device";
  }

  if (symbol?.metadata.panelWiring) {
    return symbol.metadata.panelWiring.assetType;
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

  if (symbol?.category === "terminal_block" || placement.role === "terminal_block") {
    return "terminal_block";
  }

  if (descriptor.includes("JUNCTION BOX")) {
    return "junction_box";
  }

  return "other";
}

function titleFromPlacement(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): string {
  const symbol = getSymbolForPackagePlacement(placement, symbols);

  return (
    placement.title?.trim() ||
    (isGeneratedPanelEnclosurePlacement(placement)
      ? getPanelEnclosureTitle(placement)
      : undefined) ||
    symbol?.displayName ||
    placement.tag
  );
}

function sheetReference(
  sheet: DrawingPackageSheet,
  sheetIndex: number,
  placement: DrawingPlacement
): ManagedAssetSheetReference {
  return {
    sheetId: sheet.id,
    sheetName: sheet.name,
    sheetNumber: sheetIndex + 1,
    referenceKind: "placement",
    placementId: placement.id
  };
}

function recordFromPlacement(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): DrawingAssetRecord {
  const symbol = getSymbolForPackagePlacement(placement, symbols);

  return {
    id: placementAssetId(placement),
    tag: placement.tag,
    type: classifyManagedAssetFromPlacement(placement, symbols),
    title: titleFromPlacement(placement, symbols),
    symbolId: placement.symbolId,
    versionId: placement.versionId,
    terminalBlock: placement.terminalBlock,
    metadata: {
      generatedKind: placement.enclosure?.kind,
      symbolKey: symbol?.symbolKey
    }
  };
}

function assetMatchesSymbol(
  asset: DrawingAssetRecord,
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  return Boolean(
    asset.symbolId &&
      asset.versionId &&
      symbol &&
      asset.symbolId === symbol.symbolId &&
      asset.versionId === symbol.versionId
  );
}

function addWarning(item: ManagedAssetCatalogItem, warning: string) {
  if (!item.warnings.includes(warning)) {
    item.warnings.push(warning);
  }
}

export function buildManagedAssetCatalog(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): ManagedAssetCatalogItem[] {
  model = normalizeNetworkDeviceDrawingAssets(model, symbols);
  const catalog = new Map<string, ManagedAssetCatalogItem>();
  const nonAssetLayoutHelperIds = new Set(
    model.sheets.flatMap((sheet) =>
      sheet.placements
        .filter(
          (placement) =>
            isNonAssetDrawingPlacement(placement)
        )
        .map(placementAssetId)
    )
  );

  for (const asset of model.assets ?? []) {
    if (nonAssetLayoutHelperIds.has(asset.id)) {
      continue;
    }

    catalog.set(asset.id, {
      ...asset,
      normalizedTag: normalizeAssetTag(asset.tag),
      occurrenceCount: 0,
      sheetRefs: [],
      symbolKey: asset.metadata?.symbolKey,
      symbolName: symbols.find((symbol) => assetMatchesSymbol(asset, symbol))
        ?.displayName,
      warnings: []
    });
  }

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      if (isNonAssetDrawingPlacement(placement)) {
        return;
      }

      const assetId = placementAssetId(placement);
      const symbol = getSymbolForPackagePlacement(placement, symbols);
      const inferred = recordFromPlacement(placement, symbols);
      const current =
        catalog.get(assetId) ??
        {
          ...inferred,
          normalizedTag: normalizeAssetTag(inferred.tag),
          occurrenceCount: 0,
          sheetRefs: [],
          symbolKey: symbol?.symbolKey,
          symbolName: symbol?.displayName,
          warnings: []
        };

      current.sheetRefs.push(sheetReference(sheet, sheetIndex, placement));
      current.occurrenceCount += 1;
      current.symbolKey = current.symbolKey ?? symbol?.symbolKey;
      current.symbolName = current.symbolName ?? symbol?.displayName;

      if (normalizeAssetTag(current.tag) !== normalizeAssetTag(placement.tag)) {
        addWarning(current, `Placement tag differs on Sheet ${sheetIndex + 1}.`);
      }

      if (
        placement.title &&
        current.title.trim() &&
        placement.title.trim() !== current.title.trim()
      ) {
        addWarning(current, `Placement title differs on Sheet ${sheetIndex + 1}.`);
      }

      catalog.set(assetId, current);
    });

    const panelAssetId = sheet.panelDrawingContext?.panelAssetId;
    const panelAsset = panelAssetId ? catalog.get(panelAssetId) : undefined;

    if (panelAsset) {
      panelAsset.sheetRefs.push({
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1,
        referenceKind: "panel_context"
      });
    }
  });

  const tagGroups = new Map<string, ManagedAssetCatalogItem[]>();

  for (const item of catalog.values()) {
    const normalizedTag = normalizeAssetTag(item.tag);

    if (!normalizedTag) {
      continue;
    }

    tagGroups.set(normalizedTag, [...(tagGroups.get(normalizedTag) ?? []), item]);
  }

  for (const items of tagGroups.values()) {
    if (items.length > 1) {
      items.forEach((item) => {
        addWarning(item, "Duplicate tag is used by another asset.");
      });
    }
  }

  return [...catalog.values()].sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, { numeric: true })
  );
}

function existingAssetTags(model: DrawingModel): Set<string> {
  return new Set([
    ...(model.assets ?? []).map((asset) => normalizeAssetTag(asset.tag)),
    ...model.sheets.flatMap((sheet) =>
      sheet.placements
        .filter((placement) => !isNonAssetDrawingPlacement(placement))
        .map((placement) => normalizeAssetTag(placement.tag))
    )
  ]);
}

export function allocateNextManagedAssetTag(
  model: DrawingModel,
  type: DrawingAssetType
): string {
  const prefix = ASSET_TYPE_PREFIXES[type];
  const start = ASSET_TYPE_STARTS[type];
  const existing = existingAssetTags(model);

  for (let index = start; index < 10000; index += 1) {
    const candidate = `${prefix}-${String(index).padStart(3, "0")}`;

    if (!existing.has(normalizeAssetTag(candidate))) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now()}`;
}

function assetTitleForCreate(input: ManagedAssetCreateInput): string {
  const normalizedTitle = input.title?.trim();

  return normalizedTitle || assetTypeLabel(input.type);
}

export function reconcileDrawingAssets(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const normalizedModel = normalizeNetworkDeviceDrawingAssets(model, symbols);
  const catalog = buildManagedAssetCatalog(normalizedModel, symbols);

  return {
    ...normalizedModel,
    assets: catalog.map((asset) => ({
      id: asset.id,
      tag: asset.tag,
      type: asset.type,
      title: asset.title,
      description: asset.description,
      symbolId: asset.symbolId,
      versionId: asset.versionId,
      metadata: asset.metadata,
      terminalBlock: asset.terminalBlock,
      terminalStrip: asset.terminalStrip,
      componentSelections: asset.componentSelections,
      engineeringAttributes: asset.engineeringAttributes
    }))
  };
}

export function createManagedAsset(
  model: DrawingModel,
  input: ManagedAssetCreateInput,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const parsed = managedAssetCreateInputSchema.parse(input);
  const symbol = symbols.find(
    (candidate) =>
      candidate.symbolId === parsed.symbolId &&
      candidate.versionId === parsed.versionId
  );
  const tag = parsed.tag?.trim() || allocateNextManagedAssetTag(model, parsed.type);
  assertUniqueAssetTag(model, tag);
  const nextAsset: DrawingAssetRecord = {
    id: createDrawingAssetId(),
    tag,
    type: parsed.type,
    title: assetTitleForCreate(parsed),
    description: parsed.description,
    symbolId: symbol?.symbolId ?? parsed.symbolId,
    versionId: symbol?.versionId ?? parsed.versionId,
    metadata: {
      symbolKey: symbol?.symbolKey
    }
  };

  return reconcileDrawingAssets(
    {
      ...model,
      assets: [...(model.assets ?? []), nextAsset]
    },
    symbols
  );
}

function updatePlacementTitle(
  placement: DrawingPlacement,
  title: string
): DrawingPlacement {
  if (isGeneratedPanelEnclosurePlacement(placement)) {
    return {
      ...placement,
      enclosure: {
        ...placement.enclosure,
        title
      }
    };
  }

  return {
    ...placement,
    title
  };
}

export function updateManagedAsset(
  model: DrawingModel,
  assetId: string,
  updates: ManagedAssetUpdateInput,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const parsed = managedAssetUpdateInputSchema.parse(updates);
  const current = (model.assets ?? []).find((asset) => asset.id === assetId);

  if (!current) {
    return model;
  }

  const nextTag = parsed.tag?.trim();
  const withTag = nextTag
    ? renameDrawingAssetTag(model, assetId, nextTag, symbols)
    : model;
  const nextTitle = parsed.title?.trim();
  const nextModel = {
    ...withTag,
    assets: (withTag.assets ?? []).map((asset) =>
      asset.id === assetId
        ? {
            ...asset,
            ...parsed,
            tag: nextTag ?? asset.tag,
            title: nextTitle ?? asset.title
          }
        : asset
    ),
    sheets: withTag.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) =>
        placementAssetId(placement) === assetId && nextTitle
          ? updatePlacementTitle(placement, nextTitle)
          : placement
      )
    }))
  };

  return reconcileDrawingAssets(nextModel, symbols);
}

export function getAssetDeletionBlockers(
  model: DrawingModel,
  assetId: string
): AssetDeletionBlocker[] {
  const placementRefs: ManagedAssetSheetReference[] = [];
  const containmentRefs: ManagedAssetSheetReference[] = [];
  const panelContextRefs: ManagedAssetSheetReference[] = [];

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      if (placementAssetId(placement) === assetId) {
        placementRefs.push(sheetReference(sheet, sheetIndex, placement));
      }

      if (placement.containerAssetId === assetId) {
        containmentRefs.push({
          ...sheetReference(sheet, sheetIndex, placement),
          referenceKind: "containment"
        });
      }
    });

    if (sheet.panelDrawingContext?.panelAssetId === assetId) {
      panelContextRefs.push({
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1,
        referenceKind: "panel_context"
      });
    }
  });

  return [
    placementRefs.length > 0
      ? {
          code: "placement" as const,
          message: "Asset is placed on one or more sheets.",
          sheetRefs: placementRefs
        }
      : undefined,
    containmentRefs.length > 0
      ? {
          code: "containment" as const,
          message: "Asset is used as a container for sheet placements.",
          sheetRefs: containmentRefs
        }
      : undefined,
    panelContextRefs.length > 0
      ? {
          code: "panel_context" as const,
          message: "Asset is referenced by a Detailed Panel Drawing.",
          sheetRefs: panelContextRefs
        }
      : undefined
  ].filter((blocker): blocker is AssetDeletionBlocker => Boolean(blocker));
}

export function deleteManagedAsset(
  model: DrawingModel,
  assetId: string
): DrawingModel {
  const blockers = getAssetDeletionBlockers(model, assetId);

  if (blockers.length > 0) {
    throw new Error(
      blockers
        .map(
          (blocker) =>
            `${blocker.message} ${blocker.sheetRefs
              .map((reference) => `Sheet ${reference.sheetNumber} - ${reference.sheetName}`)
              .join(", ")}`
        )
        .join(" ")
    );
  }

  return {
    ...model,
    assets: (model.assets ?? []).filter((asset) => asset.id !== assetId)
  };
}
