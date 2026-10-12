import { DEVICE_TYPE_OPTIONS, deviceTypeSchema, getDeviceTypeLabel } from "@/shared/device-classification/device-types";
import type { DrawingPackageSheetKind } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import type { DrawingSymbolCatalogSummary } from "@/features/symbol_registry/api/public";
import {
  createGeneratedBackplaneLibrarySymbol,
  isGeneratedBackplaneSymbolReference
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
  createGeneratedTerminalBlockGroupLibrarySymbol,
  isGeneratedTerminalBlockGroupLibrarySymbolReference
} from "./drawing-terminal-block-groups";
import { isTerminalBlockModuleSymbol, LEGACY_TERMINAL_BLOCK_MODULE_SYMBOL_KEY } from "@/features/drawing_terminal_blocks/api/public";

export type SymbolLibraryContext = "wiring" | "none";

export type SymbolLibraryGroup = {
  key: string;
  label: string;
  symbols: ApprovedDrawingSymbol[];
};

export type SymbolCatalogLibraryGroup = {
  key: string;
  label: string;
  symbols: DrawingSymbolCatalogSummary[];
};

const WIRING_GROUP_ORDER = ["panel_layout", ...DEVICE_TYPE_OPTIONS.map(type => type.value), "needs_classification"];

export function hasPanelLayoutPhysicalDimensions(
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  return Boolean(
    symbol &&
      typeof symbol.metadata.physicalWidthMm === "number" &&
      symbol.metadata.physicalWidthMm > 0 &&
      typeof symbol.metadata.physicalHeightMm === "number" &&
      symbol.metadata.physicalHeightMm > 0
  );
}

export function isPanelLayoutLibrarySymbol(
  symbol: ApprovedDrawingSymbol | undefined
): boolean {
  if (!symbol) {
    return false;
  }

  const usage = symbol.metadata.layoutUsage ?? "wiring";
  return (
    isGeneratedBackplaneSymbolReference(symbol) ||
    isGeneratedWireTraySymbolReference(symbol) ||
    isGeneratedLayoutDimensionSymbolReference(symbol) ||
    isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol) ||
    ((usage === "panel_layout" || usage === "both") &&
      hasPanelLayoutPhysicalDimensions(symbol))
  );
}

function symbolLibraryGroupKey(symbol: ApprovedDrawingSymbol): string {
  if (
    isGeneratedBackplaneSymbolReference(symbol) ||
    isGeneratedWireTraySymbolReference(symbol) ||
    isGeneratedLayoutDimensionSymbolReference(symbol) ||
    isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol)
  ) {
    return "panel_layout";
  }

  return symbol.deviceType ?? "needs_classification";
}

function symbolLibraryGroupLabel(key: string): string {
  if (key === "panel_layout") return "Panel Layout Tools";
  const type = deviceTypeSchema.safeParse(key);
  return type.success ? getDeviceTypeLabel(type.data) : "Needs classification";
}

function symbolLibraryGroupSort(
  first: Pick<SymbolLibraryGroup, "key" | "label">,
  second: Pick<SymbolLibraryGroup, "key" | "label">
): number {
  const firstIndex = WIRING_GROUP_ORDER.indexOf(first.key);
  const secondIndex = WIRING_GROUP_ORDER.indexOf(second.key);

  if (firstIndex !== -1 || secondIndex !== -1) {
    if (firstIndex === -1) {
      return 1;
    }

    if (secondIndex === -1) {
      return -1;
    }

    return firstIndex - secondIndex;
  }

  return first.label.localeCompare(second.label);
}

function symbolSupportsWiring(symbol: ApprovedDrawingSymbol): boolean {
  if (isTerminalBlockModuleSymbol(symbol)) {
    return false;
  }

  return (
    (symbol.metadata.layoutUsage ?? "wiring") !== "panel_layout" ||
    isPanelLayoutLibrarySymbol(symbol)
  );
}

export function getSymbolLibraryContextForSheetKind(
  sheetKind: DrawingPackageSheetKind
): SymbolLibraryContext {
  if (sheetKind === "section_title" || sheetKind === "title_sheet") {
    return "none";
  }

  return "wiring";
}

export function getSymbolsForLibraryContext(
  symbols: ApprovedDrawingSymbol[],
  context: SymbolLibraryContext
): ApprovedDrawingSymbol[] {
  if (context === "wiring") {
    const filtered = symbols.filter(
      (symbol) => symbol.selectable !== false && symbolSupportsWiring(symbol)
    );
    const hasBackplane = filtered.some(isGeneratedBackplaneSymbolReference);
    const hasWireTray = filtered.some(isGeneratedWireTraySymbolReference);
    const hasTerminalBlockGroup = filtered.some(
      isGeneratedTerminalBlockGroupLibrarySymbolReference
    );
    const generatedDimensions = createGeneratedDimensionLibrarySymbols().filter(
      (dimensionSymbol) =>
        !filtered.some((symbol) =>
          isGeneratedLayoutDimensionSymbolReference(symbol) &&
          symbol.symbolId === dimensionSymbol.symbolId &&
          symbol.versionId === dimensionSymbol.versionId
        )
    );
    const generatedSymbols = [
      ...(hasBackplane ? [] : [createGeneratedBackplaneLibrarySymbol()]),
      ...(hasWireTray ? [] : [createGeneratedWireTrayLibrarySymbol()]),
      ...(hasTerminalBlockGroup
        ? []
        : [createGeneratedTerminalBlockGroupLibrarySymbol()]),
      ...generatedDimensions
    ];

    return [...filtered, ...generatedSymbols];
  }

  return [];
}

export function getGeneratedSymbolsForLibraryContext(
  context: SymbolLibraryContext
): ApprovedDrawingSymbol[] {
  if (context !== "wiring") return [];

  return [
    createGeneratedBackplaneLibrarySymbol(),
    createGeneratedWireTrayLibrarySymbol(),
    createGeneratedTerminalBlockGroupLibrarySymbol(),
    ...createGeneratedDimensionLibrarySymbols()
  ];
}

function toGeneratedCatalogSummary(
  symbol: ApprovedDrawingSymbol
): DrawingSymbolCatalogSummary {
  return {
    symbolId: symbol.symbolId,
    symbolKey: symbol.symbolKey,
    displayName: symbol.displayName,
    manufacturer: symbol.manufacturer,
    model: symbol.model,
    technicalKind: symbol.category,
    managedCategory: {
      id: "generated_panel_layout",
      name: "Panel Layout"
    },
    versionId: symbol.versionId,
    versionNumber: symbol.versionNumber,
    capabilities: {
      layoutUsage: symbol.metadata.layoutUsage,
      physicalWidthMm: symbol.metadata.physicalWidthMm,
      physicalHeightMm: symbol.metadata.physicalHeightMm,
      mountingType: symbol.metadata.mountingType,
      panelCategory: symbol.metadata.panelCategory,
      terminalBlockModule: symbol.metadata.terminalBlockModule,
      terminalStripCapability: symbol.metadata.terminalStripCapability
    }
  };
}

function hasCatalogPhysicalDimensions(
  symbol: DrawingSymbolCatalogSummary
): boolean {
  return Boolean(
    typeof symbol.capabilities.physicalWidthMm === "number" &&
      symbol.capabilities.physicalWidthMm > 0 &&
      typeof symbol.capabilities.physicalHeightMm === "number" &&
      symbol.capabilities.physicalHeightMm > 0
  );
}

function isPanelLayoutCatalogSymbol(
  symbol: DrawingSymbolCatalogSummary
): boolean {
  const usage = symbol.capabilities.layoutUsage ?? "wiring";
  return (
    isGeneratedBackplaneSymbolReference(symbol) ||
    isGeneratedWireTraySymbolReference(symbol) ||
    isGeneratedLayoutDimensionSymbolReference(symbol) ||
    isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol) ||
    ((usage === "panel_layout" || usage === "both") &&
      hasCatalogPhysicalDimensions(symbol))
  );
}

function catalogGroupKey(symbol: DrawingSymbolCatalogSummary): string {
  if (
    isGeneratedBackplaneSymbolReference(symbol) ||
    isGeneratedWireTraySymbolReference(symbol) ||
    isGeneratedLayoutDimensionSymbolReference(symbol) ||
    isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol)
  ) {
    return "panel_layout";
  }
  return symbol.deviceType ?? "needs_classification";
}

function catalogSupportsWiring(symbol: DrawingSymbolCatalogSummary): boolean {
  if (symbol.capabilities.terminalBlockModule || symbol.symbolKey === LEGACY_TERMINAL_BLOCK_MODULE_SYMBOL_KEY) return false;
  return (
    (symbol.capabilities.layoutUsage ?? "wiring") !== "panel_layout" ||
    isPanelLayoutCatalogSymbol(symbol)
  );
}

export function getCatalogSummariesForLibraryContext(
  summaries: readonly DrawingSymbolCatalogSummary[],
  context: SymbolLibraryContext
): DrawingSymbolCatalogSummary[] {
  if (context !== "wiring") return [];

  const filtered = summaries.filter(catalogSupportsWiring);
  const existingVersionIds = new Set(
    filtered.map((summary) => summary.versionId)
  );
  const generated = getGeneratedSymbolsForLibraryContext(context)
    .map(toGeneratedCatalogSummary)
    .filter((summary) => !existingVersionIds.has(summary.versionId));

  return [...filtered, ...generated];
}

export function groupCatalogSummariesForLibrary(
  summaries: readonly DrawingSymbolCatalogSummary[],
  context: SymbolLibraryContext
): SymbolCatalogLibraryGroup[] {
  const grouped = new Map<string, DrawingSymbolCatalogSummary[]>();

  for (const symbol of getCatalogSummariesForLibraryContext(
    summaries,
    context
  )) {
    const key = catalogGroupKey(symbol);
    grouped.set(key, [...(grouped.get(key) ?? []), symbol]);
  }

  return [...grouped.entries()]
    .map(([key, items]) => ({
      key,
      label: symbolLibraryGroupLabel(key),
      symbols: items.sort((first, second) =>
        first.displayName.localeCompare(second.displayName)
      )
    }))
    .sort(symbolLibraryGroupSort);
}

export function getSymbolsForSheetKind(
  symbols: ApprovedDrawingSymbol[],
  sheetKind: DrawingPackageSheetKind
): ApprovedDrawingSymbol[] {
  return getSymbolsForLibraryContext(
    symbols,
    getSymbolLibraryContextForSheetKind(sheetKind)
  );
}

export function groupSymbolsForLibrary(
  symbols: ApprovedDrawingSymbol[],
  context: SymbolLibraryContext
): SymbolLibraryGroup[] {
  const grouped = new Map<string, ApprovedDrawingSymbol[]>();
  const filteredSymbols = getSymbolsForLibraryContext(symbols, context);

  for (const symbol of filteredSymbols) {
    const key = symbolLibraryGroupKey(symbol);
    grouped.set(key, [...(grouped.get(key) ?? []), symbol]);
  }

  return [...grouped.entries()]
    .map(([key, items]) => ({
      key,
      label: symbolLibraryGroupLabel(key),
      symbols: items.sort((first, second) =>
        first.displayName.localeCompare(second.displayName)
      )
    }))
    .sort(symbolLibraryGroupSort);
}
