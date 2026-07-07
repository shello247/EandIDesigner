import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID,
  isGeneratedTerminalBlockReference,
  normalizeTerminalBlockPlacement,
  terminalBlockMetadata
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { renderTerminalBlockSvg } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-renderer";
import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  createGeneratedBackplaneLibrarySymbol,
  isBackplanePlacement
} from "./drawing-backplane-layouts";

export function packageSymbolKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

export function isGeneratedTerminalBlockPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  terminalBlock: NonNullable<DrawingPlacement["terminalBlock"]>;
} {
  return Boolean(
    placement &&
      isGeneratedTerminalBlockReference(placement) &&
      placement.terminalBlock
  );
}

export function createGeneratedTerminalBlockSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  if (!isGeneratedTerminalBlockPlacement(placement)) {
    return undefined;
  }

  const terminalBlock = normalizeTerminalBlockPlacement(placement.terminalBlock);

  return {
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    symbolKey: "generated_modular_terminal_block",
    displayName: "Modular Terminal Block",
    category: "terminal_block",
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    versionNumber: 1,
    svg: renderTerminalBlockSvg(terminalBlock),
    metadata: terminalBlockMetadata(terminalBlock)
  };
}

export function createGeneratedBackplaneSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  return isBackplanePlacement(placement)
    ? createGeneratedBackplaneLibrarySymbol()
    : undefined;
}

export function getRenderableSymbolForPlacement(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  if (!placement) {
    return undefined;
  }

  return (
    createGeneratedTerminalBlockSymbol(placement) ??
    createGeneratedBackplaneSymbol(placement) ??
    symbols.find(
      (symbol) =>
        symbol.symbolId === placement.symbolId &&
        symbol.versionId === placement.versionId
    )
  );
}
