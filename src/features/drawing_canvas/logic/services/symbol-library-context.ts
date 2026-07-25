import type { DrawingPackageSheetKind } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
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
import { isTerminalBlockModuleSymbol } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";

export type SymbolLibraryContext = "wiring" | "none";

export type SymbolLibraryGroup = {
  key: string;
  label: string;
  symbols: ApprovedDrawingSymbol[];
};

function labelFromKey(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const WIRING_GROUP_LABELS: Record<string, string> = {
  cable_assembly: "Cable Assemblies",
  instrument: "Instrumentation",
  monitor: "Controllers",
  circuit_protection: "Circuit Protection",
  terminal_block: "Terminal Block",
  panel_layout: "Panel Layout"
};

const WIRING_GROUP_ORDER = [
  "cable_assembly",
  "instrument",
  "monitor",
  "circuit_protection",
  "terminal_block",
  "panel_layout"
];

function isCircuitProtectionSymbol(symbol: ApprovedDrawingSymbol): boolean {
  const searchable = [
    symbol.symbolKey,
    symbol.displayName,
    symbol.model ?? "",
    symbol.metadata.panelCategory ?? ""
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  return (
    symbol.metadata.panelCategory === "protection" ||
    searchable.includes("circuit_breaker") ||
    searchable.includes("breaker") ||
    /(^|_)mcb(_|$)/.test(searchable)
  );
}

const PANEL_LAYOUT_CATEGORIES = new Set([
  "protection",
  "termination",
  "controller",
  "power",
  "ducting",
  "rail",
  "label",
  "other"
]);

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
  const descriptor = `${symbol.symbolKey} ${symbol.displayName} ${
    symbol.model ?? ""
  }`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  return (
    isGeneratedBackplaneSymbolReference(symbol) ||
    isGeneratedWireTraySymbolReference(symbol) ||
    isGeneratedLayoutDimensionSymbolReference(symbol) ||
    isGeneratedTerminalBlockGroupLibrarySymbolReference(symbol) ||
    ((usage === "panel_layout" || usage === "both") &&
      hasPanelLayoutPhysicalDimensions(symbol) &&
      (PANEL_LAYOUT_CATEGORIES.has(symbol.metadata.panelCategory ?? "other") ||
        descriptor.includes("din_rail")))
  );
}

function symbolLibraryGroupKey(symbol: ApprovedDrawingSymbol): string {
  if (isPanelLayoutLibrarySymbol(symbol)) {
    return "panel_layout";
  }

  if (isCircuitProtectionSymbol(symbol)) {
    return "circuit_protection";
  }

  return symbol.category;
}

function symbolLibraryGroupLabel(key: string): string {
  return WIRING_GROUP_LABELS[key] ?? labelFromKey(key);
}

function symbolLibraryGroupSort(
  first: SymbolLibraryGroup,
  second: SymbolLibraryGroup
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
  if (sheetKind === "section_title") {
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
