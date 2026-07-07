import type { TerminalBlockPlacement } from "../../data/schema";
import {
  isGeneratedTerminalBlockReference,
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals
} from "./terminal-block-layout";

export type TerminalBlockLikePlacement = {
  id: string;
  assetId?: string;
  symbolId: string;
  versionId: string;
  tag: string;
  terminalBlock?: TerminalBlockPlacement;
};

export type TerminalBlockCatalogItem = {
  assetId: string;
  tag: string;
  placementIds: string[];
  terminalLabels: string[];
};

export type TerminalBlockQcWarning = {
  code: "missing_config" | "linked_config_mismatch";
  message: string;
  assetId?: string;
  placementId?: string;
};

function assetIdForPlacement(placement: TerminalBlockLikePlacement): string {
  return placement.assetId?.trim() || `asset_${placement.id}`;
}

function configSignature(config: TerminalBlockPlacement): string {
  const normalized = normalizeTerminalBlockPlacement(config);

  return [
    normalized.count,
    normalized.startNumber,
    normalized.orientation,
    normalized.modulePitch,
    normalized.moduleWidth,
    normalized.moduleHeight
  ].join(":");
}

export function buildTerminalBlockCatalog(
  placements: TerminalBlockLikePlacement[]
): TerminalBlockCatalogItem[] {
  const catalog = new Map<string, TerminalBlockCatalogItem>();

  for (const placement of placements) {
    if (
      !isGeneratedTerminalBlockReference(placement) ||
      !placement.terminalBlock
    ) {
      continue;
    }

    const assetId = assetIdForPlacement(placement);
    const current = catalog.get(assetId);
    const terminalLabels = terminalBlockTerminals(
      normalizeTerminalBlockPlacement(placement.terminalBlock)
    ).map((terminal) => terminal.label);

    if (current) {
      current.placementIds.push(placement.id);
      continue;
    }

    catalog.set(assetId, {
      assetId,
      tag: placement.tag,
      placementIds: [placement.id],
      terminalLabels
    });
  }

  return [...catalog.values()].sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, { numeric: true })
  );
}

export function detectTerminalBlockWarnings(
  placements: TerminalBlockLikePlacement[]
): TerminalBlockQcWarning[] {
  const warnings: TerminalBlockQcWarning[] = [];
  const linkedConfigs = new Map<string, string>();

  for (const placement of placements) {
    if (!isGeneratedTerminalBlockReference(placement)) {
      continue;
    }

    if (!placement.terminalBlock) {
      warnings.push({
        code: "missing_config",
        message: `${placement.tag} is missing terminal block configuration.`,
        placementId: placement.id
      });
      continue;
    }

    const assetId = assetIdForPlacement(placement);
    const signature = configSignature(placement.terminalBlock);
    const existing = linkedConfigs.get(assetId);

    if (existing && existing !== signature) {
      warnings.push({
        code: "linked_config_mismatch",
        message: `${placement.tag} has linked references with different terminal counts or numbering.`,
        assetId,
        placementId: placement.id
      });
      continue;
    }

    linkedConfigs.set(assetId, signature);
  }

  return warnings;
}
