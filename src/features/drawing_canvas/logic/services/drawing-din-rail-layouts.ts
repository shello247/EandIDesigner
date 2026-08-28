import type { DrawingPlacement } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

export const DIN_RAIL_REFERENCE_WIDTH_MM = 35;
export const DIN_RAIL_SLOT_WIDTH_MM = 18;
export const DIN_RAIL_SLOT_HEIGHT_MM = 9;
export const DIN_RAIL_SLOT_PITCH_MM = 45;
export const DIN_RAIL_MIN_END_MARGIN_MM = 6;

const RAIL_EDGE_INSET_MM = 0.5;
const RAIL_CORNER_RADIUS_MM = 0.8;

export type DinRailSlotGeometry = {
  index: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  radiusMm: number;
};

export type DinRailRenderGeometry = {
  lengthMm: number;
  widthMm: number;
  slots: DinRailSlotGeometry[];
};

function round(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function positiveDimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? Number(value)
    : fallback;
}

export function deriveDinRailRenderGeometry({
  lengthMm,
  widthMm
}: {
  lengthMm: number;
  widthMm: number;
}): DinRailRenderGeometry {
  const resolvedLength = positiveDimension(lengthMm, 1);
  const resolvedWidth = positiveDimension(widthMm, DIN_RAIL_REFERENCE_WIDTH_MM);
  const availableSlotSpan =
    resolvedLength - DIN_RAIL_MIN_END_MARGIN_MM * 2;
  const slotCount =
    availableSlotSpan < DIN_RAIL_SLOT_WIDTH_MM
      ? 0
      : Math.floor(
          (availableSlotSpan - DIN_RAIL_SLOT_WIDTH_MM) /
            DIN_RAIL_SLOT_PITCH_MM
        ) + 1;
  const patternWidth =
    slotCount > 0
      ? DIN_RAIL_SLOT_WIDTH_MM +
        (slotCount - 1) * DIN_RAIL_SLOT_PITCH_MM
      : 0;
  const firstSlotX = (resolvedLength - patternWidth) / 2;
  const slotY = (resolvedWidth - DIN_RAIL_SLOT_HEIGHT_MM) / 2;

  return {
    lengthMm: round(resolvedLength),
    widthMm: round(resolvedWidth),
    slots: Array.from({ length: slotCount }, (_, index) => ({
      index,
      xMm: round(firstSlotX + index * DIN_RAIL_SLOT_PITCH_MM),
      yMm: round(slotY),
      widthMm: DIN_RAIL_SLOT_WIDTH_MM,
      heightMm: DIN_RAIL_SLOT_HEIGHT_MM,
      radiusMm: DIN_RAIL_SLOT_HEIGHT_MM / 2
    }))
  };
}

function railBodyGeometry(lengthMm: number, widthMm: number) {
  const insetX = Math.min(RAIL_EDGE_INSET_MM, lengthMm / 2);
  const insetY = Math.min(RAIL_EDGE_INSET_MM, widthMm / 2);
  const bodyWidth = Math.max(0, lengthMm - insetX * 2);
  const bodyHeight = Math.max(0, widthMm - insetY * 2);

  return {
    x: round(insetX),
    y: round(insetY),
    width: round(bodyWidth),
    height: round(bodyHeight),
    radius: round(
      Math.min(RAIL_CORNER_RADIUS_MM, bodyWidth / 2, bodyHeight / 2)
    ),
    endX: round(Math.max(insetX, lengthMm - insetX))
  };
}

function horizontalGuideY(widthMm: number, fromTopMm: number): number {
  return round(Math.min(Math.max(fromTopMm, 0), widthMm));
}

export function renderDinRailSvg({
  placement,
  symbol
}: {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol;
}): string {
  const geometry = deriveDinRailRenderGeometry({
    lengthMm:
      placement.layoutDimensions?.lengthMm ??
      symbol.metadata.physicalWidthMm ??
      symbol.metadata.viewBox.width,
    widthMm:
      placement.layoutDimensions?.widthMm ??
      symbol.metadata.physicalHeightMm ??
      DIN_RAIL_REFERENCE_WIDTH_MM
  });
  const body = railBodyGeometry(geometry.lengthMm, geometry.widthMm);
  const viewBox = symbol.metadata.viewBox;
  const slots = geometry.slots
    .map(
      (slot) => `
        <rect
          data-din-rail-slot="true"
          data-slot-index="${slot.index}"
          x="${slot.xMm}"
          y="${slot.yMm}"
          width="${slot.widthMm}"
          height="${slot.heightMm}"
          rx="${slot.radiusMm}"
          fill="#ffffff"
          stroke="#111111"
          stroke-width="0.6"
          vector-effect="non-scaling-stroke"
        />`
    )
    .join("");
  const topOuter = horizontalGuideY(geometry.widthMm, 5.5);
  const topInner = horizontalGuideY(geometry.widthMm, 9.5);
  const bottomInner = horizontalGuideY(geometry.widthMm, geometry.widthMm - 9.5);
  const bottomOuter = horizontalGuideY(geometry.widthMm, geometry.widthMm - 5.5);
  const center = round(geometry.widthMm / 2);

  return `
    <svg
      data-generated-din-rail="true"
      x="${viewBox.x}"
      y="${viewBox.y}"
      width="${viewBox.width}"
      height="${viewBox.height}"
      viewBox="0 0 ${geometry.lengthMm} ${geometry.widthMm}"
      preserveAspectRatio="none"
      overflow="visible"
    >
      <title>Standard TH35 DIN Rail</title>
      <desc>Cut-to-length 35 mm DIN rail with fixed-size mounting slots.</desc>
      <rect x="${body.x}" y="${body.y}" width="${body.width}" height="${body.height}" rx="${body.radius}" fill="#f2f2f2" stroke="#111111" stroke-width="0.8" vector-effect="non-scaling-stroke"/>
      <path d="M${body.x} ${topOuter} H${body.endX}" fill="none" stroke="#111111" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
      <path d="M${body.x} ${bottomOuter} H${body.endX}" fill="none" stroke="#111111" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
      <path d="M${body.x} ${topInner} H${body.endX}" fill="none" stroke="#111111" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
      <path d="M${body.x} ${bottomInner} H${body.endX}" fill="none" stroke="#111111" stroke-width="0.6" vector-effect="non-scaling-stroke"/>
      <path d="M${body.x} ${center} H${body.endX}" fill="none" stroke="#777777" stroke-width="0.3" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      <g data-din-rail-slots="true">${slots}
      </g>
    </svg>
  `;
}
