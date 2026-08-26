import type {
  DrawingPlacement,
  DrawingSheetCanvasModel as DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { getRotatedPlacementBounds } from "./drawing-geometry";

const PLACEMENT_LABEL_LINE_GAP = 5.2;
const PLACEMENT_LABEL_CLEARANCE = 2.5;
const TAG_FONT_SIZE = 4;
const TITLE_FONT_SIZE = 3.1;
const TITLE_DESCENT_ALLOWANCE = TITLE_FONT_SIZE * 0.25;
const TEXT_WIDTH_FACTOR = 0.58;

type PlacementLabelGeometryInput = {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol;
  sheet: DrawingModel["sheet"];
};

type LabelPair = {
  tagPoint: { x: number; y: number };
  titlePoint: { x: number; y: number };
};

function round(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function estimatedLabelWidth(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): number {
  const tagWidth = placement.tag.length * TAG_FONT_SIZE * TEXT_WIDTH_FACTOR;
  const titleWidth =
    getPlacementDisplayTitle(placement, symbol).length *
    TITLE_FONT_SIZE *
    TEXT_WIDTH_FACTOR;

  return Math.max(tagWidth, titleWidth);
}

function labelBlockBounds(pair: LabelPair) {
  return {
    top: pair.tagPoint.y - TAG_FONT_SIZE,
    bottom: pair.titlePoint.y + TITLE_DESCENT_ALLOWANCE
  };
}

function translateLabelPair(pair: LabelPair, deltaY: number): LabelPair {
  return {
    tagPoint: { x: pair.tagPoint.x, y: round(pair.tagPoint.y + deltaY) },
    titlePoint: {
      x: pair.titlePoint.x,
      y: round(pair.titlePoint.y + deltaY)
    }
  };
}

function clampLabelPairToSheet(
  pair: LabelPair,
  sheet: DrawingModel["sheet"]
): LabelPair {
  const block = labelBlockBounds(pair);
  let deltaY = 0;

  if (block.top < 0) {
    deltaY = -block.top;
  }
  if (block.bottom + deltaY > sheet.height) {
    deltaY -= block.bottom + deltaY - sheet.height;
  }

  return translateLabelPair(pair, deltaY);
}

function defaultPlacementLabelPoints(
  input: PlacementLabelGeometryInput
): LabelPair {
  const bounds = getRotatedPlacementBounds(
    input.placement,
    input.symbol.metadata
  );
  const width = estimatedLabelWidth(input.placement, input.symbol);
  const maximumX = Math.max(0, input.sheet.width - width);
  const x = round(Math.max(0, Math.min(maximumX, bounds.x)));
  const aboveTitleY = bounds.y - PLACEMENT_LABEL_CLEARANCE;
  const above: LabelPair = {
    tagPoint: {
      x,
      y: round(aboveTitleY - PLACEMENT_LABEL_LINE_GAP)
    },
    titlePoint: { x, y: round(aboveTitleY) }
  };

  if (labelBlockBounds(above).top >= 0) {
    return above;
  }

  const belowTagY =
    bounds.bottom + PLACEMENT_LABEL_CLEARANCE + TAG_FONT_SIZE;
  const below: LabelPair = {
    tagPoint: { x, y: round(belowTagY) },
    titlePoint: {
      x,
      y: round(belowTagY + PLACEMENT_LABEL_LINE_GAP)
    }
  };

  if (labelBlockBounds(below).bottom <= input.sheet.height) {
    return below;
  }

  const availableAbove = bounds.y;
  const availableBelow = input.sheet.height - bounds.bottom;
  return clampLabelPairToSheet(
    availableAbove >= availableBelow ? above : below,
    input.sheet
  );
}

export function getPlacementDisplayTitle(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): string {
  return placement.title?.trim() || symbol.displayName.trim();
}

export function shouldShowPlacementTitle(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol
): boolean {
  return Boolean(getPlacementDisplayTitle(placement, symbol));
}

export function getPlacementTitlePoint(
  input: PlacementLabelGeometryInput
): { x: number; y: number } {
  if (input.placement.labelPosition) {
    return input.placement.labelPosition;
  }

  if (input.placement.deviceTitlePosition) {
    return input.placement.deviceTitlePosition;
  }

  return defaultPlacementLabelPoints(input).titlePoint;
}

export function getPlacementLabelPoints(
  input: PlacementLabelGeometryInput
): LabelPair {
  const customTitlePoint =
    input.placement.labelPosition ?? input.placement.deviceTitlePosition;

  if (!customTitlePoint) {
    return defaultPlacementLabelPoints(input);
  }

  return {
    tagPoint: {
      x: customTitlePoint.x,
      y: round(customTitlePoint.y - PLACEMENT_LABEL_LINE_GAP)
    },
    titlePoint: customTitlePoint
  };
}
