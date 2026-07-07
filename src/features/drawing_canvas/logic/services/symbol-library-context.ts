import type { DrawingPackageSheetKind } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  createGeneratedBackplaneLibrarySymbol,
  isGeneratedBackplaneSymbolReference
} from "./drawing-backplane-layouts";

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
    ((usage === "panel_layout" || usage === "both") &&
      (symbol.metadata.panelCategory === "rail" ||
        symbol.metadata.panelCategory === "ducting" ||
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
    const filtered = symbols.filter(symbolSupportsWiring);
    const hasBackplane = filtered.some(isGeneratedBackplaneSymbolReference);

    return hasBackplane
      ? filtered
      : [...filtered, createGeneratedBackplaneLibrarySymbol()];
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
