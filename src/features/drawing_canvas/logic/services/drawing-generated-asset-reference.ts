import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID
} from "@/features/drawing_terminal_blocks/api/generated-contracts";
import {
  GENERATED_PANEL_ENCLOSURE_SYMBOL_ID,
  GENERATED_PANEL_ENCLOSURE_VERSION_ID
} from "./drawing-enclosure-constants";

export function structuredTerminalStripSymbolId(assetId: string): string {
  return `__generated_structured_terminal_strip__:${assetId}`;
}

export function structuredTerminalStripVersionId(assetId: string): string {
  return `generated_structured_terminal_strip_v1:${assetId}`;
}

type AssetReference = {
  id: string;
  type: string;
  symbolId?: string;
  versionId?: string;
  terminalStrip?: unknown;
};

/** Recognize only built-in identity/version pairs with their owning asset type.
 * Metadata labels and arbitrary generated-looking prefixes are not authority. */
export function isGeneratedDrawingAssetReference(asset: AssetReference): boolean {
  if (asset.type === "panel" || asset.type === "junction_box") {
    return asset.symbolId === GENERATED_PANEL_ENCLOSURE_SYMBOL_ID &&
      asset.versionId === GENERATED_PANEL_ENCLOSURE_VERSION_ID;
  }
  if (asset.type !== "terminal_block") return false;
  return (asset.symbolId === GENERATED_TERMINAL_BLOCK_SYMBOL_ID &&
    asset.versionId === GENERATED_TERMINAL_BLOCK_VERSION_ID) ||
    (Boolean(asset.terminalStrip) &&
      asset.symbolId === structuredTerminalStripSymbolId(asset.id) &&
      asset.versionId === structuredTerminalStripVersionId(asset.id));
}
