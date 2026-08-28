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
  createGeneratedStructuredTerminalStripSymbol,
  getRenderableSymbolForPlacement,
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "@/features/drawing_canvas/logic/services/drawing-generated-symbols";
import {
  getPanelConnectionViewChildren,
  getPanelConnectionViewInnerBounds,
  isPanelConnectionViewPlacement
} from "@/features/drawing_canvas/logic/services/drawing-panel-connection-views";
import { getRotatedPlacementBounds } from "@/features/drawing_canvas/logic/services/drawing-geometry";
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

export type PanelAssetPlacementTarget =
  | { kind: "physical_backplane"; placementId: string }
  | { kind: "connection_reference"; placementId: string };

export type PanelAssetLayoutResolution = {
  symbol: ApprovedDrawingSymbol;
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
  terminalBlock?: TerminalBlockPlacement;
};

export type PanelAssetSchematicResolution = {
  symbol: ApprovedDrawingSymbol;
  terminalBlock?: TerminalBlockPlacement;
};

const DEFAULT_TERMINAL_MODULE_WIDTH_MM = 5.2;
const DEFAULT_TERMINAL_MODULE_HEIGHT_MM = 50;

const ASSET_TYPE_ORDER: DrawingAssetType[] = [
  "breaker",
  "terminal_block",
  "controller",
  "network_device",
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
  panelAssetId: string,
  asset?: DrawingAssetRecord
): boolean {
  return Boolean(
    placement.containerAssetId === panelAssetId &&
      placementAssetId(placement) !== panelAssetId &&
      (!placement.layoutKind ||
        (Boolean(asset?.terminalStrip) && placement.layoutKind === "layout_helper"))
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

function isPlacedOnTarget(
  placement: DrawingPlacement,
  assetId: string,
  targetPlacementId: string
): boolean {
  return (
    placement.layoutParentId === targetPlacementId &&
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
      ((symbol.technicalKind ?? symbol.category) === "terminal_block" ||
        (symbol.technicalKind ?? symbol.category) === "termination") &&
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
    metadata: terminalBlockMetadata(normalized, resolvedModule)
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
  if (asset.terminalStrip) {
    const placement: DrawingPlacement = {
      id: `structured_terminal_strip_layout_${asset.id}`,
      assetId: asset.id,
      symbolId: structuredTerminalStripSymbolId(asset.id),
      versionId: structuredTerminalStripVersionId(asset.id),
      role: "terminal_block",
      tag: asset.tag,
      title: asset.title,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1
    };
    const symbol = createGeneratedStructuredTerminalStripSymbol(
      placement,
      symbols,
      model.assets
    );

    if (!symbol) return undefined;

    return {
      symbol,
      layoutDimensions: {
        lengthMm: symbol.metadata.physicalWidthMm!,
        widthMm: symbol.metadata.physicalHeightMm!
      }
    };
  }

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

export function resolvePanelAssetSchematic(
  asset: DrawingAssetRecord,
  model: DrawingModel,
  symbols: ApprovedDrawingSymbol[]
): PanelAssetSchematicResolution | undefined {
  const layoutResolution = resolvePanelAssetLayout(asset, model, symbols);
  if (layoutResolution) {
    return {
      symbol: layoutResolution.symbol,
      terminalBlock: layoutResolution.terminalBlock
    };
  }

  const symbol = symbols.find(
    (candidate) =>
      candidate.symbolId === asset.symbolId &&
      candidate.versionId === asset.versionId
  );

  return symbol ? { symbol } : undefined;
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
  const targetIsConnectionView = model.sheets.some((sheet) =>
    sheet.placements.some(
      (placement) =>
        placement.id === backplaneId && isPanelConnectionViewPlacement(placement)
    )
  );

  model.sheets.forEach((sheet, sheetIndex) => {
    sheet.placements.forEach((placement) => {
      const assetId = placementAssetId(placement);
      const asset = assetById.get(assetId) ?? fallbackAssetFromPlacement(placement);

      if (!isSourceAssociationPlacement(placement, panelAssetId, asset)) {
        return;
      }

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
        ? targetIsConnectionView
          ? resolvePanelAssetSchematic(asset, model, symbols)
          : resolvePanelAssetLayout(asset, model, symbols)
        : undefined;
      const placedPlacement = model.sheets
        .flatMap((sheet) => sheet.placements)
        .find((placement) =>
          isPlacedOnTarget(placement, item.assetId, backplaneId)
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
          disabledReason: targetIsConnectionView
            ? "Needs a resolvable drawing symbol"
            : "Needs layout-ready symbol"
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
    parentPanel: sheet.placements.find(
      (placement) =>
        placement.role === "enclosure" &&
        placement.assetId === backplane.containerAssetId
    ),
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


function round(value: number): number {
  return Number(value.toFixed(2));
}

function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
  gap = 4
): boolean {
  return !(
    first.x + first.width + gap <= second.x ||
    second.x + second.width + gap <= first.x ||
    first.y + first.height + gap <= second.y ||
    second.y + second.height + gap <= first.y
  );
}

export function placeAssociatedPanelAssetOnConnectionView({
  model,
  sheetId,
  connectionViewId,
  assetId,
  symbols,
  placementId = `pcv_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}: {
  model: DrawingModel;
  sheetId: string;
  connectionViewId: string;
  assetId: string;
  symbols: ApprovedDrawingSymbol[];
  placementId?: string;
}): { model: DrawingModel; placement: DrawingPlacement } {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  const asset = model.assets.find((candidate) => candidate.id === assetId);
  if (!sheet) throw new Error("Active sheet was not found.");
  if (!asset) throw new Error("Asset was not found in this drawing.");

  const connectionView = sheet.placements.find(
    (placement) =>
      placement.id === connectionViewId &&
      isPanelConnectionViewPlacement(placement)
  );
  if (
    !connectionView ||
    !isPanelConnectionViewPlacement(connectionView) ||
    !connectionView.assetId
  ) {
    throw new Error("Select a panel connection reference first.");
  }
  const sourceBackplanePlacementId =
    connectionView.panelConnectionView.sourceBackplanePlacementId;
  const sourceBackplaneExists = model.sheets.some((candidate) =>
    candidate.placements.some(
      (placement) =>
        placement.id === sourceBackplanePlacementId &&
        isBackplanePlacement(placement) &&
        placement.containerAssetId === connectionView.assetId
    )
  );
  if (!sourceBackplaneExists) {
    throw new Error("The linked physical backplane is no longer available.");
  }
  const catalogItem = buildAssociatedPanelAssetCatalog(
    model,
    symbols,
    connectionView.assetId,
    connectionView.id
  ).find((item) => item.assetId === assetId);
  if (!catalogItem) throw new Error("Asset is not associated with this panel.");
  if (catalogItem.status === "placed") {
    throw new Error(`${catalogItem.tag} is already represented in this panel view.`);
  }

  const schematic = resolvePanelAssetSchematic(asset, model, symbols);
  if (!schematic) {
    throw new Error(`${asset.tag} does not have a resolvable drawing symbol.`);
  }
  const inner = getPanelConnectionViewInnerBounds(connectionView);
  const children = getPanelConnectionViewChildren(
    { placements: sheet.placements },
    connectionView.id
  );
  const viewBox = schematic.symbol.metadata.viewBox;
  const fraction = children.length === 0 ? 0.82 : 0.42;
  const scale = Math.min(
    (inner.width * fraction) / viewBox.width,
    (inner.height * fraction) / viewBox.height
  );
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;
  const occupied = children.flatMap((child) => {
    const symbol = getRenderableSymbolForPlacement(child, symbols, model.assets);
    return symbol ? [getRotatedPlacementBounds(child, symbol.metadata)] : [];
  });
  const centered = {
    x: round(inner.x + (inner.width - width) / 2),
    y: round(inner.y + (inner.height - height) / 2)
  };
  const candidates = [centered];
  for (let y = inner.y; y <= inner.y + inner.height - height; y += 6) {
    for (let x = inner.x; x <= inner.x + inner.width - width; x += 6) {
      candidates.push({ x: round(x), y: round(y) });
    }
  }
  const position = candidates.find((candidate) =>
      occupied.every(
        (bounds) => !overlaps({ ...candidate, width, height }, bounds)
      )
    );
  if (!position) {
    throw new Error("There is not enough clear space inside this panel reference.");
  }
  const placement: DrawingPlacement = {
    id: placementId,
    assetId: asset.id,
    containerAssetId: connectionView.assetId,
    layoutParentId: connectionView.id,
    symbolId: schematic.symbol.symbolId,
    versionId: schematic.symbol.versionId,
    role: roleForAssetType(asset.type),
    tag: asset.tag,
    title: asset.title,
    x: position.x,
    y: position.y,
    rotation: 0,
    scale: round(scale),
    terminalBlock: schematic.terminalBlock
  };

  return {
    placement,
    model: {
      ...model,
      sheets: model.sheets.map((candidate) =>
        candidate.id === sheet.id
          ? { ...candidate, placements: [...candidate.placements, placement] }
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
