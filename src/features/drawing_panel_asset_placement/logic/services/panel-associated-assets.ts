import type {
  ApprovedDrawingSymbol,
  DrawingAssetRecord,
  DrawingAssetType,
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  isGeneratedTerminalBlockReference,
  placementAssetId
} from "@/features/drawing_canvas/api/asset-contracts";
import {
  autosizeLayoutHelperToBackplane,
  isBackplanePlacement
} from "@/features/drawing_canvas/logic/services/drawing-backplane-layouts";
import {
  getBackplaneDisplayUsableBounds,
  resolveBackplaneLayoutScale
} from "@/features/drawing_canvas/logic/services/drawing-backplane-scale";
import { getComponentCompositionBounds } from "@/features/symbol_components/api/public";
import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID,
  normalizeTerminalBlockPlacement,
  terminalBlockMetadata,
  terminalBlockTerminals
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import { renderTerminalBlockSvg } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-renderer";
import { resolveTerminalBlockModuleForDefinition } from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import type { TerminalBlockPlacement } from "@/features/drawing_terminal_blocks/types";

export type AssociatedPanelAssetStatus =
  | "available"
  | "placed"
  | "disabled";

export type AssociatedPanelAssetCatalogItem = {
  assetId: string;
  tag: string;
  title: string;
  type: DrawingAssetType;
  status: AssociatedPanelAssetStatus;
  disabledReason?: string;
  placedPlacementId?: string;
  sourcePlacementRefs: Array<{
    sheetId: string;
    sheetName: string;
    sheetNumber: number;
    placementId: string;
  }>;
};

export type PanelAssetLayoutResolution = {
  symbol: ApprovedDrawingSymbol;
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
  terminalBlock?: TerminalBlockPlacement;
};

const DEFAULT_TERMINAL_MODULE_WIDTH_MM = 5.2;
const DEFAULT_TERMINAL_MODULE_HEIGHT_MM = 50;

const ASSET_TYPE_ORDER: DrawingAssetType[] = [
  "breaker",
  "terminal_block",
  "controller",
  "instrument",
  "other"
];

function sortAssetItems(
  first: AssociatedPanelAssetCatalogItem,
  second: AssociatedPanelAssetCatalogItem
): number {
  const firstIndex = ASSET_TYPE_ORDER.indexOf(first.type);
  const secondIndex = ASSET_TYPE_ORDER.indexOf(second.type);

  if (firstIndex !== secondIndex) {
    return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex);
  }

  return first.tag.localeCompare(second.tag, undefined, { numeric: true });
}

function canBePanelLayoutAsset(asset: DrawingAssetRecord): boolean {
  return !["cable", "panel", "junction_box"].includes(asset.type);
}

function isSourceAssociationPlacement(
  placement: DrawingPlacement,
  panelAssetId: string
): boolean {
  return Boolean(
    !placement.layoutKind &&
      placement.containerAssetId === panelAssetId &&
      placementAssetId(placement) !== panelAssetId
  );
}

function isPlacedOnBackplane(
  placement: DrawingPlacement,
  assetId: string,
  backplaneId: string
): boolean {
  return (
    placement.layoutKind === "layout_helper" &&
    placement.layoutParentId === backplaneId &&
    placementAssetId(placement) === assetId
  );
}

function fallbackAssetFromPlacement(
  placement: DrawingPlacement
): DrawingAssetRecord {
  return {
    id: placementAssetId(placement),
    tag: placement.tag,
    type: placement.role === "terminal_block" ? "terminal_block" : "other",
    title: placement.title?.trim() || placement.tag,
    symbolId: placement.symbolId,
    versionId: placement.versionId
  };
}

function sheetRef(
  sheet: DrawingPackageSheet,
  sheetIndex: number,
  placement: DrawingPlacement
): AssociatedPanelAssetCatalogItem["sourcePlacementRefs"][number] {
  return {
    sheetId: sheet.id,
    sheetName: sheet.name,
    sheetNumber: sheetIndex + 1,
    placementId: placement.id
  };
}

function terminalLayoutModuleSize(
  symbols: ApprovedDrawingSymbol[],
  config?: TerminalBlockPlacement
): {
  widthMm: number;
  heightMm: number;
} {
  if (config?.moduleTemplate) {
    return {
      widthMm: config.moduleTemplate.pitchMm,
      heightMm: config.moduleTemplate.heightMm
    };
  }

  const terminalModule = symbols.find(
    (symbol) =>
      symbol.category === "terminal_block" &&
      symbol.metadata.panelCategory === "termination" &&
      typeof symbol.metadata.physicalWidthMm === "number" &&
      symbol.metadata.physicalWidthMm > 0 &&
      typeof symbol.metadata.physicalHeightMm === "number" &&
      symbol.metadata.physicalHeightMm > 0
  );

  return {
    widthMm:
      terminalModule?.metadata.physicalWidthMm ??
      DEFAULT_TERMINAL_MODULE_WIDTH_MM,
    heightMm:
      terminalModule?.metadata.physicalHeightMm ??
      DEFAULT_TERMINAL_MODULE_HEIGHT_MM
  };
}

function findTerminalBlockConfigForAsset(
  model: DrawingModel,
  assetId: string
): TerminalBlockPlacement | undefined {
  const assetConfig = model.assets.find(
    (asset) => asset.id === assetId
  )?.terminalBlock;

  if (assetConfig) {
    return normalizeTerminalBlockPlacement(assetConfig);
  }

  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      if (
        placementAssetId(placement) === assetId &&
        isGeneratedTerminalBlockReference(placement)
      ) {
        return normalizeTerminalBlockPlacement(placement.terminalBlock);
      }
    }
  }

  return undefined;
}

function generatedTerminalBlockSymbol(
  config: TerminalBlockPlacement,
  symbols: ApprovedDrawingSymbol[],
  instanceId = "panel-layout"
): ApprovedDrawingSymbol {
  const normalized = normalizeTerminalBlockPlacement(config);
  const resolvedModule = resolveTerminalBlockModuleForDefinition(
    normalized,
    symbols
  );

  return {
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    symbolKey: "generated_modular_terminal_block",
    displayName: "Modular Terminal Block",
    category: "terminal_block",
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    versionNumber: 1,
    svg: renderTerminalBlockSvg(normalized, {
      module: resolvedModule,
      instanceId
    }),
    metadata: terminalBlockMetadata(normalized)
  };
}

function symbolHasPanelLayoutSize(symbol: ApprovedDrawingSymbol): boolean {
  const usage = symbol.metadata.layoutUsage ?? "wiring";

  return Boolean(
    (usage === "panel_layout" || usage === "both") &&
      typeof symbol.metadata.physicalWidthMm === "number" &&
      symbol.metadata.physicalWidthMm > 0 &&
      typeof symbol.metadata.physicalHeightMm === "number" &&
      symbol.metadata.physicalHeightMm > 0
  );
}

export function resolvePanelAssetLayoutSymbol(
  asset: DrawingAssetRecord,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): ApprovedDrawingSymbol | undefined {
  return resolvePanelAssetLayout(asset, model, symbols)?.symbol;
}

export function resolvePanelAssetLayout(
  asset: DrawingAssetRecord,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PanelAssetLayoutResolution | undefined {
  const terminalBlockConfig =
    asset.type === "terminal_block"
      ? findTerminalBlockConfigForAsset(model, asset.id)
      : undefined;

  if (terminalBlockConfig) {
    const moduleSize = terminalLayoutModuleSize(symbols, terminalBlockConfig);
    const terminals = terminalBlockTerminals(terminalBlockConfig);

    return {
      symbol: generatedTerminalBlockSymbol(
        terminalBlockConfig,
        symbols,
        asset.id
      ),
      terminalBlock: terminalBlockConfig,
      layoutDimensions: {
        lengthMm: Number((terminals.length * moduleSize.widthMm).toFixed(2)),
        widthMm: Number(moduleSize.heightMm.toFixed(2))
      }
    };
  }

  const symbol = symbols.find(
    (candidate) =>
      candidate.symbolId === asset.symbolId &&
      candidate.versionId === asset.versionId &&
      symbolHasPanelLayoutSize(candidate)
  );

  if (!symbol) {
    return undefined;
  }

  return {
    symbol,
    layoutDimensions: {
      lengthMm: symbol.metadata.physicalWidthMm!,
      widthMm: symbol.metadata.physicalHeightMm!
    }
  };
}

export function isPanelLayoutAssetPlacedOnBackplane(
  model: DrawingModel,
  assetId: string,
  backplaneId: string
): boolean {
  return model.sheets.some((sheet) =>
    sheet.placements.some((placement) =>
      isPlacedOnBackplane(placement, assetId, backplaneId)
    )
  );
}

export function buildAssociatedPanelAssetCatalog(
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[],
  panelAssetId: string,
  backplaneId: string
): AssociatedPanelAssetCatalogItem[] {
  const assetById = new Map((model.assets ?? []).map((asset) => [asset.id, asset]));
  const catalog = new Map<string, AssociatedPanelAssetCatalogItem>();

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      if (!isSourceAssociationPlacement(placement, panelAssetId)) {
        return;
      }

      const assetId = placementAssetId(placement);
      const asset = assetById.get(assetId) ?? fallbackAssetFromPlacement(placement);

      if (!canBePanelLayoutAsset(asset)) {
        return;
      }

      const current =
        catalog.get(assetId) ??
        {
          assetId,
          tag: asset.tag,
          title: asset.title,
          type: asset.type,
          status: "available" as const,
          sourcePlacementRefs: []
        };

      current.sourcePlacementRefs.push(sheetRef(sheet, sheetIndex, placement));
      catalog.set(assetId, current);
    });
  });

  return [...catalog.values()]
    .map((item) => {
      const asset = assetById.get(item.assetId);
      const layout = asset
        ? resolvePanelAssetLayout(asset, model, symbols)
        : undefined;
      const placedPlacement = model.sheets
        .flatMap((sheet) => sheet.placements)
        .find((placement) =>
          isPlacedOnBackplane(placement, item.assetId, backplaneId)
        );

      if (placedPlacement) {
        return {
          ...item,
          status: "placed" as const,
          placedPlacementId: placedPlacement.id
        };
      }

      if (!layout) {
        return {
          ...item,
          status: "disabled" as const,
          disabledReason: "Needs layout-ready symbol"
        };
      }

      return item;
    })
    .sort(sortAssetItems);
}

function roleForAssetType(assetType: DrawingAssetType): DrawingPlacement["role"] {
  if (assetType === "terminal_block" || assetType === "breaker") {
    return "terminal_block";
  }

  return "device";
}

function constrainComponentCompositionToBackplane({
  placement,
  asset,
  symbol,
  symbols,
  backplane,
  sheet,
  titleBlock
}: {
  placement: DrawingPlacement;
  asset: DrawingAssetRecord;
  symbol: ApprovedDrawingSymbol;
  symbols: ApprovedDrawingSymbol[];
  backplane: DrawingPlacement;
  sheet: DrawingPackageSheet;
  titleBlock: DrawingModel["titleBlock"];
}): DrawingPlacement {
  if (!asset.componentSelections?.length) {
    return placement;
  }

  const bounds = getComponentCompositionBounds({
    parentPlacement: placement,
    parentSymbol: symbol,
    selections: asset.componentSelections,
    symbols
  });
  const sheetGeometry = {
    ...sheet.page,
    titleBlock
  };
  const usable = getBackplaneDisplayUsableBounds(sheetGeometry, backplane);
  const maximumX = usable.x + usable.width;
  const maximumY = usable.y + usable.height;
  const deltaX =
    bounds.width >= usable.width
      ? usable.x - bounds.x
      : bounds.x < usable.x
        ? usable.x - bounds.x
        : bounds.x + bounds.width > maximumX
          ? maximumX - bounds.x - bounds.width
          : 0;
  const deltaY =
    bounds.height >= usable.height
      ? usable.y - bounds.y
      : bounds.y < usable.y
        ? usable.y - bounds.y
        : bounds.y + bounds.height > maximumY
          ? maximumY - bounds.y - bounds.height
          : 0;

  if (deltaX === 0 && deltaY === 0) {
    return placement;
  }

  const scale = resolveBackplaneLayoutScale(sheetGeometry, backplane);
  const layoutPosition = placement.layoutPosition ?? { xMm: 0, yMm: 0 };

  return {
    ...placement,
    x: Number((placement.x + deltaX).toFixed(2)),
    y: Number((placement.y + deltaY).toFixed(2)),
    layoutPosition: {
      xMm: Number((layoutPosition.xMm + deltaX / scale.factor).toFixed(2)),
      yMm: Number((layoutPosition.yMm + deltaY / scale.factor).toFixed(2))
    }
  };
}

export function placeAssociatedPanelAssetOnBackplane({
  model,
  sheetId,
  backplaneId,
  assetId,
  symbols,
  placementId = `pal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}: {
  model: DrawingModel;
  sheetId: string;
  backplaneId: string;
  assetId: string;
  symbols: ApprovedDrawingSymbol[];
  placementId?: string;
}): { model: DrawingModel; placement: DrawingPlacement } {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  const asset = (model.assets ?? []).find((candidate) => candidate.id === assetId);

  if (!sheet) {
    throw new Error("Active sheet was not found.");
  }

  if (!asset) {
    throw new Error("Asset was not found in this drawing.");
  }

  const backplane = sheet.placements.find(
    (placement) => placement.id === backplaneId && isBackplanePlacement(placement)
  );

  if (!backplane?.containerAssetId) {
    throw new Error("Choose a backplane with a parent panel first.");
  }

  const catalogItem = buildAssociatedPanelAssetCatalog(
    model,
    symbols,
    backplane.containerAssetId,
    backplane.id
  ).find((item) => item.assetId === assetId);

  if (!catalogItem) {
    throw new Error("Asset is not associated with this panel.");
  }

  if (catalogItem.status === "placed") {
    throw new Error(`${catalogItem.tag} is already placed on this backplane.`);
  }

  const layout = resolvePanelAssetLayout(asset, model, symbols);

  if (!layout) {
    throw new Error(`${asset.tag} needs a layout-ready symbol before placement.`);
  }

  const initialPlacement = autosizeLayoutHelperToBackplane({
    backplane,
    symbol: layout.symbol,
    sheet: {
      ...sheet.page,
      titleBlock: model.titleBlock
    },
    placement: {
      id: placementId,
      assetId: asset.id,
      containerAssetId: backplane.containerAssetId,
      symbolId: layout.symbol.symbolId,
      versionId: layout.symbol.versionId,
      role: roleForAssetType(asset.type),
      tag: asset.tag,
      title: asset.title,
      x: backplane.x,
      y: backplane.y,
      rotation: 0,
      scale: 1,
      layoutKind: "layout_helper",
      layoutDimensions: layout.layoutDimensions,
      terminalBlock: layout.terminalBlock
    }
  });
  const placement = constrainComponentCompositionToBackplane({
    placement: initialPlacement,
    asset,
    symbol: layout.symbol,
    symbols,
    backplane,
    sheet,
    titleBlock: model.titleBlock
  });

  return {
    placement,
    model: {
      ...model,
      sheets: model.sheets.map((candidate) =>
        candidate.id === sheet.id
          ? {
              ...candidate,
              placements: [...candidate.placements, placement]
            }
          : candidate
      )
    }
  };
}

export function removePanelAssetLayoutOccurrence({
  model,
  sheetId,
  placementId
}: {
  model: DrawingModel;
  sheetId: string;
  placementId: string;
}): DrawingModel {
  return {
    ...model,
    sheets: model.sheets.map((sheet) =>
      sheet.id === sheetId
        ? {
            ...sheet,
            placements: sheet.placements.filter(
              (placement) =>
                !(
                  placement.id === placementId &&
                  placement.layoutKind === "layout_helper"
                )
            )
          }
        : sheet
    )
  };
}
