import type {
  DrawingConnection,
  DrawingAssetType,
  DrawingModel as DrawingPackageModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingPlacementRole,
  DrawingSheetCanvasModel
} from "../../data/schema";
import {
  createStablePlacementAssetId,
  isNonAssetDrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID,
  PANEL_ENCLOSURE_TAG_PREFIX
} from "./drawing-enclosure-constants";
import {
  isGeneratedTerminalBlockReference,
  TERMINAL_BLOCK_TAG_PREFIX
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { getRenderableSymbolForPlacement } from "./drawing-generated-symbols";
import { deriveWireId } from "./drawing-identification";

const TAG_STEP_PATTERN = /^([A-Z]{1,6})-(\d{1,5})([A-Z]?)$/i;

export type DrawingAssetPlacementRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
  placementId: string;
};

export type DrawingAssetCatalogItem = {
  assetId: string;
  tag: string;
  normalizedTag: string;
  role: DrawingPlacementRole;
  symbolId: string;
  versionId: string;
  symbolKey?: string;
  symbolName?: string;
  category?: ApprovedDrawingSymbol["category"];
  placementRefs: DrawingAssetPlacementRef[];
};

export type DuplicateAssetTagWarning = {
  tag: string;
  normalizedTag: string;
  assetIds: string[];
  placementRefs: Array<DrawingAssetPlacementRef & { assetId: string }>;
};

export type DrawingAssetTagConflict = {
  assetId: string;
  tag: string;
  source: "asset" | "placement";
  sheetId?: string;
  sheetName?: string;
  sheetNumber?: number;
  placementId?: string;
};

export type SteppableTag = {
  prefix: string;
  number: number;
  width: number;
  suffix: string;
};

export function placementAssetId(placement: DrawingPlacement): string {
  return placement.assetId?.trim() || createStablePlacementAssetId(placement.id);
}

export function createDrawingAssetId(seed?: string): string {
  if (seed) {
    return createStablePlacementAssetId(seed);
  }

  const randomPart =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return `asset_${randomPart.replace(/[^A-Za-z0-9_]+/g, "_")}`;
}

export function roleFromSymbolCategory(
  category: ApprovedDrawingSymbol["category"]
): DrawingPlacementRole {
  if (category === "cable_assembly") {
    return "cable_assembly";
  }

  if (category === "terminal_block") {
    return "terminal_block";
  }

  if (category === "instrument" || category === "monitor") {
    return "device";
  }

  return "other";
}

function symbolDescriptor(symbol: ApprovedDrawingSymbol): string {
  return `${symbol.symbolKey} ${symbol.model ?? ""} ${symbol.displayName}`.toUpperCase();
}

export function isGeneratedPanelEnclosureSymbolReference(input: {
  symbolId: string;
  versionId: string;
}): boolean {
  return (
    input.symbolId === GENERATED_PANEL_ENCLOSURE_SYMBOL_ID &&
    input.versionId === GENERATED_PANEL_ENCLOSURE_VERSION_ID
  );
}

export function isBreakerLikeSymbol(
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  if (!symbol) {
    return false;
  }

  const descriptor = symbolDescriptor(symbol);

  return (
    descriptor.includes("MINIATURE CIRCUIT BREAKER") ||
    descriptor.includes("CIRCUIT BREAKER") ||
    descriptor.includes("BREAKER") ||
    descriptor.includes("MCB")
  );
}

export function roleFromSymbol(symbol: ApprovedDrawingSymbol): DrawingPlacementRole {
  if (isBreakerLikeSymbol(symbol)) {
    return "device";
  }

  return roleFromSymbolCategory(symbol.category);
}

export function defaultPlacementScale(symbol: ApprovedDrawingSymbol): number {
  if (symbol.category === "cable_assembly") {
    return 0.5;
  }

  if (symbol.category === "monitor") {
    return 0.36;
  }

  return 0.34;
}

export function tagPrefixForSymbol(symbol: ApprovedDrawingSymbol): string {
  const descriptor = symbolDescriptor(symbol);

  if (
    descriptor.includes("MINIATURE CIRCUIT BREAKER") ||
    descriptor.includes("CIRCUIT BREAKER") ||
    descriptor.includes("MCB")
  ) {
    return "MCB";
  }

  if (symbol.category === "cable_assembly") {
    return "C";
  }

  if (symbol.category === "terminal_block") {
    return "TB";
  }

  if (symbol.category === "monitor") {
    return "TSM";
  }

  if (symbol.category === "instrument") {
    if (descriptor.includes("NMT") || descriptor.includes("TEMP")) {
      return "TT";
    }

    if (
      descriptor.includes("FMP") ||
      descriptor.includes("RADAR") ||
      descriptor.includes("LEVEL")
    ) {
      return "LIT";
    }

    return "INST";
  }

  return "EQ";
}

export function normalizeAssetTag(tag: string | undefined): string {
  return tag?.trim().toUpperCase() ?? "";
}

export function findAssetTagConflict(
  model: DrawingPackageModel,
  tag: string,
  options: { allowedAssetIds?: Iterable<string> } = {}
): DrawingAssetTagConflict | null {
  const normalizedTag = normalizeAssetTag(tag);
  const allowedAssetIds = new Set(options.allowedAssetIds ?? []);

  if (!normalizedTag) {
    return null;
  }

  for (const asset of model.assets ?? []) {
    if (
      normalizeAssetTag(asset.tag) === normalizedTag &&
      !allowedAssetIds.has(asset.id)
    ) {
      return {
        assetId: asset.id,
        tag: asset.tag,
        source: "asset"
      };
    }
  }

  for (const [sheetIndex, sheet] of model.sheets.entries()) {
    for (const placement of sheet.placements) {
      if (placement.layoutKind || isNonAssetDrawingPlacement(placement)) {
        continue;
      }

      const assetId = placementAssetId(placement);

      if (
        normalizeAssetTag(placement.tag) === normalizedTag &&
        !allowedAssetIds.has(assetId)
      ) {
        return {
          assetId,
          tag: placement.tag,
          source: "placement",
          sheetId: sheet.id,
          sheetName: sheet.name,
          sheetNumber: sheetIndex + 1,
          placementId: placement.id
        };
      }
    }
  }

  return null;
}

export function formatAssetTagConflictMessage(
  tag: string,
  conflict: DrawingAssetTagConflict
): string {
  const sheetContext =
    conflict.sheetNumber && conflict.sheetName
      ? ` It appears on Sheet ${conflict.sheetNumber} - ${conflict.sheetName}.`
      : "";

  return `${tag.trim()} is already used by another asset.${sheetContext} Reference the existing asset or choose a unique tag.`;
}

export function assertUniqueAssetTag(
  model: DrawingPackageModel,
  tag: string,
  options: { allowedAssetIds?: Iterable<string> } = {}
): void {
  const conflict = findAssetTagConflict(model, tag, options);

  if (conflict) {
    throw new Error(formatAssetTagConflictMessage(tag, conflict));
  }
}

export function parseSteppableTag(tag: string): SteppableTag | null {
  const match = tag.trim().match(TAG_STEP_PATTERN);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1].toUpperCase(),
    number: Number(match[2]),
    width: match[2].length,
    suffix: match[3].toUpperCase()
  };
}

export function stepEngineeringTag(
  tag: string,
  direction: -1 | 1
): string | null {
  const parsed = parseSteppableTag(tag);

  if (!parsed) {
    return null;
  }

  const nextNumber = Math.max(1, parsed.number + direction);

  return `${parsed.prefix}-${String(nextNumber).padStart(parsed.width, "0")}${parsed.suffix}`;
}

export function getSymbolForPackagePlacement(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  return getRenderableSymbolForPlacement(placement, symbols);
}

function allPackageTags(model: DrawingPackageModel): string[] {
  return [
    ...(model.assets ?? []).map((asset) => asset.tag),
    ...model.sheets.flatMap((sheet) =>
      sheet.placements.map((placement) => placement.tag)
    )
  ];
}

function existingTagSet(
  model: DrawingPackageModel,
  reservedTags?: Iterable<string>
): Set<string> {
  const existing = new Set(allPackageTags(model).map(normalizeAssetTag));

  for (const reservedTag of reservedTags ?? []) {
    const normalized = normalizeAssetTag(reservedTag);

    if (normalized) {
      existing.add(normalized);
    }
  }

  return existing;
}

export function allocateNextTagFromPrefix({
  model,
  prefix,
  reservedTags
}: {
  model: DrawingPackageModel;
  prefix: string;
  reservedTags?: Iterable<string>;
}): string {
  const normalizedPrefix =
    prefix.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "") || "EQ";
  const existing = existingTagSet(model, reservedTags);

  for (let index = 101; index < 10000; index += 1) {
    const candidate = `${normalizedPrefix}-${String(index).padStart(3, "0")}`;

    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${normalizedPrefix}-${Date.now()}`;
}

export function allocateNextPackageTag(
  model: DrawingPackageModel,
  symbol: ApprovedDrawingSymbol,
  options: { reservedTags?: Iterable<string> } = {}
): string {
  return allocateNextTagFromPrefix({
    model,
    prefix: tagPrefixForSymbol(symbol),
    reservedTags: options.reservedTags
  });
}

export function allocateNextPlacementTag(
  model: DrawingPackageModel,
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[],
  options: { reservedTags?: Iterable<string> } = {}
): string {
  if (
    placement.role === "enclosure" ||
    isGeneratedPanelEnclosureSymbolReference(placement)
  ) {
    return allocateNextTagFromPrefix({
      model,
      prefix: PANEL_ENCLOSURE_TAG_PREFIX,
      reservedTags: options.reservedTags
    });
  }

  if (isGeneratedTerminalBlockReference(placement)) {
    return allocateNextTagFromPrefix({
      model,
      prefix: TERMINAL_BLOCK_TAG_PREFIX,
      reservedTags: options.reservedTags
    });
  }

  const symbol = getSymbolForPackagePlacement(placement, symbols);
  const prefix =
    symbol ? tagPrefixForSymbol(symbol) : parseSteppableTag(placement.tag)?.prefix;

  if (prefix) {
    return allocateNextTagFromPrefix({
      model,
      prefix,
      reservedTags: options.reservedTags
    });
  }

  return uniquePackageTag(model, placement.tag, options.reservedTags);
}

export function uniquePackageTag(
  model: DrawingPackageModel,
  baseTag: string,
  reservedTags?: Iterable<string>
): string {
  const normalizedBase =
    baseTag.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") ||
    "SYM";
  const existing = existingTagSet(model, reservedTags);

  if (!existing.has(normalizeAssetTag(normalizedBase))) {
    return normalizedBase;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalizedBase}_${index}`;

    if (!existing.has(normalizeAssetTag(candidate))) {
      return candidate;
    }
  }

  return `${normalizedBase}_${Date.now()}`;
}

export function canReferenceExistingAsset(
  symbol: ApprovedDrawingSymbol
): boolean {
  return symbol.category !== "cable_assembly";
}

export function shouldKeepAssetLinkedOnSheetDuplicate({
  placement,
  symbol
}: {
  placement: DrawingPlacement;
  symbol?: ApprovedDrawingSymbol;
}): boolean {
  if (
    placement.role === "enclosure" ||
    isGeneratedPanelEnclosureSymbolReference(placement)
  ) {
    return true;
  }

  if (isBreakerLikeSymbol(symbol)) {
    return false;
  }

  if (isGeneratedTerminalBlockReference(placement)) {
    return false;
  }

  if (symbol?.category === "monitor" || symbol?.category === "terminal_block") {
    return true;
  }

  if (placement.role === "terminal_block") {
    return true;
  }

  return /^TSM-\d/i.test(placement.tag.trim());
}

export function buildDrawingAssetCatalog(
  model: DrawingPackageModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingAssetCatalogItem[] {
  const catalog = new Map<string, DrawingAssetCatalogItem>();
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

  (model.assets ?? []).forEach((asset) => {
    if (nonAssetLayoutHelperIds.has(asset.id)) {
      return;
    }

    const symbol = symbols.find(
      (candidate) =>
        candidate.symbolId === asset.symbolId &&
        candidate.versionId === asset.versionId
    );

    catalog.set(asset.id, {
      assetId: asset.id,
      tag: asset.tag,
      normalizedTag: normalizeAssetTag(asset.tag),
      role: roleFromAssetType(asset.type),
      symbolId: asset.symbolId ?? "",
      versionId: asset.versionId ?? "",
      symbolKey: asset.metadata?.symbolKey ?? symbol?.symbolKey,
      symbolName: symbol?.displayName ?? asset.title,
      category: symbol?.category,
      placementRefs: []
    });
  });

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      if (isNonAssetDrawingPlacement(placement)) {
        return;
      }

      const assetId = placementAssetId(placement);
      const symbol = getSymbolForPackagePlacement(placement, symbols);
      const placementRef: DrawingAssetPlacementRef = {
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1,
        placementId: placement.id
      };
      const current = catalog.get(assetId);

      if (current) {
        current.placementRefs.push(placementRef);
        current.symbolId ||= placement.symbolId;
        current.versionId ||= placement.versionId;
        current.symbolKey ||= symbol?.symbolKey;
        current.symbolName ||= symbol?.displayName;
        current.category ||= symbol?.category;
        return;
      }

      catalog.set(assetId, {
        assetId,
        tag: placement.tag,
        normalizedTag: normalizeAssetTag(placement.tag),
        role: placement.role,
        symbolId: placement.symbolId,
        versionId: placement.versionId,
        symbolKey: symbol?.symbolKey,
        symbolName: symbol?.displayName,
        category: symbol?.category,
        placementRefs: [placementRef]
      });
    });
  });

  return [...catalog.values()].sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, { numeric: true })
  );
}

function roleFromAssetType(type: DrawingAssetType): DrawingPlacementRole {
  if (type === "cable") {
    return "cable_assembly";
  }

  if (type === "panel" || type === "junction_box") {
    return "enclosure";
  }

  if (type === "terminal_block") {
    return "terminal_block";
  }

  if (
    type === "instrument" ||
    type === "controller" ||
    type === "breaker" ||
    type === "fuse" ||
    type === "relay" ||
    type === "power_supply" ||
    type === "isolator" ||
    type === "converter" ||
    type === "io_module" ||
    type === "earth_bar"
  ) {
    return "device";
  }

  return "other";
}

export function getCompatibleReferenceAssets(
  model: DrawingPackageModel,
  symbols: ApprovedDrawingSymbol[],
  symbol: ApprovedDrawingSymbol
): DrawingAssetCatalogItem[] {
  const compatibleAssets = buildDrawingAssetCatalog(model, symbols).filter(
    (asset) =>
      asset.symbolId === symbol.symbolId && asset.versionId === symbol.versionId
  );

  if (canReferenceExistingAsset(symbol)) {
    return compatibleAssets;
  }

  return compatibleAssets.filter((asset) => asset.placementRefs.length === 0);
}

export function detectDuplicatePlacementTags(
  model: DrawingPackageModel
): DuplicateAssetTagWarning[] {
  const groups = new Map<
    string,
    {
      tag: string;
      assetIds: Set<string>;
      placementRefs: Array<DrawingAssetPlacementRef & { assetId: string }>;
    }
  >();

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      if (placement.layoutKind || isNonAssetDrawingPlacement(placement)) {
        return;
      }

      const normalizedTag = normalizeAssetTag(placement.tag);

      if (!normalizedTag) {
        return;
      }

      const assetId = placementAssetId(placement);
      const group =
        groups.get(normalizedTag) ??
        {
          tag: placement.tag,
          assetIds: new Set<string>(),
          placementRefs: []
        };

      group.assetIds.add(assetId);
      group.placementRefs.push({
        assetId,
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetNumber: sheetIndex + 1,
        placementId: placement.id
      });
      groups.set(normalizedTag, group);
    });
  });

  return [...groups.entries()]
    .filter(([, group]) => group.assetIds.size > 1)
    .map(([normalizedTag, group]) => ({
      tag: group.tag,
      normalizedTag,
      assetIds: [...group.assetIds],
      placementRefs: group.placementRefs
    }));
}

function toCanvasModel(
  packageModel: DrawingPackageModel,
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

export function renameDrawingAssetTag(
  model: DrawingPackageModel,
  assetId: string,
  nextTag: string,
  symbols: ApprovedDrawingSymbol[]
): DrawingPackageModel {
  const normalizedNextTag = nextTag.trim();

  if (!normalizedNextTag) {
    return model;
  }

  assertUniqueAssetTag(model, normalizedNextTag, {
    allowedAssetIds: [assetId]
  });

  return {
    ...model,
    assets: (model.assets ?? []).map((asset) =>
      asset.id === assetId ? { ...asset, tag: normalizedNextTag } : asset
    ),
    sheets: model.sheets.map((sheet) => {
      const linkedPlacements = sheet.placements.filter(
        (placement) => placementAssetId(placement) === assetId
      );

      if (linkedPlacements.length === 0) {
        return sheet;
      }

      const linkedCablePlacementIds = new Set(
        linkedPlacements
          .filter((placement) => placement.role === "cable_assembly")
          .map((placement) => placement.id)
      );
      const nextPlacements = sheet.placements.map((placement) =>
        placementAssetId(placement) === assetId
          ? { ...placement, assetId, tag: normalizedNextTag }
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

        if (!idsMatch(connection.wireId, oldDerivedWireId)) {
          return connection;
        }

        return {
          ...connection,
          wireId: newDerivedWireId
        };
      });

      return {
        ...sheet,
        placements: nextPlacements,
        connections: nextConnections
      };
    })
  };
}
