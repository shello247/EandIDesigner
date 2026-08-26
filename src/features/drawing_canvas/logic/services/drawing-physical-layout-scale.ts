import type { DrawingPlacement } from "../../data/schema";

export type PhysicalLayoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResolvedPhysicalLayoutScale = {
  mode: "auto" | "manual";
  denominator: number;
  factor: number;
  label: string;
  fits: boolean;
};

export const STANDARD_PHYSICAL_SCALE_DENOMINATORS = [
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
] as const;

export const PANEL_ENCLOSURE_SCALE_DENOMINATORS = [
  1,
  1.5,
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
] as const;

const PRINT_MARGIN = 10;
const TITLE_BLOCK_HEIGHT = 36;
const TITLE_BLOCK_MARGIN = 6;
const TITLE_BLOCK_CLEARANCE = 6;

function round(value: number): number {
  return Number(value.toFixed(2));
}

function positiveDimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
}

export function getPhysicalLayoutPrintableArea(sheet: {
  width: number;
  height: number;
}): PhysicalLayoutBounds {
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

export function resolvePhysicalLayoutScale({
  sheet,
  physicalWidth,
  physicalHeight,
  layoutScale,
  area = getPhysicalLayoutPrintableArea(sheet),
  denominators = STANDARD_PHYSICAL_SCALE_DENOMINATORS
}: {
  sheet: { width: number; height: number };
  physicalWidth: number;
  physicalHeight: number;
  layoutScale?: DrawingPlacement["layoutScale"];
  area?: PhysicalLayoutBounds;
  denominators?: readonly number[];
}): ResolvedPhysicalLayoutScale {
  const width = positiveDimension(physicalWidth, 1);
  const height = positiveDimension(physicalHeight, 1);

  if (
    layoutScale?.mode === "manual" &&
    Number.isFinite(layoutScale.value) &&
    layoutScale.value &&
    layoutScale.value > 0
  ) {
    const denominator = layoutScale.value;
    const factor = 1 / denominator;

    return {
      mode: "manual",
      denominator,
      factor,
      label: `1:${denominator}`,
      fits: width * factor <= area.width && height * factor <= area.height
    };
  }

  const fitFactor = Math.min(area.width / width, area.height / height);
  const denominator =
    denominators.find((candidate) => 1 / candidate <= fitFactor) ??
    denominators[denominators.length - 1] ?? 1;
  const factor = 1 / denominator;

  return {
    mode: "auto",
    denominator,
    factor,
    label: `1:${denominator}`,
    fits: width * factor <= area.width && height * factor <= area.height
  };
}

export function centerPhysicalLayoutBounds({
  area,
  physicalWidth,
  physicalHeight,
  scale
}: {
  area: PhysicalLayoutBounds;
  physicalWidth: number;
  physicalHeight: number;
  scale: Pick<ResolvedPhysicalLayoutScale, "factor">;
}): Pick<PhysicalLayoutBounds, "x" | "y"> {
  return {
    x: round(area.x + (area.width - physicalWidth * scale.factor) / 2),
    y: round(area.y + (area.height - physicalHeight * scale.factor) / 2)
  };
}

export function maximumAutoScalePhysicalSize(sheet: {
  width: number;
  height: number;
}): { width: number; height: number } {
  const area = getPhysicalLayoutPrintableArea(sheet);
  const maximumDenominator =
    STANDARD_PHYSICAL_SCALE_DENOMINATORS[
      STANDARD_PHYSICAL_SCALE_DENOMINATORS.length - 1
    ];

  return {
    width: round(area.width * maximumDenominator),
    height: round(area.height * maximumDenominator)
  };
}
