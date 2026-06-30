import { saveSymbolDraft } from "../data/mutations";
import { listApprovedSymbolVersions } from "../data/queries";
import type { SaveSymbolDraftInput } from "../data/schema";

export type {
  AnchorKind,
  SaveSymbolDraftInput,
  SymbolAnchor,
  SymbolCategory,
  SymbolMetadata,
  SymbolTerminal
} from "../data/schema";
export { symbolCategorySchema, symbolMetadataSchema } from "../data/schema";

export async function saveSymbolDraftToRegistry(input: SaveSymbolDraftInput) {
  return saveSymbolDraft(input);
}

export async function listApprovedSymbolsForDrawing() {
  return listApprovedSymbolVersions();
}
