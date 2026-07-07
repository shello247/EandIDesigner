import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import {
  symbolMetadataSchema,
  type SymbolCategory,
  type SymbolLayoutUsage,
  type SymbolPanelCategory,
  type SymbolPanelMountingType
} from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSymbolKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "imported_symbol";
}

function normalizePositiveNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildImportedSymbolMetadata(input: {
  symbolKey: string;
  displayName: string;
  manufacturer?: string;
  model?: string;
  category: SymbolCategory;
  layoutUsage?: SymbolLayoutUsage;
  physicalWidthMm?: string | number;
  physicalHeightMm?: string | number;
  mountingType?: SymbolPanelMountingType | "";
  panelCategory?: SymbolPanelCategory | "";
  resizable?: boolean;
  viewBox: SvgViewBox;
  anchors: SymbolAnchor[];
  terminals: SymbolTerminal[];
}): SymbolMetadata {
  return symbolMetadataSchema.parse({
    symbolKey: normalizeSymbolKey(input.symbolKey),
    displayName: input.displayName.trim(),
    manufacturer: normalizeOptional(input.manufacturer),
    model: normalizeOptional(input.model),
    category: input.category,
    layoutUsage: input.layoutUsage ?? "wiring",
    physicalWidthMm: normalizePositiveNumber(input.physicalWidthMm),
    physicalHeightMm: normalizePositiveNumber(input.physicalHeightMm),
    mountingType: input.mountingType || undefined,
    panelCategory: input.panelCategory || undefined,
    resizable: input.resizable ?? false,
    viewBox: input.viewBox,
    anchors: input.anchors.map((anchor) => ({
      ...anchor,
      key: anchor.key.trim()
    })),
    terminals: input.terminals.map((terminal) => ({
      ...terminal,
      key: terminal.key.trim(),
      label: terminal.label.trim(),
      function: normalizeOptional(terminal.function),
      anchorKey: terminal.anchorKey.trim()
    }))
  });
}
