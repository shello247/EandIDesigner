import { saveSymbolDraft } from "../data/mutations";
import {
  getApprovedNetworkSymbolSvgAsset as getApprovedNetworkSymbolSvgAssetQuery,
  listApprovedNetworkSymbolVersionsByIds as listApprovedNetworkSymbolVersionsByIdsQuery,
  listDrawingSymbolVersions,
  listNetworkSymbolCatalog,
  listNetworkSymbolVersions
} from "../data/queries";
import type { SaveSymbolDraftInput } from "../data/schema";
import type {
  ApprovedNetworkSymbol,
  ApprovedNetworkSymbolCatalogItem
} from "../logic/services/network-symbol-catalog";

export type { ApprovedNetworkSymbol, ApprovedNetworkSymbolCatalogItem };

export type {
  AnchorKind,
  NetworkDeviceType,
  NetworkPortMedia,
  SaveSymbolDraftInput,
  SymbolAnchor,
  SymbolCategory,
  SymbolLayoutMetadata,
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolNetworkPort,
  SymbolNetworkProfile,
  SymbolPanelCategory,
  SymbolPanelMountingType,
  SymbolTerminal
} from "../data/schema";
export {
  networkDeviceTypeSchema,
  networkPortMediaSchema,
  symbolCategorySchema,
  symbolMetadataSchema
} from "../data/schema";

export async function saveSymbolDraftToRegistry(input: SaveSymbolDraftInput) {
  return saveSymbolDraft(input);
}

export async function listSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}

export async function listApprovedSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}

export async function listNetworkSymbolCatalogForMapping(): Promise<
  ApprovedNetworkSymbolCatalogItem[]
> {
  return listNetworkSymbolCatalog();
}

export async function listApprovedNetworkSymbolVersionsByIds(
  versionIds: readonly string[]
): Promise<ApprovedNetworkSymbol[]> {
  return listApprovedNetworkSymbolVersionsByIdsQuery(versionIds);
}

export async function getApprovedNetworkSymbolSvgAsset(versionId: string) {
  return getApprovedNetworkSymbolSvgAssetQuery(versionId);
}

/** @deprecated Use the lightweight catalog and referenced-version bulk query. */
export async function listNetworkSymbolsForMapping(): Promise<
  ApprovedNetworkSymbol[]
> {
  return listNetworkSymbolVersions();
}
