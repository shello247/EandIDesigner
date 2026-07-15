import {
  DEFAULT_TERMINAL_BLOCK_COUNT,
  DEFAULT_TERMINAL_BLOCK_MODULE_HEIGHT,
  DEFAULT_TERMINAL_BLOCK_MODULE_WIDTH
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type { ApprovedDrawingSymbol } from "../../types";

export const GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_ID =
  "__generated_terminal_block_group_builder__";
export const GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_VERSION_ID =
  "generated_terminal_block_group_builder_v1";
export const GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY =
  "generated_terminal_block_group";
export const TERMINAL_BLOCK_GROUP_LIBRARY_LABEL = "Terminal Block Group";

export function createGeneratedTerminalBlockGroupLibrarySymbol(): ApprovedDrawingSymbol {
  const width = DEFAULT_TERMINAL_BLOCK_COUNT * DEFAULT_TERMINAL_BLOCK_MODULE_WIDTH;
  const height = DEFAULT_TERMINAL_BLOCK_MODULE_HEIGHT;

  return {
    symbolId: GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_ID,
    symbolKey: GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY,
    displayName: TERMINAL_BLOCK_GROUP_LIBRARY_LABEL,
    category: "terminal_block",
    versionId: GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_VERSION_ID,
    versionNumber: 1,
    svg: `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="none"/></svg>`,
    metadata: {
      symbolKey: GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_KEY,
      displayName: TERMINAL_BLOCK_GROUP_LIBRARY_LABEL,
      category: "terminal_block",
      layoutUsage: "panel_layout",
      panelCategory: "termination",
      mountingType: "backplate",
      resizable: false,
      physicalWidthMm: 26,
      physicalHeightMm: 50,
      viewBox: { x: 0, y: 0, width, height },
      anchors: [],
      terminals: []
    }
  };
}

export function isGeneratedTerminalBlockGroupLibrarySymbolReference(
  input: { symbolId: string; versionId: string } | undefined
): boolean {
  return Boolean(
    input &&
      input.symbolId === GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_SYMBOL_ID &&
      input.versionId === GENERATED_TERMINAL_BLOCK_GROUP_LIBRARY_VERSION_ID
  );
}
