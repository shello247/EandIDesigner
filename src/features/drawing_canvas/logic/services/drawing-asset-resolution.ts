import type {
  DrawingConnection,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import { isNonAssetDrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { cloneStructuredTerminalStrip } from "@/features/drawing_terminal_blocks/api/public";
import { cloneEngineeringAttributesForNewAsset } from "@/features/engineering_attributes/api/public";
import {
  allocateNextPlacementTag,
  assertUniqueAssetTag,
  buildDrawingAssetCatalog,
  createDrawingAssetId,
  getSymbolForPackagePlacement,
  normalizeAssetTag,
  placementAssetId,
  shouldKeepAssetLinkedOnSheetDuplicate,
  type DrawingAssetCatalogItem,
  type DrawingAssetPlacementRef
} from "./drawing-asset-identity";
import { deriveWireId } from "./drawing-identification";
import {
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "./drawing-generated-symbols";

export type AssetDuplicateMode = "same-system" | "new-system";

export type DrawingAssetPlacementTarget = {
  sheetId: string;
  placementId: string;
};

export type CopiedAssetResolution = {
  assetId?: string;
  tag: string;
  linked: boolean;
};

export type CopiedAssetResolutionMap = Map<
  string,
  {
    assetId: string;
    tag: string;
    sourceAssetId?: string;
  }
>;

export function preserveMappedDrawingAssets(
  model: DrawingModel,
  assetMapping: CopiedAssetResolutionMap
): DrawingModel {
  const assets = [...(model.assets ?? [])];
  const existingIds = new Set(assets.map((asset) => asset.id));

  for (const [mappingKey, target] of assetMapping) {
    if (existingIds.has(target.assetId)) {
      continue;
    }

    const sourceAssetId = target.sourceAssetId ?? mappingKey;
    const source = assets.find((asset) => asset.id === sourceAssetId);

    if (!source) {
      continue;
    }

    const copiedAsset = source.terminalStrip
      ? {
          ...source,
          id: target.assetId,
          tag: target.tag,
          symbolId: structuredTerminalStripSymbolId(target.assetId),
          versionId: structuredTerminalStripVersionId(target.assetId),
          metadata: {
            ...source.metadata,
            generatedKind: "structured_terminal_strip" as const,
            symbolKey: `structured_terminal_strip_${target.assetId}`
          },
          terminalStrip: cloneStructuredTerminalStrip(source.terminalStrip),
          engineeringAttributes: cloneEngineeringAttributesForNewAsset({
            container: source.engineeringAttributes,
            assetType: source.type
          })
        }
      : {
          ...source,
          id: target.assetId,
          tag: target.tag,
          engineeringAttributes: cloneEngineeringAttributesForNewAsset({
            container: source.engineeringAttributes,
            assetType: source.type
          })
        };

    assets.push(copiedAsset);
    existingIds.add(target.assetId);
  }

  return {
    ...model,
    assets
  };
}

export type CompatibleAssetRelinkOptions = {
  currentAsset?: DrawingAssetCatalogItem;
  compatibleAssets: DrawingAssetCatalogItem[];
  linkedOccurrences: Array<DrawingAssetPlacementRef & { assetId: string }>;
  proposedTag: string;
};

function targetKey(target: DrawingAssetPlacementTarget): string {
  return `${target.sheetId}:${target.placementId}`;
}

function normalizeTargets(
  model: DrawingModel,
  targets: Array<DrawingAssetPlacementTarget | string>
): DrawingAssetPlacementTarget[] {
  const normalized = new Map<string, DrawingAssetPlacementTarget>();
  const placementIds = new Set<string>();

  targets.forEach((target) => {
    if (typeof target === "string") {
      placementIds.add(target);
      return;
    }

    normalized.set(targetKey(target), target);
  });

  if (placementIds.size > 0) {
    model.sheets.forEach((sheet) => {
      sheet.placements.forEach((placement) => {
        if (placementIds.has(placement.id)) {
          const target = { sheetId: sheet.id, placementId: placement.id };
          normalized.set(targetKey(target), target);
        }
      });
    });
  }

  return [...normalized.values()];
}

function findPlacementById(
  model: DrawingModel,
  placementId: string
): DrawingPlacement | undefined {
  for (const sheet of model.sheets) {
    const placement = sheet.placements.find((candidate) => candidate.id === placementId);

    if (placement) {
      return placement;
    }
  }

  return undefined;
}

function placementMatchesTarget(
  sheetId: string,
  placement: DrawingPlacement,
  targetSet: ReadonlySet<string>
): boolean {
  return targetSet.has(targetKey({ sheetId, placementId: placement.id }));
}

function toCanvasModel(
  packageModel: DrawingModel,
  sheet: DrawingPackageSheet,
  overrides: {
    placements?: DrawingPlacement[];
    connections?: DrawingConnection[];
  } = {}
): DrawingSheetCanvasModel {
  return {
    sheet: {
      ...sheet.page,
      titleBlock: packageModel.titleBlock
    },
    placements: overrides.placements ?? sheet.placements,
    connections: overrides.connections ?? sheet.connections,
    annotations: sheet.annotations
  };
}

function connectionUsesPlacement(
  connection: DrawingConnection,
  placementIds: ReadonlySet<string>
): boolean {
  return Boolean(
    (connection.cablePlacementId && placementIds.has(connection.cablePlacementId)) ||
      placementIds.has(connection.from.placementId) ||
      placementIds.has(connection.to.placementId)
  );
}

function idsMatch(first: string | undefined, second: string | undefined): boolean {
  return Boolean(
    first &&
      second &&
      first.trim().toUpperCase() === second.trim().toUpperCase()
  );
}

export function shouldKeepAssetLinkedForDuplicate({
  placement,
  symbol,
  duplicateMode
}: {
  placement: DrawingPlacement;
  symbol?: ApprovedDrawingSymbol;
  duplicateMode: AssetDuplicateMode;
}): boolean {
  if (duplicateMode === "same-system") {
    return shouldKeepAssetLinkedOnSheetDuplicate({ placement, symbol });
  }

  return placement.role === "enclosure";
}

export function resolveCopiedPlacementAsset({
  model,
  placement,
  symbols,
  duplicateMode,
  reservedTags,
  assetMapping,
  newPlacementId,
  createNewPhysicalAsset = false
}: {
  model: DrawingModel;
  placement: DrawingPlacement;
  symbols: ApprovedDrawingSymbol[];
  duplicateMode: AssetDuplicateMode;
  reservedTags: Set<string>;
  assetMapping: CopiedAssetResolutionMap;
  newPlacementId: string;
  createNewPhysicalAsset?: boolean;
}): CopiedAssetResolution {
  if (isNonAssetDrawingPlacement(placement)) {
    return {
      assetId: undefined,
      tag: placement.tag,
      linked: true
    };
  }

  const sourceAssetId = placementAssetId(placement);
  const mapped = assetMapping.get(sourceAssetId);

  if (mapped) {
    reservedTags.add(mapped.tag);
    return {
      ...mapped,
      linked: false
    };
  }

  if (placement.layoutKind) {
    return {
      assetId: placement.assetId,
      tag: placement.tag,
      linked: true
    };
  }

  const symbol = getSymbolForPackagePlacement(placement, symbols);
  const linked = shouldKeepAssetLinkedForDuplicate({
    placement,
    symbol,
    duplicateMode
  });
  if (createNewPhysicalAsset) {
    const tag = allocateNextPlacementTag(model, placement, symbols, { reservedTags });
    const next = {
      assetId: createDrawingAssetId(newPlacementId),
      tag,
      sourceAssetId
    };

    assetMapping.set(`physical-copy:${newPlacementId}`, next);
    reservedTags.add(tag);

    return {
      assetId: next.assetId,
      tag: next.tag,
      linked: false
    };
  }

  if (linked) {
    return {
      assetId: sourceAssetId,
      tag: placement.tag,
      linked: true
    };
  }

  const tag = allocateNextPlacementTag(model, placement, symbols, { reservedTags });
  const next = {
    assetId: createDrawingAssetId(newPlacementId),
    tag
  };

  assetMapping.set(sourceAssetId, next);
  reservedTags.add(tag);

  return {
    ...next,
    linked: false
  };
}

export function buildCompatibleAssetRelinkOptions(
  model: DrawingModel,
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): CompatibleAssetRelinkOptions {
  const assetId = placementAssetId(placement);
  const catalog = buildDrawingAssetCatalog(model, symbols);
  const currentAsset = catalog.find((asset) => asset.assetId === assetId);
  const compatibleAssets = catalog.filter(
    (asset) =>
      asset.assetId !== assetId &&
      asset.symbolId === placement.symbolId &&
      asset.versionId === placement.versionId
  );

  return {
    currentAsset,
    compatibleAssets,
    linkedOccurrences:
      currentAsset?.placementRefs.map((reference) => ({
        ...reference,
        assetId
      })) ?? [],
    proposedTag: allocateNextPlacementTag(model, placement, symbols)
  };
}

function applyAssetRelink({
  model,
  targets,
  assetId,
  tag,
  symbols
}: {
  model: DrawingModel;
  targets: DrawingAssetPlacementTarget[];
  assetId: string;
  tag: string;
  symbols: ApprovedDrawingSymbol[];
}): DrawingModel {
  if (targets.length === 0 || !tag.trim()) {
    return model;
  }

  const targetSet = new Set(targets.map(targetKey));
  const normalizedTag = tag.trim();

  return {
    ...model,
    sheets: model.sheets.map((sheet) => {
      const targetPlacements = sheet.placements.filter((placement) =>
        placementMatchesTarget(sheet.id, placement, targetSet)
      );

      if (targetPlacements.length === 0) {
        return sheet;
      }

      const linkedCablePlacementIds = new Set(
        targetPlacements
          .filter((placement) => placement.role === "cable_assembly")
          .map((placement) => placement.id)
      );
      const nextPlacements = sheet.placements.map((placement) =>
        placementMatchesTarget(sheet.id, placement, targetSet)
          ? { ...placement, assetId, tag: normalizedTag }
          : placement
      );

      if (linkedCablePlacementIds.size === 0) {
        return {
          ...sheet,
          placements: nextPlacements
        };
      }

      const beforeCanvas = toCanvasModel(model, sheet);
      const afterCanvas = toCanvasModel(model, sheet, {
        placements: nextPlacements
      });
      const nextConnections = sheet.connections.map((connection) => {
        if (!connectionUsesPlacement(connection, linkedCablePlacementIds)) {
          return connection;
        }

        const oldDerivedWireId = deriveWireId(beforeCanvas, symbols, connection);
        const newDerivedWireId = deriveWireId(afterCanvas, symbols, connection);

        return idsMatch(connection.wireId, oldDerivedWireId)
          ? { ...connection, wireId: newDerivedWireId }
          : connection;
      });

      return {
        ...sheet,
        placements: nextPlacements,
        connections: nextConnections
      };
    })
  };
}

export function relinkPlacementsToNewAsset(
  model: DrawingModel,
  placementTargets: Array<DrawingAssetPlacementTarget | string>,
  newTag: string,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const targets = normalizeTargets(model, placementTargets);

  assertUniqueAssetTag(model, newTag);

  const newAssetId = createDrawingAssetId();
  const sourceAssetId = targets
    .map((target) =>
      model.sheets
        .find((sheet) => sheet.id === target.sheetId)
        ?.placements.find((placement) => placement.id === target.placementId)
        ?.assetId
    )
    .find((assetId): assetId is string => Boolean(assetId));
  const sourceAsset = model.assets?.find((asset) => asset.id === sourceAssetId);

  const relinked = applyAssetRelink({
    model,
    targets,
    assetId: newAssetId,
    tag: newTag,
    symbols
  });

  if (!sourceAsset) {
    return relinked;
  }

  if (sourceAsset.terminalStrip) {
    throw new Error(
      "Use Reuse terminal strip to create an independent physical terminal strip."
    );
  }

  return {
    ...relinked,
    assets: [
      ...(relinked.assets ?? []),
      {
        ...sourceAsset,
        id: newAssetId,
        tag: newTag.trim(),
        engineeringAttributes: cloneEngineeringAttributesForNewAsset({
          container: sourceAsset.engineeringAttributes,
          assetType: sourceAsset.type
        })
      }
    ]
  };
}

export function createNewAssetFromPlacement(
  model: DrawingModel,
  placementId: string,
  options: {
    symbols: ApprovedDrawingSymbol[];
    tag?: string;
    placementTargets?: Array<DrawingAssetPlacementTarget | string>;
  }
): DrawingModel {
  const placement = findPlacementById(model, placementId);

  if (!placement) {
    return model;
  }

  return relinkPlacementsToNewAsset(
    model,
    options.placementTargets ?? [placementId],
    options.tag ?? allocateNextPlacementTag(model, placement, options.symbols),
    options.symbols
  );
}

export function relinkPlacementsToExistingAsset(
  model: DrawingModel,
  placementTargets: Array<DrawingAssetPlacementTarget | string>,
  targetAssetId: string,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const targetAsset = buildDrawingAssetCatalog(model, symbols).find(
    (asset) => asset.assetId === targetAssetId
  );

  if (!targetAsset) {
    return model;
  }

  return applyAssetRelink({
    model,
    targets: normalizeTargets(model, placementTargets),
    assetId: targetAsset.assetId,
    tag: targetAsset.tag,
    symbols
  });
}

export function uniquePlacementTargets(
  targets: DrawingAssetPlacementTarget[]
): DrawingAssetPlacementTarget[] {
  const unique = new Map<string, DrawingAssetPlacementTarget>();

  targets.forEach((target) => {
    unique.set(targetKey(target), target);
  });

  return [...unique.values()];
}

export function assetTagSortKey(tag: string): string {
  return normalizeAssetTag(tag);
}
