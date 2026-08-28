import {
  createStablePlacementAssetId,
  type DrawingAssetRecord,
  type DrawingModel,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

const NETWORK_DEVICE_CATEGORY = "network device";
const LEGACY_NETWORK_DEVICE_CATEGORY_ID = "symbol_category_network_device";

function symbolReferenceKey(input: {
  symbolId?: string;
  versionId?: string;
}): string | undefined {
  return input.symbolId && input.versionId
    ? `${input.symbolId}::${input.versionId}`
    : undefined;
}

export function isNetworkDeviceDrawingSymbol(
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  if (!symbol) {
    return false;
  }

  const managedCategory = symbol.managedCategory?.name
    .trim()
    .toLocaleLowerCase("en-US");

  return (
    symbol.managedCategory?.id === LEGACY_NETWORK_DEVICE_CATEGORY_ID ||
    managedCategory === NETWORK_DEVICE_CATEGORY ||
    symbol.technicalKind === "network_device" ||
    symbol.category === "network_device" ||
    symbol.metadata.category === "network_device" ||
    symbol.metadata.panelWiring?.assetType === "network_device"
  );
}

function createNetworkDeviceAsset(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol,
  assetId: string
): DrawingAssetRecord {
  return {
    id: assetId,
    tag: placement.tag,
    type: "network_device",
    title: placement.title?.trim() || symbol.displayName,
    symbolId: placement.symbolId,
    versionId: placement.versionId,
    metadata: { symbolKey: symbol.symbolKey }
  };
}

/**
 * Upgrades legacy panel-layout network symbols that were stored as
 * role=other/layout_helper because network_device was not yet a managed asset
 * type. The projection is idempotent and preserves existing asset identities.
 */
export function normalizeNetworkDeviceDrawingAssets(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): DrawingModel {
  const symbolsByReference = new Map(
    symbols.flatMap((symbol) => {
      const key = symbolReferenceKey(symbol);
      return key ? [[key, symbol] as const] : [];
    })
  );
  let changed = false;
  const assetsById = new Map<string, DrawingAssetRecord>();

  for (const asset of model.assets ?? []) {
    const key = symbolReferenceKey(asset);
    const symbol = key ? symbolsByReference.get(key) : undefined;
    const nextAsset =
      isNetworkDeviceDrawingSymbol(symbol) && asset.type !== "network_device"
        ? { ...asset, type: "network_device" as const }
        : asset;

    changed ||= nextAsset !== asset;
    assetsById.set(nextAsset.id, nextAsset);
  }

  const sheets = model.sheets.map((sheet) => {
    let sheetChanged = false;
    const placements = sheet.placements.map((placement) => {
      const key = symbolReferenceKey(placement);
      const symbol = key ? symbolsByReference.get(key) : undefined;

      if (!isNetworkDeviceDrawingSymbol(symbol) || !symbol) {
        return placement;
      }

      const assetId =
        placement.assetId?.trim() || createStablePlacementAssetId(placement.id);
      const nextPlacement =
        placement.role === "device" && placement.assetId === assetId
          ? placement
          : { ...placement, assetId, role: "device" as const };

      if (!assetsById.has(assetId)) {
        assetsById.set(
          assetId,
          createNetworkDeviceAsset(nextPlacement, symbol, assetId)
        );
        changed = true;
      }

      sheetChanged ||= nextPlacement !== placement;
      changed ||= nextPlacement !== placement;
      return nextPlacement;
    });

    return sheetChanged ? { ...sheet, placements } : sheet;
  });

  if (!changed) {
    return model;
  }

  return {
    ...model,
    assets: [...assetsById.values()],
    sheets
  };
}
