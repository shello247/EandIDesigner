import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID,
  TERMINAL_BLOCK_TAG_PREFIX,
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals,
  terminalBlockViewBox
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import type { TerminalBlockPlacement } from "@/features/drawing_terminal_blocks/types";
import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement
} from "../../data/schema";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  normalizeAssetTag,
  placementAssetId
} from "./drawing-asset-identity";
import { isGeneratedTerminalBlockPlacement } from "./drawing-generated-symbols";

export { TERMINAL_BLOCK_TAG_PREFIX };

export type TerminalBlockAssetPlacementRef = {
  sheetId: string;
  sheetName: string;
  sheetNumber: number;
  placementId: string;
};

export type TerminalBlockAssetCatalogItem = {
  assetId: string;
  tag: string;
  normalizedTag: string;
  config: TerminalBlockPlacement;
  terminalLabels: string[];
  placementRefs: TerminalBlockAssetPlacementRef[];
};

export const TERMINAL_BLOCK_SCHEMATIC_SCALE = 0.34;

export function createTerminalBlockPlacement({
  model,
  activeSheet,
  assetId,
  tag,
  x,
  y,
  terminalBlock
}: {
  model: DrawingModel;
  activeSheet: DrawingPackageSheet;
  assetId?: string;
  tag?: string;
  x?: number;
  y?: number;
  terminalBlock?: Partial<TerminalBlockPlacement>;
}): DrawingPlacement {
  const normalizedConfig = normalizeTerminalBlockPlacement(terminalBlock);
  const viewBox = terminalBlockViewBox(normalizedConfig);
  const placementId = `tb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scale = TERMINAL_BLOCK_SCHEMATIC_SCALE;
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;
  const normalizedTag =
    tag?.trim() ||
    allocateNextTagFromPrefix({
      model,
      prefix: TERMINAL_BLOCK_TAG_PREFIX
    });

  return {
    id: placementId,
    assetId: assetId?.trim() || createDrawingAssetId(placementId),
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    role: "terminal_block",
    tag: normalizedTag,
    x: Math.max(0, Math.min(activeSheet.page.width - width, x ?? 35)),
    y: Math.max(0, Math.min(activeSheet.page.height - height, y ?? 45)),
    rotation: 0,
    scale,
    terminalBlock: normalizedConfig
  };
}

export function buildTerminalBlockAssetCatalog(
  model: DrawingModel
): TerminalBlockAssetCatalogItem[] {
  const catalog = new Map<string, TerminalBlockAssetCatalogItem>();

  (model.assets ?? [])
    .filter((asset) => asset.type === "terminal_block")
    .forEach((asset) => {
      const config = normalizeTerminalBlockPlacement(asset.terminalBlock);

      catalog.set(asset.id, {
        assetId: asset.id,
        tag: asset.tag,
        normalizedTag: normalizeAssetTag(asset.tag),
        config,
        terminalLabels: terminalBlockTerminals(config).map(
          (terminal) => terminal.label
        ),
        placementRefs: []
      });
    });

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements
      .filter(isGeneratedTerminalBlockPlacement)
      .forEach((placement) => {
        const assetId = placementAssetId(placement);
        const config = normalizeTerminalBlockPlacement(placement.terminalBlock);
        const placementRef: TerminalBlockAssetPlacementRef = {
          sheetId: sheet.id,
          sheetName: sheet.name,
          sheetNumber: sheetIndex + 1,
          placementId: placement.id
        };
        const current = catalog.get(assetId);

        if (current) {
          if (!current.config.moduleTemplate && placement.terminalBlock) {
            current.config = config;
            current.terminalLabels = terminalBlockTerminals(config).map(
              (terminal) => terminal.label
            );
          }
          current.placementRefs.push(placementRef);
          return;
        }

        catalog.set(assetId, {
          assetId,
          tag: placement.tag,
          normalizedTag: normalizeAssetTag(placement.tag),
          config,
          terminalLabels: terminalBlockTerminals(config).map(
            (terminal) => terminal.label
          ),
          placementRefs: [placementRef]
        });
      });
  });

  return [...catalog.values()].sort((first, second) =>
    first.tag.localeCompare(second.tag, undefined, { numeric: true })
  );
}
