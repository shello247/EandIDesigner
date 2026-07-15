import { saveSymbolDraft } from "../data/mutations";
import {
  listDrawingSymbolVersions,
  listSymbolIdentitiesByIds
} from "../data/queries";
import type { SaveSymbolDraftInput } from "../data/schema";

export type {
  AnchorKind,
  SaveSymbolDraftInput,
  SymbolAnchor,
  SymbolCategory,
  SymbolLayoutMetadata,
  SymbolLayoutUsage,
  SymbolMetadata,
  SymbolPanelCategory,
  SymbolPanelMountingType,
  SymbolPanelWiringAssetType,
  SymbolPanelWiringCapability,
  SymbolTerminal,
  SymbolTerminalPanelSide
} from "../data/schema";
export {
  symbolCategorySchema,
  symbolMetadataSchema,
  symbolPanelWiringAssetTypeSchema,
  symbolPanelWiringCapabilitySchema,
  symbolTerminalPanelSideSchema
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

export { listSymbolIdentitiesByIds };
export type { SymbolIdentity } from "../types";
