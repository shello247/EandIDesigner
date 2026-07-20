import { z } from "zod";
import type { SymbolMetadata } from "@/features/symbol_registry/data/schema";
import type {
  TerminalBlockGroupDefinition,
  TerminalBlockModuleTemplate
} from "../../types";
import {
  DEFAULT_TERMINAL_BLOCK_COUNT,
  normalizeTerminalBlockPlacement
} from "./terminal-block-layout";

export const MIN_TERMINAL_BLOCK_GROUP_COUNT = 2;
export const MAX_TERMINAL_BLOCK_GROUP_COUNT = 80;
export const LEGACY_TERMINAL_BLOCK_MODULE_SYMBOL_KEY =
  "terminal_block_single_scaled";

const terminalBlockGroupInputSchema = z.object({
  count: z
    .number()
    .int()
    .min(MIN_TERMINAL_BLOCK_GROUP_COUNT)
    .max(MAX_TERMINAL_BLOCK_GROUP_COUNT)
});

export type TerminalBlockModuleSymbol = {
  symbolId: string;
  versionId: string;
  symbolKey: string;
  displayName: string;
  svg: string;
  metadata: SymbolMetadata;
};

export type ResolvedTerminalBlockModule = {
  symbolId: string;
  versionId: string;
  symbolKey: string;
  displayName: string;
  svg: string;
  viewBox: SymbolMetadata["viewBox"];
  pitchMm: number;
  heightMm: number;
  source: "configured" | "legacy_default";
};

export type TerminalBlockModuleResolution =
  | { ok: true; module: ResolvedTerminalBlockModule }
  | { ok: false; error: string };

export type TerminalBlockGroupPhysicalSize = {
  lengthMm: number;
  widthMm: number;
};

function hasPhysicalModuleSize(
  symbol: TerminalBlockModuleSymbol
): symbol is TerminalBlockModuleSymbol & {
  metadata: SymbolMetadata & {
    physicalWidthMm: number;
    physicalHeightMm: number;
  };
} {
  return Boolean(
    symbol.metadata.category === "terminal_block" &&
      symbol.metadata.panelCategory === "termination" &&
      typeof symbol.metadata.physicalWidthMm === "number" &&
      symbol.metadata.physicalWidthMm > 0 &&
      typeof symbol.metadata.physicalHeightMm === "number" &&
      symbol.metadata.physicalHeightMm > 0
  );
}

export function isTerminalBlockModuleSymbol(
  symbol: TerminalBlockModuleSymbol | undefined
): boolean {
  return Boolean(
    symbol &&
      (symbol.metadata.terminalBlockModule?.kind === "feed_through" ||
        symbol.symbolKey === LEGACY_TERMINAL_BLOCK_MODULE_SYMBOL_KEY)
  );
}

function resolvedModule(
  symbol: TerminalBlockModuleSymbol,
  source: ResolvedTerminalBlockModule["source"]
): ResolvedTerminalBlockModule {
  return {
    symbolId: symbol.symbolId,
    versionId: symbol.versionId,
    symbolKey: symbol.symbolKey,
    displayName: symbol.displayName,
    svg: symbol.svg,
    viewBox: symbol.metadata.viewBox,
    pitchMm: symbol.metadata.physicalWidthMm!,
    heightMm: symbol.metadata.physicalHeightMm!,
    source
  };
}

export function resolveDefaultTerminalBlockModule(
  symbols: TerminalBlockModuleSymbol[]
): TerminalBlockModuleResolution {
  const configured = symbols.filter(
    (symbol) =>
      hasPhysicalModuleSize(symbol) &&
      symbol.metadata.terminalBlockModule?.kind === "feed_through" &&
      symbol.metadata.terminalBlockModule.defaultForGeneratedGroups
  );

  if (configured.length > 1) {
    return {
      ok: false,
      error:
        "More than one terminal module is configured as the default group module."
    };
  }

  if (configured[0]) {
    return { ok: true, module: resolvedModule(configured[0], "configured") };
  }

  const legacyDefault = symbols.find(
    (symbol) =>
      symbol.symbolKey === LEGACY_TERMINAL_BLOCK_MODULE_SYMBOL_KEY &&
      hasPhysicalModuleSize(symbol)
  );

  if (legacyDefault) {
    return {
      ok: true,
      module: resolvedModule(legacyDefault, "legacy_default")
    };
  }

  return {
    ok: false,
    error:
      "Configure one approved feed-through terminal symbol as the default terminal group module."
  };
}

export function resolveTerminalBlockModuleForDefinition(
  definition: TerminalBlockGroupDefinition,
  symbols: TerminalBlockModuleSymbol[]
): ResolvedTerminalBlockModule | undefined {
  const template = definition.moduleTemplate;

  if (template) {
    const symbol = symbols.find(
      (candidate) =>
        candidate.symbolId === template.symbolId &&
        candidate.versionId === template.versionId &&
        hasPhysicalModuleSize(candidate)
    );

    if (symbol) {
      return {
        ...resolvedModule(symbol, "configured"),
        pitchMm: template.pitchMm,
        heightMm: template.heightMm
      };
    }

    return undefined;
  }

  const fallback = resolveDefaultTerminalBlockModule(symbols);
  return fallback.ok ? fallback.module : undefined;
}

export function buildTerminalBlockGroupDefinition({
  count = DEFAULT_TERMINAL_BLOCK_COUNT,
  module
}: {
  count?: number;
  module: ResolvedTerminalBlockModule;
}): TerminalBlockGroupDefinition {
  const parsed = terminalBlockGroupInputSchema.parse({ count });
  const moduleTemplate: TerminalBlockModuleTemplate = {
    symbolId: module.symbolId,
    versionId: module.versionId,
    pitchMm: module.pitchMm,
    heightMm: module.heightMm
  };

  return normalizeTerminalBlockPlacement({
    count: parsed.count,
    startNumber: 1,
    orientation: "horizontal",
    modulePitch: module.viewBox.width,
    moduleWidth: module.viewBox.width,
    moduleHeight: module.viewBox.height,
    moduleTemplate
  });
}

export function getTerminalBlockGroupPhysicalSize(
  definition: TerminalBlockGroupDefinition
): TerminalBlockGroupPhysicalSize {
  const normalized = normalizeTerminalBlockPlacement(definition);
  const pitchMm = normalized.moduleTemplate?.pitchMm ?? 5.2;
  const heightMm = normalized.moduleTemplate?.heightMm ?? 50;

  return {
    lengthMm: Number((normalized.count * pitchMm).toFixed(2)),
    widthMm: Number(heightMm.toFixed(2))
  };
}
