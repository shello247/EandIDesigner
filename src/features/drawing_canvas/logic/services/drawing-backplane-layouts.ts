import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getPanelEnclosureBounds,
  getPanelEnclosureTitle
} from "./drawing-asset-containment";
import { placementAssetId } from "./drawing-asset-identity";
import {
  getBackplaneDisplayBounds,
  getBackplaneDisplayUsableBounds,
  getBackplanePhysicalUsableBounds,
  resolveBackplaneLayoutScale,
  resolveLayoutHelperDisplayPlacement
} from "./drawing-backplane-scale";

export const GENERATED_BACKPLANE_SYMBOL_ID = "__generated_backplane__";
export const GENERATED_BACKPLANE_VERSION_ID = "generated_backplane_v1";
export const GENERATED_BACKPLANE_SYMBOL_KEY = "generated_backplane";
export const BACKPLANE_LABEL = "Backplane";

const BACKPLANE_MARGIN = 4;
const BACKPLANE_HEADER_CLEARANCE = 2;
const MIN_BACKPLANE_WIDTH = 25;
const MIN_BACKPLANE_HEIGHT = 18;

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function panelHeaderHeight(bounds: Bounds): number {
  return Math.min(12, Math.max(8, bounds.height * 0.12));
}

export function createGeneratedBackplaneLibrarySymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: GENERATED_BACKPLANE_SYMBOL_ID,
    symbolKey: GENERATED_BACKPLANE_SYMBOL_KEY,
    displayName: BACKPLANE_LABEL,
    category: "other",
    versionId: GENERATED_BACKPLANE_VERSION_ID,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="70" fill="none"/></svg>',
    metadata: {
      symbolKey: GENERATED_BACKPLANE_SYMBOL_KEY,
      displayName: BACKPLANE_LABEL,
      category: "other",
      layoutUsage: "panel_layout",
      panelCategory: "other",
      mountingType: "backplate",
      resizable: true,
      physicalWidthMm: 100,
      physicalHeightMm: 70,
      viewBox: { x: 0, y: 0, width: 100, height: 70 },
      anchors: [],
      terminals: []
    }
  };
}

export function isGeneratedBackplaneSymbolReference(input:
  | { symbolId: string; versionId: string }
  | undefined
): boolean {
  return Boolean(
    input &&
      input.symbolId === GENERATED_BACKPLANE_SYMBOL_ID &&
      input.versionId === GENERATED_BACKPLANE_VERSION_ID
  );
}

export function isBackplanePlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  layoutKind: "backplane";
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
} {
  return Boolean(
    placement &&
      placement.layoutKind === "backplane" &&
      isGeneratedBackplaneSymbolReference(placement) &&
      placement.layoutDimensions
  );
}

export function isLayoutHelperPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & { layoutKind: "layout_helper" } {
  return Boolean(placement && placement.layoutKind === "layout_helper");
}

function backplaneDefaultBounds(panelPlacement: DrawingPlacement): Bounds {
  const panelBounds = getPanelEnclosureBounds(panelPlacement);
  const headerHeight = panelHeaderHeight(panelBounds);
  const x = panelBounds.x + BACKPLANE_MARGIN;
  const y =
    panelBounds.y + headerHeight + BACKPLANE_MARGIN + BACKPLANE_HEADER_CLEARANCE;
  const maxWidth = Math.max(
    MIN_BACKPLANE_WIDTH,
    panelBounds.width - BACKPLANE_MARGIN * 2
  );
  const maxHeight = Math.max(
    MIN_BACKPLANE_HEIGHT,
    panelBounds.height - headerHeight - BACKPLANE_MARGIN * 2 - BACKPLANE_HEADER_CLEARANCE
  );

  return {
    x: round(x),
    y: round(y),
    width: round(maxWidth),
    height: round(maxHeight)
  };
}

export function createBackplanePlacement({
  panelPlacement,
  id = `bp_${Date.now()}`
}: {
  panelPlacement: DrawingPlacement;
  id?: string;
}): DrawingPlacement {
  const bounds = backplaneDefaultBounds(panelPlacement);

  return {
    id,
    symbolId: GENERATED_BACKPLANE_SYMBOL_ID,
    versionId: GENERATED_BACKPLANE_VERSION_ID,
    role: "other",
    tag: BACKPLANE_LABEL,
    title: getPanelEnclosureTitle(panelPlacement),
    containerAssetId: placementAssetId(panelPlacement),
    x: bounds.x,
    y: bounds.y,
    rotation: 0,
    scale: 1,
    layoutKind: "backplane",
    layoutScale: {
      mode: "auto"
    },
    layoutDimensions: {
      lengthMm: bounds.width,
      widthMm: bounds.height
    }
  };
}

export function getBackplaneBounds(placement: DrawingPlacement): Bounds {
  return {
    x: placement.x,
    y: placement.y,
    width: placement.layoutDimensions?.lengthMm ?? MIN_BACKPLANE_WIDTH,
    height: placement.layoutDimensions?.widthMm ?? MIN_BACKPLANE_HEIGHT
  };
}

export function getBackplaneUsableBounds(placement: DrawingPlacement): Bounds {
  return getBackplanePhysicalUsableBounds(placement);
}

export function getBackplanesForSheet(
  model: DrawingSheetCanvasModel
): Array<DrawingPlacement & {
  layoutKind: "backplane";
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
}> {
  return model.placements.filter(isBackplanePlacement);
}

export function getLayoutChildrenForBackplane(
  model: DrawingSheetCanvasModel,
  backplaneId: string
): DrawingPlacement[] {
  return model.placements.filter(
    (placement) => placement.layoutParentId === backplaneId
  );
}

export function resizeBackplane(
  model: DrawingSheetCanvasModel,
  placement: DrawingPlacement,
  updates: Bounds
): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(model.sheet, placement);

  return {
    ...placement,
    x: round(updates.x),
    y: round(updates.y),
    layoutDimensions: {
      lengthMm: round(Math.max(MIN_BACKPLANE_WIDTH, updates.width / scale.factor)),
      widthMm: round(Math.max(MIN_BACKPLANE_HEIGHT, updates.height / scale.factor))
    }
  };
}

export function assignPlacementToBackplane(
  placement: DrawingPlacement,
  backplane: DrawingPlacement
): DrawingPlacement {
  return {
    ...placement,
    layoutKind: placement.layoutKind ?? "layout_helper",
    layoutParentId: backplane.id,
    containerAssetId: backplane.containerAssetId
  };
}

export function shouldAutosizeLayoutSymbolToBackplane(
  symbol: ApprovedDrawingSymbol
): boolean {
  return (
    symbol.metadata.resizable === true ||
    symbol.metadata.panelCategory === "rail" ||
    symbol.metadata.panelCategory === "ducting"
  );
}

export function normalizeLayoutHelperDimensionsForSymbol(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): DrawingPlacement {
  if (
    !isLayoutHelperPlacement(placement) ||
    placement.layoutDimension ||
    shouldAutosizeLayoutSymbolToBackplane(symbol)
  ) {
    return placement;
  }

  const lengthMm =
    symbol.metadata.physicalWidthMm ??
    placement.layoutDimensions?.lengthMm ??
    symbol.metadata.viewBox.width;
  const widthMm =
    symbol.metadata.physicalHeightMm ??
    placement.layoutDimensions?.widthMm ??
    symbol.metadata.viewBox.height;

  return {
    ...placement,
    layoutDimensions: {
      lengthMm: round(lengthMm),
      widthMm: round(widthMm)
    }
  };
}

export function autosizeLayoutHelperToBackplane({
  placement,
  backplane,
  symbol,
  sheet
}: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  symbol: ApprovedDrawingSymbol;
  sheet?: DrawingSheetCanvasModel["sheet"];
}): DrawingPlacement {
  const usable = getBackplaneUsableBounds(backplane);
  const widthMm =
    placement.layoutDimensions?.widthMm ??
    symbol.metadata.physicalHeightMm ??
    symbol.metadata.viewBox.height;
  const requestedLengthMm =
    placement.layoutDimensions?.lengthMm ??
    symbol.metadata.physicalWidthMm ??
    symbol.metadata.viewBox.width;
  const shouldAutosize = shouldAutosizeLayoutSymbolToBackplane(symbol);
  const lengthMm = shouldAutosize ? usable.width : requestedLengthMm;
  const x = shouldAutosize
    ? usable.x
    : Math.min(
        usable.x + 8,
        usable.x + Math.max(0, usable.width - lengthMm)
      );
  const y = Math.min(
    usable.y + 8,
    usable.y + Math.max(0, usable.height - widthMm)
  );
  const physicalPlacement = {
    ...assignPlacementToBackplane(
      normalizeLayoutHelperDimensionsForSymbol(placement, symbol),
      backplane
    ),
    layoutPosition: {
      xMm: round(x),
      yMm: round(y)
    },
    layoutDimensions: {
      lengthMm: round(lengthMm),
      widthMm: round(widthMm)
    }
  };

  if (sheet) {
    const displayPlacement = resolveLayoutHelperDisplayPlacement({
        sheet,
        placement: physicalPlacement,
        backplane
      });

    return {
      ...physicalPlacement,
      x: displayPlacement.x,
      y: displayPlacement.y
    };
  }

  return {
    ...physicalPlacement,
    x: round(backplane.x + x),
    y: round(backplane.y + y)
  };
}

export function containedPlacementIdsForBackplanes(
  model: DrawingSheetCanvasModel,
  backplanePlacementIds: Iterable<string>
): string[] {
  const backplaneIds = new Set(backplanePlacementIds);

  if (backplaneIds.size === 0) {
    return [];
  }

  return model.placements
    .filter(
      (placement) =>
        placement.layoutParentId && backplaneIds.has(placement.layoutParentId)
    )
    .map((placement) => placement.id);
}

export function renderBackplanePlacement(
  placement: DrawingPlacement,
  sheet: DrawingSheetCanvasModel["sheet"]
): string {
  if (!isBackplanePlacement(placement)) {
    return "";
  }

  const bounds = getBackplaneDisplayBounds(sheet, placement);
  const usable = getBackplaneDisplayUsableBounds(sheet, placement);

  return `
    <g data-placement-id="${placement.id}" data-backplane="true" pointer-events="none">
      <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#f8fafc" fill-opacity="0.42" stroke="#334155" stroke-width="0.36"/>
      <rect x="${usable.x}" y="${usable.y}" width="${usable.width}" height="${usable.height}" fill="none" stroke="#94a3b8" stroke-width="0.24" stroke-dasharray="2.4 2"/>
    </g>
  `;
}
