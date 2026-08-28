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

const EMPTY_DRAWING_ASSETS: DrawingAssetRecord[] = [];
const exactSymbolIndexByBundle = new WeakMap<
  ApprovedDrawingSymbol[],
  Map<string, ApprovedDrawingSymbol>
>();
const assetIndexByBundle = new WeakMap<
  DrawingAssetRecord[],
  Map<string, DrawingAssetRecord>
>();
const assetBundleRevisionByIdentity = new Map<
  string,
  WeakRef<DrawingAssetRecord[]>
>();
const assetBundleRevisionCleanup = new FinalizationRegistry<string>(
  (identity) => {
    if (!assetBundleRevisionByIdentity.get(identity)?.deref()) {
      assetBundleRevisionByIdentity.delete(identity);
    }
  }
);
const assetBundleIdentityByBundle = new WeakMap<DrawingAssetRecord[], string>();
const structuredSymbolByBundle = new WeakMap<
  ApprovedDrawingSymbol[],
  WeakMap<DrawingAssetRecord, ApprovedDrawingSymbol>
>();
const structuredAssetRevisionByBundle = new WeakMap<
  ApprovedDrawingSymbol[],
  Map<string, WeakRef<DrawingAssetRecord>>
>();
const terminalBlockSymbolByBundle = new WeakMap<
  ApprovedDrawingSymbol[],
  WeakMap<DrawingPlacement, ApprovedDrawingSymbol>
>();
const terminalBlockPlacementRevisionByBundle = new WeakMap<
  ApprovedDrawingSymbol[],
  Map<string, WeakRef<DrawingPlacement>>
>();
const renderableBundleByAssets = new WeakMap<
  DrawingAssetRecord[],
  WeakMap<
    ApprovedDrawingSymbol[],
    {
      byPlacements: WeakMap<DrawingPlacement[], ApprovedDrawingSymbol[]>;
      placementRevisionByIdentity: Map<
        string,
        WeakRef<DrawingPlacement[]>
      >;
    }
  >
>();
const placementBundleIdentityByBundle = new WeakMap<DrawingPlacement[], string>();

function orderedIdentityKey(ids: string[]): string {
  return JSON.stringify(ids);
}

function assetBundleIdentityKey(assets: DrawingAssetRecord[]): string {
  const existing = assetBundleIdentityByBundle.get(assets);
  if (existing) return existing;
  const created = orderedIdentityKey(assets.map((asset) => asset.id));
  assetBundleIdentityByBundle.set(assets, created);
  return created;
}

function placementBundleIdentityKey(placements: DrawingPlacement[]): string {
  const existing = placementBundleIdentityByBundle.get(placements);
  if (existing) return existing;
  const created = orderedIdentityKey(
    placements.map((placement) => placement.id)
  );
  placementBundleIdentityByBundle.set(placements, created);
  return created;
}

function registerAssetBundleRevision(assets: DrawingAssetRecord[]): void {
  const key = assetBundleIdentityKey(assets);
  const previous = assetBundleRevisionByIdentity.get(key)?.deref();
  if (previous === assets) return;
  if (previous && previous !== assets) {
    // Undo history intentionally retains earlier immutable model revisions. Drop
    // derived indexes and render bundles for the superseded revision rather
    // than allowing those values to remain reachable through WeakMap keys.
    assetIndexByBundle.delete(previous);
    renderableBundleByAssets.delete(previous);
  }
  assetBundleRevisionByIdentity.set(key, new WeakRef(assets));
  assetBundleRevisionCleanup.register(assets, key);
}

function registerObjectRevision<T extends object>(
  revisions: Map<string, WeakRef<T>>,
  id: string,
  value: T,
  cache: WeakMap<T, ApprovedDrawingSymbol>
): void {
  const previous = revisions.get(id)?.deref();
  if (previous === value) return;
  if (previous && previous !== value) {
    cache.delete(previous);
  }
  revisions.set(id, new WeakRef(value));
}

function exactSymbolReferenceKey(symbolId: string, versionId: string): string {
  return JSON.stringify([symbolId, versionId]);
}

function exactSymbolIndex(
  symbols: ApprovedDrawingSymbol[]
): Map<string, ApprovedDrawingSymbol> {
  const cached = exactSymbolIndexByBundle.get(symbols);
  if (cached) return cached;

  const index = new Map<string, ApprovedDrawingSymbol>();
  for (const symbol of symbols) {
    const key = exactSymbolReferenceKey(symbol.symbolId, symbol.versionId);
    // Preserve Array.find's existing first-match behavior for malformed
    // duplicate bundles.
    if (!index.has(key)) index.set(key, symbol);
  }
  exactSymbolIndexByBundle.set(symbols, index);
  return index;
}

function assetIndex(
  assets: DrawingAssetRecord[]
): Map<string, DrawingAssetRecord> {
  registerAssetBundleRevision(assets);
  const cached = assetIndexByBundle.get(assets);
  if (cached) return cached;

  const index = new Map<string, DrawingAssetRecord>();
  for (const asset of assets) {
    if (!index.has(asset.id)) index.set(asset.id, asset);
  }
  assetIndexByBundle.set(assets, index);
  return index;
}

function generatedSymbolCache<T extends object>(
  cache: WeakMap<ApprovedDrawingSymbol[], WeakMap<T, ApprovedDrawingSymbol>>,
  symbols: ApprovedDrawingSymbol[]
): WeakMap<T, ApprovedDrawingSymbol> {
  const existing = cache.get(symbols);
  if (existing) return existing;

  const created = new WeakMap<T, ApprovedDrawingSymbol>();
  cache.set(symbols, created);
  return created;
}

let generatedBackplaneSymbol: ApprovedDrawingSymbol | undefined;
let generatedWireTraySymbol: ApprovedDrawingSymbol | undefined;
const generatedDimensionSymbols = createGeneratedDimensionLibrarySymbols();
const generatedPanelReferences = new Map<
  NonNullable<DrawingPlacement["panelReference"]>["referenceKind"],
  ApprovedDrawingSymbol
>();
let generatedPanelPatternLegend: ApprovedDrawingSymbol | undefined;

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
  assets: DrawingAssetRecord[] = EMPTY_DRAWING_ASSETS
): boolean {
  if (!placement?.assetId) {
    return false;
  }
  const asset = assetIndex(assets).get(placement.assetId);
  return Boolean(
    asset?.terminalStrip &&
      placement.symbolId === structuredTerminalStripSymbolId(asset.id) &&
      placement.versionId === structuredTerminalStripVersionId(asset.id)
  );
}

export function createGeneratedStructuredTerminalStripSymbol(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[],
  assets: DrawingAssetRecord[] = EMPTY_DRAWING_ASSETS
): ApprovedDrawingSymbol | undefined {
  if (!placement?.assetId) {
    return undefined;
  }
  const asset = assetIndex(assets).get(placement.assetId);
  if (!asset?.terminalStrip || !isGeneratedStructuredTerminalStripPlacement(placement, assets)) {
    return undefined;
  }
  const cache = generatedSymbolCache(structuredSymbolByBundle, symbols);
  let revisions = structuredAssetRevisionByBundle.get(symbols);
  if (!revisions) {
    revisions = new Map();
    structuredAssetRevisionByBundle.set(symbols, revisions);
  }
  registerObjectRevision(revisions, asset.id, asset, cache);
  const cached = cache.get(asset);
  if (cached) return cached;

  const projection = projectStructuredTerminalStripTerminals(
    asset.terminalStrip,
    symbols
  );
  const geometry = composeTerminalStripGeometry(asset.terminalStrip, symbols);

  const generated: ApprovedDrawingSymbol = {
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
  cache.set(asset, generated);
  return generated;
}

export function buildRenderableDrawingSymbols({
  placements,
  approvedSymbols,
  assets = EMPTY_DRAWING_ASSETS
}: {
  placements: DrawingPlacement[];
  approvedSymbols: ApprovedDrawingSymbol[];
  assets?: DrawingAssetRecord[];
}): ApprovedDrawingSymbol[] {
  registerAssetBundleRevision(assets);
  let bySymbols = renderableBundleByAssets.get(assets);
  if (!bySymbols) {
    bySymbols = new WeakMap();
    renderableBundleByAssets.set(assets, bySymbols);
  }
  let bundleCache = bySymbols.get(approvedSymbols);
  if (!bundleCache) {
    bundleCache = {
      byPlacements: new WeakMap(),
      placementRevisionByIdentity: new Map()
    };
    bySymbols.set(approvedSymbols, bundleCache);
  }

  const placementIdentity = placementBundleIdentityKey(placements);
  const previousPlacements = bundleCache.placementRevisionByIdentity
    .get(placementIdentity)
    ?.deref();
  if (previousPlacements && previousPlacements !== placements) {
    const hasSamePlacementObjects =
      previousPlacements.length === placements.length &&
      previousPlacements.every(
        (placement, index) => placement === placements[index]
      );
    const previousResult = bundleCache.byPlacements.get(previousPlacements);
    bundleCache.byPlacements.delete(previousPlacements);
    if (hasSamePlacementObjects && previousResult) {
      bundleCache.byPlacements.set(placements, previousResult);
    }
  }
  bundleCache.placementRevisionByIdentity.set(
    placementIdentity,
    new WeakRef(placements)
  );

  const cached = bundleCache.byPlacements.get(placements);
  if (cached) return cached;

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

  bundleCache.byPlacements.set(placements, renderableSymbols);
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

  const cache = generatedSymbolCache(terminalBlockSymbolByBundle, symbols);
  let revisions = terminalBlockPlacementRevisionByBundle.get(symbols);
  if (!revisions) {
    revisions = new Map();
    terminalBlockPlacementRevisionByBundle.set(symbols, revisions);
  }
  registerObjectRevision(revisions, placement.id, placement, cache);
  const cached = cache.get(placement);
  if (cached) return cached;

  const terminalBlock = normalizeTerminalBlockPlacement(placement.terminalBlock);
  const resolvedModule = resolveTerminalBlockModuleForDefinition(
    terminalBlock,
    symbols
  );

  const generated: ApprovedDrawingSymbol = {
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
  cache.set(placement, generated);
  return generated;
}

export function createGeneratedBackplaneSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  if (!isBackplanePlacement(placement)) return undefined;
  generatedBackplaneSymbol ??= createGeneratedBackplaneLibrarySymbol();
  return generatedBackplaneSymbol;
}

export function createGeneratedWireTraySymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  if (!isGeneratedWireTraySymbolReference(placement)) return undefined;
  generatedWireTraySymbol ??= createGeneratedWireTrayLibrarySymbol();
  return generatedWireTraySymbol;
}

export function createGeneratedLayoutDimensionSymbol(
  placement: DrawingPlacement
): ApprovedDrawingSymbol | undefined {
  return generatedDimensionSymbols.find(
    (symbol) =>
      isGeneratedLayoutDimensionSymbolReference(placement) &&
      symbol.symbolId === placement.symbolId &&
      symbol.versionId === placement.versionId
  );
}

export function getRenderableSymbolForPlacement(
  placement: DrawingPlacement | undefined,
  symbols: ApprovedDrawingSymbol[],
  assets: DrawingAssetRecord[] = EMPTY_DRAWING_ASSETS
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
      ? (() => {
          const kind = placement.panelReference.referenceKind;
          const cached = generatedPanelReferences.get(kind);
          if (cached) return cached;
          const generated = createGeneratedPanelReferenceSymbol(kind);
          generatedPanelReferences.set(kind, generated);
          return generated;
        })()
      : undefined) ??
    (isGeneratedPanelPatternLegendPlacement(placement)
      ? (generatedPanelPatternLegend ??=
          createGeneratedPanelPatternLegendSymbol())
      : undefined) ??
    exactSymbolIndex(symbols).get(
      exactSymbolReferenceKey(placement.symbolId, placement.versionId)
    )
  );
}
