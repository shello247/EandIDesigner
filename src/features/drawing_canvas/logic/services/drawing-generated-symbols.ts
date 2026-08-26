import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID,
  isGeneratedTerminalBlockReference,
  normalizeTerminalBlockPlacement,
  terminalBlockMetadata
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { renderTerminalBlockSvg } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-renderer";
import { resolveTerminalBlockModuleForDefinition } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import type { DrawingAssetRecord, DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  composeTerminalStripGeometry,
  projectStructuredTerminalStripTerminals,
  renderStructuredTerminalStripSvg
} from "@/features/drawing_terminal_blocks/api/public";
import {
  createGeneratedBackplaneLibrarySymbol,
  isBackplanePlacement
} from "./drawing-backplane-layouts";
import {
  createGeneratedWireTrayLibrarySymbol,
  isGeneratedWireTraySymbolReference
} from "./drawing-wire-tray-layouts";
import {
  createGeneratedDimensionLibrarySymbols,
  isGeneratedLayoutDimensionSymbolReference
} from "./drawing-layout-dimensions";
import {
  createGeneratedPanelPatternLegendSymbol,
  createGeneratedPanelReferenceSymbol,
  isGeneratedPanelPatternLegendPlacement,
  isGeneratedPanelReferencePlacement
} from "./drawing-panel-reference-symbols";

export function packageSymbolKey(symbolId: string, versionId: string): string {
  return `${symbolId}:${versionId}`;
}

export function structuredTerminalStripSymbolId(assetId: string): string {
  return `__generated_structured_terminal_strip__:${assetId}`;
}

export function structuredTerminalStripVersionId(assetId: string): string {
  return `generated_structured_terminal_strip_v1:${assetId}`;
}

export function isGeneratedStructuredTerminalStripPlacement(
  placement: DrawingPlacement | undefined,
  assets: DrawingAssetRecord[] = []
): boolean {
  if (!placement?.assetId) {
    return false;
  }
  const asset = assets.find((candidate) => candidate.id === placement.assetId);
  return Boolean(
    asset?.terminalStrip &&
      placement.symbolId === structuredTerminalStripSymbolId(asset.id) &&
      placement.versionId === structuredTerminalStripVersionId(asset.id)
  );
}

export function createGeneratedStructuredTerminalStripSymbol(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[],
  assets: DrawingAssetRecord[] = []
): ApprovedDrawingSymbol | undefined {
  if (!placement?.assetId) {
    return undefined;
  }
  const asset = assets.find((candidate) => candidate.id === placement.assetId);
  if (!asset?.terminalStrip || !isGeneratedStructuredTerminalStripPlacement(placement, assets)) {
    return undefined;
  }
  const projection = projectStructuredTerminalStripTerminals(
    asset.terminalStrip,
    symbols
  );
  const geometry = composeTerminalStripGeometry(asset.terminalStrip, symbols);

  return {
    symbolId: structuredTerminalStripSymbolId(asset.id),
    symbolKey: `structured_terminal_strip_${asset.id}`,
    displayName: asset.title,
    category: "terminal_block",
    technicalKind: "terminal_block",
    versionId: structuredTerminalStripVersionId(asset.id),
    versionNumber: 1,
    svg: renderStructuredTerminalStripSvg(asset.terminalStrip, symbols),
    metadata: {
      symbolKey: `structured_terminal_strip_${asset.id}`,
      displayName: asset.title,
      description: asset.description,
      category: "terminal_block",
      layoutUsage: "both",
      physicalWidthMm: geometry.widthMm,
      physicalHeightMm: geometry.heightMm,
      mountingType: "din_rail",
      viewBox: {
        x: 0,
        y: 0,
        width: geometry.widthMm,
        height: geometry.heightMm
      },
      terminals: projection.terminals,
      anchors: projection.anchors,
      electricalTopology: projection.electricalTopology,
      panelWiring: {
        assetType: "terminal_block",
        tagPrefix: "TB",
        schematicScale: 1
      }
    }
  };
}

export function buildRenderableDrawingSymbols({
  placements,
  approvedSymbols,
  assets = []
}: {
  placements: DrawingPlacement[];
  approvedSymbols: ApprovedDrawingSymbol[];
  assets?: DrawingAssetRecord[];
}): ApprovedDrawingSymbol[] {
  const renderableSymbols = [...approvedSymbols];
  const symbolKeys = new Set(
    approvedSymbols.map((symbol) =>
      packageSymbolKey(symbol.symbolId, symbol.versionId)
    )
  );

  for (const placement of placements) {
    const generated = createGeneratedStructuredTerminalStripSymbol(
      placement,
      approvedSymbols,
      assets
    );

    if (!generated) {
      continue;
    }

    const key = packageSymbolKey(generated.symbolId, generated.versionId);
    if (symbolKeys.has(key)) {
      continue;
    }

    symbolKeys.add(key);
    renderableSymbols.push(generated);
  }

  return renderableSymbols;
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
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[] = []
): ApprovedDrawingSymbol | undefined {
  if (!isGeneratedTerminalBlockPlacement(placement)) {
    return undefined;
  }

  const terminalBlock = normalizeTerminalBlockPlacement(placement.terminalBlock);
  const resolvedModule = resolveTerminalBlockModuleForDefinition(
    terminalBlock,
    symbols
  );

  return {
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    symbolKey: "generated_modular_terminal_block",
    displayName: "Modular Terminal Block",
    category: "terminal_block",
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    versionNumber: 1,
    svg: renderTerminalBlockSvg(terminalBlock, {
      module: resolvedModule,
      instanceId: placement.id
    }),
    metadata: terminalBlockMetadata(terminalBlock, resolvedModule)
  };
}

export function createGeneratedBackplaneSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  return isBackplanePlacement(placement)
    ? createGeneratedBackplaneLibrarySymbol()
    : undefined;
}

export function createGeneratedWireTraySymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  return isGeneratedWireTraySymbolReference(placement)
    ? createGeneratedWireTrayLibrarySymbol()
    : undefined;
}

export function createGeneratedLayoutDimensionSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  return createGeneratedDimensionLibrarySymbols().find(
    (symbol) =>
      isGeneratedLayoutDimensionSymbolReference(placement) &&
      symbol.symbolId === placement.symbolId &&
      symbol.versionId === placement.versionId
  );
}

export function getRenderableSymbolForPlacement(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[],
  assets: DrawingAssetRecord[] = []
): ApprovedDrawingSymbol | undefined {
  if (!placement) {
    return undefined;
  }

  return (
    createGeneratedStructuredTerminalStripSymbol(placement, symbols, assets) ??
    createGeneratedTerminalBlockSymbol(placement, symbols) ??
    createGeneratedBackplaneSymbol(placement) ??
    createGeneratedWireTraySymbol(placement) ??
    createGeneratedLayoutDimensionSymbol(placement) ??
    (isGeneratedPanelReferencePlacement(placement)
      ? createGeneratedPanelReferenceSymbol(placement.panelReference.referenceKind)
      : undefined) ??
    (isGeneratedPanelPatternLegendPlacement(placement)
      ? createGeneratedPanelPatternLegendSymbol()
      : undefined) ??
    symbols.find(
      (symbol) =>
        symbol.symbolId === placement.symbolId &&
        symbol.versionId === placement.versionId
    )
  );
}
