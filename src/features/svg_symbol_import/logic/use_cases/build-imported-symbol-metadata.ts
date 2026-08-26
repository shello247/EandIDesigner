import type {
  SymbolAnchor,
  SymbolMetadata,
  SymbolTerminal
} from "@/features/symbol_registry/data/schema";
import {
  symbolMetadataSchema,
  type SymbolTechnicalKind,
  type SymbolLayoutUsage,
  type SymbolPanelCategory,
  type SymbolPanelMountingType,
  type SymbolPanelWiringAssetType
} from "@/features/symbol_registry/data/schema";
import type { SvgViewBox } from "@/shared/svg/svg-inspector";
import type { SvgImportNetworkProfileDraft } from "../../data/schema";
import { buildNetworkProfileFromDraft } from "../services/network-profile-draft";
import type { SymbolComponentPosition } from "@/features/symbol_components/api/public";

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
  technicalKind?: SymbolTechnicalKind;
  /** @deprecated Use technicalKind. */
  category?: SymbolTechnicalKind;
  layoutUsage?: SymbolLayoutUsage;
  physicalWidthMm?: string | number;
  physicalHeightMm?: string | number;
  mountingType?: SymbolPanelMountingType | "";
  /** @deprecated Managed symbol categories replace panel categories. */
  panelCategory?: SymbolPanelCategory | "";
  resizable?: boolean;
  panelWiringEnabled?: boolean;
  panelWiringAssetType?: SymbolPanelWiringAssetType;
  panelWiringTagPrefix?: string;
  panelWiringSchematicScale?: string | number;
  viewBox: SvgViewBox;
  anchors: SymbolAnchor[];
  terminals: SymbolTerminal[];
  networkProfile?: SvgImportNetworkProfileDraft;
  componentPositions?: SymbolComponentPosition[];
}): SymbolMetadata {
  const technicalKind = input.technicalKind ?? input.category ?? "other";
  const isNetworkDevice = technicalKind === "network_device";
  const networkProfile =
    isNetworkDevice
      ? input.networkProfile
        ? buildNetworkProfileFromDraft(input.networkProfile)
        : undefined
      : undefined;

  return symbolMetadataSchema.parse({
    symbolKey: normalizeSymbolKey(input.symbolKey),
    displayName: input.displayName.trim(),
    manufacturer: normalizeOptional(input.manufacturer),
    model: normalizeOptional(input.model),
    category: technicalKind,
    layoutUsage: isNetworkDevice ? "wiring" : input.layoutUsage ?? "wiring",
    physicalWidthMm: isNetworkDevice
      ? undefined
      : normalizePositiveNumber(input.physicalWidthMm),
    physicalHeightMm: isNetworkDevice
      ? undefined
      : normalizePositiveNumber(input.physicalHeightMm),
    mountingType: isNetworkDevice ? undefined : input.mountingType || undefined,
    resizable: isNetworkDevice ? false : input.resizable ?? false,
    networkProfile,
    panelWiring: !isNetworkDevice && input.panelWiringEnabled
      ? {
          assetType: input.panelWiringAssetType ?? "other",
          tagPrefix: input.panelWiringTagPrefix?.trim().toUpperCase() || "EQ",
          schematicScale: normalizePositiveNumber(
            input.panelWiringSchematicScale
          )
        }
      : undefined,
    viewBox: input.viewBox,
    componentPositions:
      input.componentPositions && input.componentPositions.length > 0
        ? input.componentPositions
        : undefined,
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
