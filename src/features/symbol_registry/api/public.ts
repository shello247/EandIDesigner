import { saveSymbolDraft } from "../data/mutations";
import { listDrawingSymbolVersions } from "../data/queries";
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
  SymbolTerminal
} from "../data/schema";
export { symbolCategorySchema, symbolMetadataSchema } from "../data/schema";

export async function saveSymbolDraftToRegistry(input: SaveSymbolDraftInput) {
  return saveSymbolDraft(input);
}

export async function listSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}

export async function listApprovedSymbolsForDrawing() {
  return listDrawingSymbolVersions();
}
