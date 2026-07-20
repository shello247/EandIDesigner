import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";

export type BackplaneBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResolvedBackplaneScale = {
  mode: "auto" | "manual";
  denominator: number;
  factor: number;
  label: string;
};

const STANDARD_SCALE_DENOMINATORS = [
  1,
  2,
  2.5,
  3,
  4,
  5,
  10,
  20,
  25,
  50,
  100
];
const PRINT_MARGIN = 10;
const TITLE_BLOCK_HEIGHT = 36;
const TITLE_BLOCK_MARGIN = 6;
const TITLE_BLOCK_CLEARANCE = 6;
const BACKPLANE_USABLE_MARGIN = 3;

function round(value: number): number {
  return Number(value.toFixed(2));
}

function formatDenominator(denominator: number): string {
  return Number.isInteger(denominator)
    ? String(denominator)
    : String(denominator);
}

function scaleLabel(denominator: number): string {
  return `1:${formatDenominator(denominator)}`;
}

function positiveDimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
}

export function getBackplanePrintableArea(
  sheet: DrawingSheetCanvasModel["sheet"]
): BackplaneBounds {
  const titleBlockTop = sheet.height - TITLE_BLOCK_MARGIN - TITLE_BLOCK_HEIGHT;
  const bottom = Math.max(
    PRINT_MARGIN + 20,
    titleBlockTop - TITLE_BLOCK_CLEARANCE
  );

  return {
    x: PRINT_MARGIN,
    y: PRINT_MARGIN,
    width: round(Math.max(20, sheet.width - PRINT_MARGIN * 2)),
    height: round(Math.max(20, bottom - PRINT_MARGIN))
  };
}

export function resolveBackplaneLayoutScale(
  sheet: DrawingSheetCanvasModel["sheet"],
  backplane: DrawingPlacement
): ResolvedBackplaneScale {
  const requestedManualScale = backplane.layoutScale;

  if (
    requestedManualScale?.mode === "manual" &&
    Number.isFinite(requestedManualScale.value) &&
    requestedManualScale.value &&
    requestedManualScale.value > 0
  ) {
    const denominator = requestedManualScale.value;

    return {
      mode: "manual",
      denominator,
      factor: 1 / denominator,
      label: scaleLabel(denominator)
    };
  }

  const physicalWidth = positiveDimension(backplane.layoutDimensions?.lengthMm, 1);
  const physicalHeight = positiveDimension(backplane.layoutDimensions?.widthMm, 1);
  const printableArea = getBackplanePrintableArea(sheet);
  const fitFactor = Math.min(
    printableArea.width / physicalWidth,
    printableArea.height / physicalHeight
  );
  const denominator =
    STANDARD_SCALE_DENOMINATORS.find((candidate) => 1 / candidate <= fitFactor) ??
    STANDARD_SCALE_DENOMINATORS[STANDARD_SCALE_DENOMINATORS.length - 1];

  return {
    mode: "auto",
    denominator,
    factor: 1 / denominator,
    label: scaleLabel(denominator)
  };
}

export function getBackplanePhysicalBounds(
  backplane: DrawingPlacement
): BackplaneBounds {
  return {
    x: 0,
    y: 0,
    width: positiveDimension(backplane.layoutDimensions?.lengthMm, 25),
    height: positiveDimension(backplane.layoutDimensions?.widthMm, 18)
  };
}

export function getBackplanePhysicalUsableBounds(
  backplane: DrawingPlacement
): BackplaneBounds {
  const bounds = getBackplanePhysicalBounds(backplane);

  return {
    x: BACKPLANE_USABLE_MARGIN,
    y: BACKPLANE_USABLE_MARGIN,
    width: round(Math.max(1, bounds.width - BACKPLANE_USABLE_MARGIN * 2)),
    height: round(Math.max(1, bounds.height - BACKPLANE_USABLE_MARGIN * 2))
  };
}

export function physicalRectToSheetRect({
  sheet,
  backplane,
  rect
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  rect: BackplaneBounds;
}): BackplaneBounds {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);

  return {
    x: round(backplane.x + rect.x * scale.factor),
    y: round(backplane.y + rect.y * scale.factor),
    width: round(rect.width * scale.factor),
    height: round(rect.height * scale.factor)
  };
}

export function getBackplaneDisplayBounds(
  sheet: DrawingSheetCanvasModel["sheet"],
  backplane: DrawingPlacement
): BackplaneBounds {
  return physicalRectToSheetRect({
    sheet,
    backplane,
    rect: getBackplanePhysicalBounds(backplane)
  });
}

export function getBackplaneCenteredPosition({
  sheet,
  backplane,
  area
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  area: BackplaneBounds;
}): Pick<BackplaneBounds, "x" | "y"> {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);
  const physicalBounds = getBackplanePhysicalBounds(backplane);
  const displayWidth = physicalBounds.width * scale.factor;
  const displayHeight = physicalBounds.height * scale.factor;

  return {
    x: round(area.x + (area.width - displayWidth) / 2),
    y: round(area.y + (area.height - displayHeight) / 2)
  };
}

export function getBackplaneDisplayUsableBounds(
  sheet: DrawingSheetCanvasModel["sheet"],
  backplane: DrawingPlacement
): BackplaneBounds {
  return physicalRectToSheetRect({
    sheet,
    backplane,
    rect: getBackplanePhysicalUsableBounds(backplane)
  });
}

export function inferLayoutPositionFromDisplay(
  sheet: DrawingSheetCanvasModel["sheet"],
  placement: DrawingPlacement,
  backplane: DrawingPlacement
): NonNullable<DrawingPlacement["layoutPosition"]> {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);

  return {
    xMm: round((placement.x - backplane.x) / scale.factor),
    yMm: round((placement.y - backplane.y) / scale.factor)
  };
}

export function getLayoutPosition(
  sheet: DrawingSheetCanvasModel["sheet"],
  placement: DrawingPlacement,
  backplane: DrawingPlacement
): NonNullable<DrawingPlacement["layoutPosition"]> {
  return placement.layoutPosition ?? inferLayoutPositionFromDisplay(
    sheet,
    placement,
    backplane
  );
}

export function resolveLayoutHelperDisplayPlacement({
  sheet,
  placement,
  backplane
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);
  const layoutPosition = getLayoutPosition(sheet, placement, backplane);
  const physicalLength = positiveDimension(placement.layoutDimensions?.lengthMm, 1);
  const physicalWidth = positiveDimension(placement.layoutDimensions?.widthMm, 1);

  return {
    ...placement,
    x: round(backplane.x + layoutPosition.xMm * scale.factor),
    y: round(backplane.y + layoutPosition.yMm * scale.factor),
    layoutDimensions: {
      lengthMm: round(physicalLength * scale.factor),
      widthMm: round(physicalWidth * scale.factor)
    }
  };
}

export function resizeLayoutHelperFromDisplayBounds({
  sheet,
  placement,
  backplane,
  bounds
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  bounds: BackplaneBounds;
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);

  return {
    ...placement,
    x: round(bounds.x),
    y: round(bounds.y),
    layoutPosition: {
      xMm: round((bounds.x - backplane.x) / scale.factor),
      yMm: round((bounds.y - backplane.y) / scale.factor)
    },
    layoutDimensions: {
      lengthMm: round(bounds.width / scale.factor),
      widthMm: round(bounds.height / scale.factor)
    }
  };
}

export function moveLayoutHelperByDisplayDelta({
  sheet,
  placement,
  backplane,
  delta
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  delta: { x: number; y: number };
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane);
  const layoutPosition = getLayoutPosition(sheet, placement, backplane);

  return {
    ...placement,
    x: round(placement.x + delta.x),
    y: round(placement.y + delta.y),
    layoutPosition: {
      xMm: round(layoutPosition.xMm + delta.x / scale.factor),
      yMm: round(layoutPosition.yMm + delta.y / scale.factor)
    },
    labelPosition: placement.labelPosition
      ? {
          x: round(placement.labelPosition.x + delta.x),
          y: round(placement.labelPosition.y + delta.y)
        }
      : placement.labelPosition
  };
}

export function resolveDrawingBackplaneScaleLabel(
  model: DrawingSheetCanvasModel
): string {
  const scaleLabels = new Set(
    model.placements
      .filter(
        (placement) =>
          placement.layoutKind === "backplane" && placement.layoutDimensions
      )
      .map((placement) => resolveBackplaneLayoutScale(model.sheet, placement).label)
  );

  if (scaleLabels.size === 0) {
    return "NTS";
  }

  if (scaleLabels.size === 1) {
    return [...scaleLabels][0];
  }

  return "AS NOTED";
}
