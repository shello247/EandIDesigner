import {
  getApprovedNetworkSymbolSvgAsset as getApprovedNetworkSymbolSvgAssetQuery,
  listApprovedNetworkSymbolVersionsByIds as listApprovedNetworkSymbolVersionsByIdsQuery,
  listDrawingSymbolCatalogSummaries as listDrawingSymbolCatalogSummariesQuery,
  listDrawingSymbolVersions,
  listDrawingSymbolVersionsByIds,
  listNetworkSymbolCatalog,
  listNetworkSymbolVersions,
  listSymbolIdentitiesByIds
} from "../data/queries";
import type { SaveSymbolDraftInput } from "../data/schema";
import type {
  ApprovedNetworkSymbol,
  ApprovedNetworkSymbolCatalogItem
} from "../logic/services/network-symbol-catalog";

export type { ApprovedNetworkSymbol, ApprovedNetworkSymbolCatalogItem };

export type {
  AnchorKind,
  DrawingSymbolCatalogCapabilities,
  DrawingSymbolCatalogSummary,
  DrawingSymbolVersionIds,
  NetworkDeviceType,
  NetworkPortMedia,
  SaveSymbolDraftInput,
  SymbolAnchor,
  SymbolCategory,
  SymbolLayoutMetadata,
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolElectricalTopology,
  SymbolPermanentContinuityGroup,
  SymbolNetworkPort,
  SymbolNetworkProfile,
  SymbolPanelCategory,
  SymbolPanelMountingType,
  SymbolPanelWiringAssetType,
  SymbolPanelWiringCapability,
  SymbolTerminal,
  SymbolTerminalPanelSide,
  SymbolTechnicalKind,
  ValidationIssue
} from "../data/schema";
export {
  drawingSymbolCatalogCapabilitiesSchema,
  drawingSymbolCatalogSummarySchema,
  drawingSymbolVersionIdsSchema,
  networkDeviceTypeSchema,
  networkPortMediaSchema,
  symbolCategorySchema,
  symbolTechnicalKindSchema,
  symbolMetadataSchema,
  symbolElectricalTopologySchema,
  symbolPermanentContinuityGroupSchema,
  symbolPanelWiringAssetTypeSchema,
  symbolPanelWiringCapabilitySchema,
  symbolTerminalPanelSideSchema,
  parseMetadataJson,
  stringifyMetadata
} from "../data/schema";

export async function saveSymbolDraftToRegistry(input: SaveSymbolDraftInput) {
  const { saveSymbolDraft } = await import("../data/mutations");
  return saveSymbolDraft(input);
}

export async function listSymbolsForDrawing(
  referencedVersionIds: readonly string[] = []
) {
  return listDrawingSymbolVersions(referencedVersionIds);
}

export async function listApprovedSymbolsForDrawing(
  referencedVersionIds: readonly string[] = []
) {
  return listDrawingSymbolVersions(referencedVersionIds);
}

export async function listDrawingRenderSymbols(
  referencedVersionIds: readonly string[]
) {
  return listDrawingSymbolVersionsByIds(referencedVersionIds);
}

export async function listDrawingSymbolCatalogSummaries() {
  return listDrawingSymbolCatalogSummariesQuery();
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

export { listSymbolIdentitiesByIds };
export type { SymbolIdentity } from "../types";
export type { SymbolCategorySummary } from "@/features/symbol_categories/api/public";
export {
  symbolElectricalTopologySignature,
  validateSymbolElectricalTopology,
  type SymbolElectricalTopologyValidation
} from "../logic/services/symbol-electrical-topology";
