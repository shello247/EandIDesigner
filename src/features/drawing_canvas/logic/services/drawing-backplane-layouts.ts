import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getPanelEnclosureBounds,
  getPanelEnclosureTitle,
  isGeneratedPanelEnclosurePlacement
} from "./drawing-asset-containment";
import { placementAssetId } from "./drawing-asset-identity";

export const GENERATED_BACKPLANE_SYMBOL_ID = "__generated_backplane__";
export const GENERATED_BACKPLANE_VERSION_ID = "generated_backplane_v1";
export const GENERATED_BACKPLANE_SYMBOL_KEY = "generated_backplane";
export const BACKPLANE_LABEL = "Backplane";

const BACKPLANE_MARGIN = 4;
const BACKPLANE_HEADER_CLEARANCE = 2;
const BACKPLANE_USABLE_MARGIN = 3;
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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  const bounds = getBackplaneBounds(placement);

  return {
    x: round(bounds.x + BACKPLANE_USABLE_MARGIN),
    y: round(bounds.y + BACKPLANE_USABLE_MARGIN),
    width: round(Math.max(1, bounds.width - BACKPLANE_USABLE_MARGIN * 2)),
    height: round(Math.max(1, bounds.height - BACKPLANE_USABLE_MARGIN * 2))
  };
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

function findParentPanel(
  model: DrawingSheetCanvasModel,
  backplane: DrawingPlacement
): DrawingPlacement | undefined {
  return model.placements.find(
    (placement) =>
      isGeneratedPanelEnclosurePlacement(placement) &&
      backplane.containerAssetId &&
      placementAssetId(placement) === backplane.containerAssetId
  );
}

function clampBackplaneToPanel(
  model: DrawingSheetCanvasModel,
  placement: DrawingPlacement,
  updates: Bounds
): Bounds {
  const panel = findParentPanel(model, placement);

  if (!panel) {
    return {
      x: round(updates.x),
      y: round(updates.y),
      width: round(Math.max(MIN_BACKPLANE_WIDTH, updates.width)),
      height: round(Math.max(MIN_BACKPLANE_HEIGHT, updates.height))
    };
  }

  const defaultBounds = backplaneDefaultBounds(panel);
  const maxRight = defaultBounds.x + defaultBounds.width;
  const maxBottom = defaultBounds.y + defaultBounds.height;
  const width = Math.min(
    Math.max(MIN_BACKPLANE_WIDTH, updates.width),
    defaultBounds.width
  );
  const height = Math.min(
    Math.max(MIN_BACKPLANE_HEIGHT, updates.height),
    defaultBounds.height
  );
  const x = Math.max(defaultBounds.x, Math.min(maxRight - width, updates.x));
  const y = Math.max(defaultBounds.y, Math.min(maxBottom - height, updates.y));

  return {
    x: round(x),
    y: round(y),
    width: round(width),
    height: round(height)
  };
}

export function resizeBackplane(
  model: DrawingSheetCanvasModel,
  placement: DrawingPlacement,
  updates: Bounds
): DrawingPlacement {
  const clamped = clampBackplaneToPanel(model, placement, updates);

  return {
    ...placement,
    x: clamped.x,
    y: clamped.y,
    layoutDimensions: {
      lengthMm: clamped.width,
      widthMm: clamped.height
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

export function autosizeLayoutHelperToBackplane({
  placement,
  backplane,
  symbol
}: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  symbol: ApprovedDrawingSymbol;
}): DrawingPlacement {
  const usable = getBackplaneUsableBounds(backplane);
  const widthMm =
    placement.layoutDimensions?.widthMm ??
    symbol.metadata.physicalHeightMm ??
    symbol.metadata.viewBox.height;
  const lengthMm = usable.width;
  const y = Math.min(
    usable.y + 8,
    usable.y + Math.max(0, usable.height - widthMm)
  );

  return {
    ...assignPlacementToBackplane(placement, backplane),
    x: usable.x,
    y: round(y),
    layoutDimensions: {
      lengthMm: round(lengthMm),
      widthMm: round(widthMm)
    }
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
  placement: DrawingPlacement
): string {
  if (!isBackplanePlacement(placement)) {
    return "";
  }

  const bounds = getBackplaneBounds(placement);
  const usable = getBackplaneUsableBounds(placement);
  const label = `${placement.tag}${placement.title ? ` / ${placement.title}` : ""}`;

  return `
    <g data-placement-id="${placement.id}" data-backplane="true" pointer-events="none">
      <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#f8fafc" fill-opacity="0.42" stroke="#334155" stroke-width="0.36"/>
      <rect x="${usable.x}" y="${usable.y}" width="${usable.width}" height="${usable.height}" fill="none" stroke="#94a3b8" stroke-width="0.24" stroke-dasharray="2.4 2"/>
      <text x="${bounds.x + 3}" y="${bounds.y + 5}" font-family="Arial, Helvetica, sans-serif" font-size="2.8" font-weight="700" fill="#334155">${escapeXml(label)}</text>
    </g>
  `;
}
