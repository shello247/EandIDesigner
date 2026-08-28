import type {
  DrawingModel,
  DrawingPackageSheet,
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getRotatedPlacementBounds } from "./drawing-geometry";
import { getRenderableSymbolForPlacement } from "./drawing-generated-symbols";
import { getPhysicalLayoutPrintableArea } from "./drawing-physical-layout-scale";
import { isBackplanePlacement } from "./drawing-backplane-layouts";

export const GENERATED_PANEL_CONNECTION_VIEW_SYMBOL_ID =
  "__generated_panel_connection_view__";
export const GENERATED_PANEL_CONNECTION_VIEW_VERSION_ID =
  "generated_panel_connection_view_v1";

export const PANEL_CONNECTION_VIEW_HEADER_HEIGHT = 10;
export const PANEL_CONNECTION_VIEW_INSET = 6;
export const PANEL_CONNECTION_VIEW_MIN_WIDTH = 60;
export const PANEL_CONNECTION_VIEW_MIN_HEIGHT = 70;
export const PANEL_CONNECTION_VIEW_DEFAULT_WIDTH = 110;
export const PANEL_CONNECTION_VIEW_DEFAULT_HEIGHT = 120;

export type PanelConnectionViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelConnectionViewSource = {
  placementId: string;
  sheetId: string;
  sheetNumber: number;
  sheetName: string;
  label: string;
};

const round = (value: number) => Number(value.toFixed(2));

export function isPanelConnectionViewPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  panelConnectionView: NonNullable<DrawingPlacement["panelConnectionView"]>;
} {
  return placement?.panelConnectionView?.kind === "schematic_reference";
}

export function getPanelConnectionViewBounds(
  placement: DrawingPlacement
): PanelConnectionViewBounds {
  return {
    x: placement.x,
    y: placement.y,
    width: placement.panelConnectionView?.displayWidth ?? 0,
    height: placement.panelConnectionView?.displayHeight ?? 0
  };
}

export function getPanelConnectionViewInnerBounds(
  placement: DrawingPlacement
): PanelConnectionViewBounds {
  const bounds = getPanelConnectionViewBounds(placement);
  return {
    x: round(bounds.x + PANEL_CONNECTION_VIEW_INSET),
    y: round(
      bounds.y + PANEL_CONNECTION_VIEW_HEADER_HEIGHT + PANEL_CONNECTION_VIEW_INSET
    ),
    width: round(Math.max(1, bounds.width - PANEL_CONNECTION_VIEW_INSET * 2)),
    height: round(
      Math.max(
        1,
        bounds.height -
          PANEL_CONNECTION_VIEW_HEADER_HEIGHT -
          PANEL_CONNECTION_VIEW_INSET * 2
      )
    )
  };
}

export function getPanelConnectionViewChildren(
  model: Pick<DrawingSheetCanvasModel, "placements">,
  placementId: string
): DrawingPlacement[] {
  return model.placements.filter(
    (placement) => placement.layoutParentId === placementId
  );
}

export function listPanelConnectionViewSources(
  model: DrawingModel,
  panelAssetId: string
): PanelConnectionViewSource[] {
  return model.sheets
    .flatMap((sheet, sheetIndex) =>
      sheet.placements.flatMap((placement) =>
        isBackplanePlacement(placement) &&
        placement.containerAssetId === panelAssetId
          ? [
              {
                placementId: placement.id,
                sheetId: sheet.id,
                sheetNumber: sheetIndex + 1,
                sheetName: sheet.name,
                label: `${placement.tag || "Backplane"} / Sheet ${sheetIndex + 1}: ${sheet.name}`
              }
            ]
          : []
      )
    )
    .sort(
      (first, second) =>
        first.sheetNumber - second.sheetNumber ||
        first.placementId.localeCompare(second.placementId)
    );
}

function overlaps(
  first: PanelConnectionViewBounds,
  second: PanelConnectionViewBounds,
  gap = 6
): boolean {
  return !(
    first.x + first.width + gap <= second.x ||
    second.x + second.width + gap <= first.x ||
    first.y + first.height + gap <= second.y ||
    second.y + second.height + gap <= first.y
  );
}

function defaultViewSize(sheet: DrawingPackageSheet): {
  width: number;
  height: number;
} {
  const area = getPhysicalLayoutPrintableArea(sheet.page);
  return {
    width: round(
      Math.max(
        PANEL_CONNECTION_VIEW_MIN_WIDTH,
        Math.min(PANEL_CONNECTION_VIEW_DEFAULT_WIDTH, area.width * 0.42)
      )
    ),
    height: round(
      Math.max(
        PANEL_CONNECTION_VIEW_MIN_HEIGHT,
        Math.min(PANEL_CONNECTION_VIEW_DEFAULT_HEIGHT, area.height * 0.62)
      )
    )
  };
}

function findConnectionViewPosition({
  sheet,
  width,
  height,
  preferred
}: {
  sheet: DrawingPackageSheet;
  width: number;
  height: number;
  preferred?: { x: number; y: number };
}): { x: number; y: number } {
  const area = getPhysicalLayoutPrintableArea(sheet.page);
  const occupied = sheet.placements.flatMap((placement) => {
    if (isPanelConnectionViewPlacement(placement)) {
      return [getPanelConnectionViewBounds(placement)];
    }
    return [];
  });
  const maximumX = Math.max(area.x, area.x + area.width - width);
  const maximumY = Math.max(area.y, area.y + area.height - height);
  const start = {
    x: round(Math.min(maximumX, Math.max(area.x, preferred?.x ?? area.x))),
    y: round(Math.min(maximumY, Math.max(area.y, preferred?.y ?? area.y)))
  };
  const candidates = [start];

  for (let y = area.y; y <= maximumY; y += 10) {
    for (let x = area.x; x <= maximumX; x += 10) {
      candidates.push({ x: round(x), y: round(y) });
    }
  }

  return (
    candidates.find((candidate) =>
      occupied.every(
        (bounds) => !overlaps({ ...candidate, width, height }, bounds)
      )
    ) ?? start
  );
}

function createPlacementId(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `panel_connection_view_${suffix}`;
}

export function createPanelConnectionView({
  model,
  activeSheet,
  assetId,
  tag,
  title,
  sourceBackplanePlacementId,
  preferredPosition
}: {
  model: DrawingModel;
  activeSheet: DrawingPackageSheet;
  assetId: string;
  tag: string;
  title: string;
  sourceBackplanePlacementId: string;
  preferredPosition?: { x: number; y: number };
}): DrawingPlacement {
  const source = listPanelConnectionViewSources(model, assetId).find(
    (candidate) => candidate.placementId === sourceBackplanePlacementId
  );
  if (!source) {
    throw new Error("Choose an authoritative backplane for this panel reference.");
  }
  const { width, height } = defaultViewSize(activeSheet);
  const position = findConnectionViewPosition({
    sheet: activeSheet,
    width,
    height,
    preferred: preferredPosition
  });
  return {
    id: createPlacementId(),
    assetId,
    symbolId: GENERATED_PANEL_CONNECTION_VIEW_SYMBOL_ID,
    versionId: GENERATED_PANEL_CONNECTION_VIEW_VERSION_ID,
    role: "enclosure",
    tag,
    title,
    x: position.x,
    y: position.y,
    rotation: 0,
    scale: 1,
    panelConnectionView: {
      kind: "schematic_reference",
      sourceBackplanePlacementId,
      displayWidth: width,
      displayHeight: height
    }
  };
}

export function resizePanelConnectionView({
  model,
  placement,
  x,
  y,
  width,
  height,
  symbols,
  assets = []
}: {
  model: DrawingSheetCanvasModel;
  placement: DrawingPlacement;
  x: number;
  y: number;
  width: number;
  height: number;
  symbols: ApprovedDrawingSymbol[];
  assets?: DrawingModel["assets"];
}): Partial<DrawingPlacement> {
  const children = getPanelConnectionViewChildren(model, placement.id);
  const childBounds = children.flatMap((child) => {
    const symbol = getRenderableSymbolForPlacement(child, symbols, assets);
    return symbol ? [getRotatedPlacementBounds(child, symbol.metadata)] : [];
  });
  const minimumRight = Math.max(
    x + PANEL_CONNECTION_VIEW_MIN_WIDTH,
    ...childBounds.map((bounds) => bounds.right + PANEL_CONNECTION_VIEW_INSET)
  );
  const minimumBottom = Math.max(
    y + PANEL_CONNECTION_VIEW_MIN_HEIGHT,
    ...childBounds.map((bounds) => bounds.bottom + PANEL_CONNECTION_VIEW_INSET)
  );
  const maximumLeft = Math.min(
    x,
    ...childBounds.map((bounds) => bounds.x - PANEL_CONNECTION_VIEW_INSET)
  );
  const maximumTop = Math.min(
    y,
    ...childBounds.map((bounds) => bounds.y - PANEL_CONNECTION_VIEW_INSET)
  );
  const right = Math.max(x + width, minimumRight);
  const bottom = Math.max(y + height, minimumBottom);
  return {
    x: round(maximumLeft),
    y: round(maximumTop),
    panelConnectionView: {
      ...placement.panelConnectionView!,
      displayWidth: round(
        Math.max(PANEL_CONNECTION_VIEW_MIN_WIDTH, right - maximumLeft)
      ),
      displayHeight: round(
        Math.max(PANEL_CONNECTION_VIEW_MIN_HEIGHT, bottom - maximumTop)
      )
    }
  };
}

export function fitPanelConnectionViewContents({
  model,
  placement,
  symbols,
  assets = []
}: {
  model: DrawingSheetCanvasModel;
  placement: DrawingPlacement;
  symbols: ApprovedDrawingSymbol[];
  assets?: DrawingModel["assets"];
}): DrawingSheetCanvasModel {
  const children = getPanelConnectionViewChildren(model, placement.id)
    .map((child) => ({
      child,
      symbol: getRenderableSymbolForPlacement(child, symbols, assets)
    }))
    .filter(
      (entry): entry is { child: DrawingPlacement; symbol: ApprovedDrawingSymbol } =>
        Boolean(entry.symbol)
    );
  if (children.length === 0) {
    return model;
  }
  const inner = getPanelConnectionViewInnerBounds(placement);
  const bounds = children.map(({ child, symbol }) =>
    getRotatedPlacementBounds(child, symbol.metadata)
  );
  const left = Math.min(...bounds.map((bound) => bound.x));
  const top = Math.min(...bounds.map((bound) => bound.y));
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));
  const targetFraction = children.length === 1 ? 0.82 : 0.9;
  const factor = Math.min(
    (inner.width * targetFraction) / Math.max(1, right - left),
    (inner.height * targetFraction) / Math.max(1, bottom - top)
  );
  const nextWidth = (right - left) * factor;
  const nextHeight = (bottom - top) * factor;
  const targetLeft = inner.x + (inner.width - nextWidth) / 2;
  const targetTop = inner.y + (inner.height - nextHeight) / 2;
  const childIds = new Set(children.map(({ child }) => child.id));
  return {
    ...model,
    placements: model.placements.map((candidate) =>
      childIds.has(candidate.id)
        ? {
            ...candidate,
            x: round(targetLeft + (candidate.x - left) * factor),
            y: round(targetTop + (candidate.y - top) * factor),
            scale: round(candidate.scale * factor),
            labelPosition: candidate.labelPosition
              ? {
                  x: round(targetLeft + (candidate.labelPosition.x - left) * factor),
                  y: round(targetTop + (candidate.labelPosition.y - top) * factor)
                }
              : candidate.labelPosition,
            deviceTitlePosition: candidate.deviceTitlePosition
              ? {
                  x: round(
                    targetLeft + (candidate.deviceTitlePosition.x - left) * factor
                  ),
                  y: round(
                    targetTop + (candidate.deviceTitlePosition.y - top) * factor
                  )
                }
              : candidate.deviceTitlePosition
          }
        : candidate
    )
  };
}
