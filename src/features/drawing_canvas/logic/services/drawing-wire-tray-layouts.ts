import type { DrawingPlacement, DrawingSheetCanvasModel } from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";

export const GENERATED_WIRE_TRAY_SYMBOL_ID = "__generated_wire_tray__";
export const GENERATED_WIRE_TRAY_VERSION_ID = "generated_wire_tray_v1";
export const GENERATED_WIRE_TRAY_SYMBOL_KEY = "generated_wire_tray";
export const WIRE_TRAY_LABEL = "Wire Tray / Duct";

const WIRE_TRAY_VIEWBOX_WIDTH = 200;
const WIRE_TRAY_VIEWBOX_HEIGHT = 40;
const MITER_TOLERANCE_MM = 2;

type Point = {
  x: number;
  y: number;
};

type WireTrayEnd = "start" | "end";

export type WireTrayMiterEnds = {
  start: boolean;
  end: boolean;
};

export function createGeneratedWireTrayLibrarySymbol(): ApprovedDrawingSymbol {
  return {
    symbolId: GENERATED_WIRE_TRAY_SYMBOL_ID,
    symbolKey: GENERATED_WIRE_TRAY_SYMBOL_KEY,
    displayName: WIRE_TRAY_LABEL,
    category: "other",
    versionId: GENERATED_WIRE_TRAY_VERSION_ID,
    versionNumber: 1,
    svg: '<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="200" height="40" fill="none"/></svg>',
    metadata: {
      symbolKey: GENERATED_WIRE_TRAY_SYMBOL_KEY,
      displayName: WIRE_TRAY_LABEL,
      category: "other",
      layoutUsage: "panel_layout",
      panelCategory: "ducting",
      mountingType: "backplate",
      resizable: true,
      physicalWidthMm: 200,
      physicalHeightMm: 40,
      viewBox: {
        x: 0,
        y: 0,
        width: WIRE_TRAY_VIEWBOX_WIDTH,
        height: WIRE_TRAY_VIEWBOX_HEIGHT
      },
      anchors: [],
      terminals: []
    }
  };
}

export function isGeneratedWireTraySymbolReference(input:
  | { symbolId: string; versionId: string }
  | undefined
): boolean {
  return Boolean(
    input &&
      input.symbolId === GENERATED_WIRE_TRAY_SYMBOL_ID &&
      input.versionId === GENERATED_WIRE_TRAY_VERSION_ID
  );
}

export function isWireTrayPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  layoutKind: "layout_helper";
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
  layoutPosition: NonNullable<DrawingPlacement["layoutPosition"]>;
} {
  return Boolean(
    placement &&
      placement.layoutKind === "layout_helper" &&
      placement.layoutDimensions &&
      placement.layoutPosition &&
      isGeneratedWireTraySymbolReference(placement)
  );
}

function normalizedOrthogonalRotation(value: number): 0 | 90 | 180 | 270 | undefined {
  const normalized = ((value % 360) + 360) % 360;
  const candidates = [0, 90, 180, 270] as const;

  return candidates.find((candidate) => Math.abs(normalized - candidate) < 0.001);
}

function unitVector(rotation: 0 | 90 | 180 | 270): Point {
  switch (rotation) {
    case 90:
      return { x: 0, y: 1 };
    case 180:
      return { x: -1, y: 0 };
    case 270:
      return { x: 0, y: -1 };
    case 0:
    default:
      return { x: 1, y: 0 };
  }
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function angleDifference(first: number, second: number): number {
  const difference = Math.abs((((first - second) % 360) + 540) % 360 - 180);

  return Math.min(difference, 360 - difference);
}

function trayEndpoint(
  placement: DrawingPlacement & {
    layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
    layoutPosition: NonNullable<DrawingPlacement["layoutPosition"]>;
  },
  end: WireTrayEnd
): Point | undefined {
  const rotation = normalizedOrthogonalRotation(placement.rotation);

  if (rotation === undefined) {
    return undefined;
  }

  const axis = unitVector(rotation);
  const length = placement.layoutDimensions.lengthMm;
  const center = {
    x: placement.layoutPosition.xMm + length / 2,
    y: placement.layoutPosition.yMm + placement.layoutDimensions.widthMm / 2
  };
  const direction = end === "start" ? -1 : 1;

  return {
    x: center.x + axis.x * (length / 2) * direction,
    y: center.y + axis.y * (length / 2) * direction
  };
}

function traysMeetOrthogonally(
  first: DrawingPlacement,
  firstEnd: WireTrayEnd,
  second: DrawingPlacement
): boolean {
  if (
    !isWireTrayPlacement(first) ||
    !isWireTrayPlacement(second) ||
    first.id === second.id ||
    first.layoutParentId !== second.layoutParentId
  ) {
    return false;
  }

  const firstRotation = normalizedOrthogonalRotation(first.rotation);
  const secondRotation = normalizedOrthogonalRotation(second.rotation);

  if (
    firstRotation === undefined ||
    secondRotation === undefined ||
    angleDifference(firstRotation, secondRotation) !== 90
  ) {
    return false;
  }

  const firstEndpoint = trayEndpoint(first, firstEnd);

  if (!firstEndpoint) {
    return false;
  }

  return (["start", "end"] as const).some((secondEnd) => {
    const secondEndpoint = trayEndpoint(second, secondEnd);

    return (
      secondEndpoint &&
      distance(firstEndpoint, secondEndpoint) <= MITER_TOLERANCE_MM
    );
  });
}

export function calculateWireTrayMiterEnds(
  placement: DrawingPlacement,
  model: DrawingSheetCanvasModel
): WireTrayMiterEnds {
  if (!isWireTrayPlacement(placement)) {
    return {
      start: false,
      end: false
    };
  }

  const siblingTrays = model.placements.filter(isWireTrayPlacement);

  return {
    start: siblingTrays.some((candidate) =>
      traysMeetOrthogonally(placement, "start", candidate)
    ),
    end: siblingTrays.some((candidate) =>
      traysMeetOrthogonally(placement, "end", candidate)
    )
  };
}

function wireTrayBodyPoints(miterEnds: WireTrayMiterEnds): string {
  const width = WIRE_TRAY_VIEWBOX_WIDTH;
  const height = WIRE_TRAY_VIEWBOX_HEIGHT;
  const cut = height / 2;
  const points: Point[] = [];

  if (miterEnds.start) {
    points.push({ x: cut, y: 0 });
  } else {
    points.push({ x: 0, y: 0 });
  }

  if (miterEnds.end) {
    points.push({ x: width - cut, y: 0 });
    points.push({ x: width, y: cut });
    points.push({ x: width - cut, y: height });
  } else {
    points.push({ x: width, y: 0 });
    points.push({ x: width, y: height });
  }

  if (miterEnds.start) {
    points.push({ x: cut, y: height });
    points.push({ x: 0, y: cut });
  } else {
    points.push({ x: 0, y: height });
  }

  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function renderWireTraySvg({
  placement,
  model
}: {
  placement: DrawingPlacement;
  model: DrawingSheetCanvasModel;
}): string {
  const miterEnds = calculateWireTrayMiterEnds(placement, model);
  const fingerCount = 10;
  const fingerSpacing = WIRE_TRAY_VIEWBOX_WIDTH / fingerCount;
  const fingers = Array.from({ length: fingerCount - 1 }, (_, index) => {
    const x = fingerSpacing * (index + 1);

    return `
      <path d="M ${x} 3 V 7 M ${x} ${WIRE_TRAY_VIEWBOX_HEIGHT - 7} V ${WIRE_TRAY_VIEWBOX_HEIGHT - 3}" fill="none" stroke="#94a3b8" stroke-width="0.45" vector-effect="non-scaling-stroke"/>
    `;
  }).join("");

  return `
    <g data-generated-wire-tray="true">
      <polygon points="${wireTrayBodyPoints(miterEnds)}" fill="#ffffff" stroke="#334155" stroke-width="0.72" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>
      <path d="M 3 9 H ${WIRE_TRAY_VIEWBOX_WIDTH - 3} M 3 ${WIRE_TRAY_VIEWBOX_HEIGHT - 9} H ${WIRE_TRAY_VIEWBOX_WIDTH - 3}" fill="none" stroke="#64748b" stroke-width="0.52" vector-effect="non-scaling-stroke"/>
      <path d="M 3 13 H ${WIRE_TRAY_VIEWBOX_WIDTH - 3} M 3 ${WIRE_TRAY_VIEWBOX_HEIGHT - 13} H ${WIRE_TRAY_VIEWBOX_WIDTH - 3}" fill="none" stroke="#d1d9e6" stroke-width="0.32" vector-effect="non-scaling-stroke"/>
      ${fingers}
    </g>
  `;
}
