import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  assignPlacementToBackplane,
  getBackplaneUsableBounds
} from "./drawing-backplane-layouts";
import {
  getBackplanePhysicalBounds,
  resolveBackplaneLayoutScale,
  resolveLayoutHelperDisplayPlacement
} from "./drawing-backplane-scale";
import {
  dimensionAttachmentPointToSheet,
  dimensionSnapTargetSheetValue,
  resolveDimensionAttachmentReferencePoint,
  resolveLayoutDimensionAttachmentSnap,
  resolveLayoutDimensionSnap,
  type DimensionAttachmentTarget,
  type DimensionSnapTarget
} from "./drawing-dimension-snapping";

export const GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID =
  "__generated_horizontal_dimension__";
export const GENERATED_VERTICAL_DIMENSION_SYMBOL_ID =
  "__generated_vertical_dimension__";
export const GENERATED_HORIZONTAL_DIMENSION_VERSION_ID =
  "generated_horizontal_dimension_v1";
export const GENERATED_VERTICAL_DIMENSION_VERSION_ID =
  "generated_vertical_dimension_v1";
export const GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY =
  "generated_horizontal_dimension";
export const GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY =
  "generated_vertical_dimension";

const HORIZONTAL_DIMENSION_LABEL = "Horizontal Dimension";
const VERTICAL_DIMENSION_LABEL = "Vertical Dimension";
const DIMENSION_THICKNESS_MM = 8;

type LayoutDimensionOrientation = NonNullable<
  DrawingPlacement["layoutDimension"]
>["orientation"];

type LayoutDimension = NonNullable<DrawingPlacement["layoutDimension"]>;

export type LayoutDimensionPhysicalGeometry = {
  orientation: LayoutDimensionOrientation;
  startMm: number;
  endMm: number;
  offsetMm: number;
  startWitnessMm: number;
  endWitnessMm: number;
  labelPositionMm: number;
};

export type LayoutDimensionDisplayGeometry = {
  orientation: LayoutDimensionOrientation;
  dimensionStart: { x: number; y: number };
  dimensionEnd: { x: number; y: number };
  startWitness: { x: number; y: number };
  endWitness: { x: number; y: number };
  label: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hasOwn<T extends object>(input: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function defaultWitnessMm({
  backplane,
  orientation,
  offsetMm
}: {
  backplane: DrawingPlacement;
  orientation: LayoutDimensionOrientation;
  offsetMm: number;
}): number {
  const bounds = getBackplanePhysicalBounds(backplane);
  const perpendicularLength =
    orientation === "horizontal" ? bounds.height : bounds.width;

  return offsetMm <= perpendicularLength / 2 ? 0 : perpendicularLength;
}

function dimensionPointFromAxisAndWitness({
  orientation,
  axisMm,
  witnessMm
}: {
  orientation: LayoutDimensionOrientation;
  axisMm: number;
  witnessMm: number;
}): { x: number; y: number } {
  return orientation === "horizontal"
    ? { x: axisMm, y: witnessMm }
    : { x: witnessMm, y: axisMm };
}

function dimensionAxisValue(
  orientation: LayoutDimensionOrientation,
  point: { x: number; y: number }
): number {
  return orientation === "horizontal" ? point.x : point.y;
}

function dimensionWitnessValue(
  orientation: LayoutDimensionOrientation,
  point: { x: number; y: number }
): number {
  return orientation === "horizontal" ? point.y : point.x;
}

function createDimensionLibrarySymbol({
  orientation
}: {
  orientation: LayoutDimensionOrientation;
}): ApprovedDrawingSymbol {
  const isHorizontal = orientation === "horizontal";
  const displayName = isHorizontal
    ? HORIZONTAL_DIMENSION_LABEL
    : VERTICAL_DIMENSION_LABEL;

  return {
    symbolId: isHorizontal
      ? GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID
      : GENERATED_VERTICAL_DIMENSION_SYMBOL_ID,
    symbolKey: isHorizontal
      ? GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY
      : GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY,
    displayName,
    category: "other",
    versionId: isHorizontal
      ? GENERATED_HORIZONTAL_DIMENSION_VERSION_ID
      : GENERATED_VERTICAL_DIMENSION_VERSION_ID,
    versionNumber: 1,
    svg: `<svg viewBox="0 0 ${isHorizontal ? 100 : 8} ${
      isHorizontal ? 8 : 100
    }" xmlns="http://www.w3.org/2000/svg"><rect width="${
      isHorizontal ? 100 : 8
    }" height="${isHorizontal ? 8 : 100}" fill="none"/></svg>`,
    metadata: {
      symbolKey: isHorizontal
        ? GENERATED_HORIZONTAL_DIMENSION_SYMBOL_KEY
        : GENERATED_VERTICAL_DIMENSION_SYMBOL_KEY,
      displayName,
      category: "other",
      layoutUsage: "panel_layout",
      panelCategory: "label",
      mountingType: "backplate",
      resizable: false,
      physicalWidthMm: isHorizontal ? 100 : DIMENSION_THICKNESS_MM,
      physicalHeightMm: isHorizontal ? DIMENSION_THICKNESS_MM : 100,
      viewBox: {
        x: 0,
        y: 0,
        width: isHorizontal ? 100 : DIMENSION_THICKNESS_MM,
        height: isHorizontal ? DIMENSION_THICKNESS_MM : 100
      },
      anchors: [],
      terminals: []
    }
  };
}

export function createGeneratedDimensionLibrarySymbols(): ApprovedDrawingSymbol[] {
  return [
    createDimensionLibrarySymbol({ orientation: "horizontal" }),
    createDimensionLibrarySymbol({ orientation: "vertical" })
  ];
}

export function isGeneratedLayoutDimensionSymbolReference(input:
  | { symbolId: string; versionId: string }
  | undefined
): boolean {
  return Boolean(
    input &&
      ((input.symbolId === GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID &&
        input.versionId === GENERATED_HORIZONTAL_DIMENSION_VERSION_ID) ||
        (input.symbolId === GENERATED_VERTICAL_DIMENSION_SYMBOL_ID &&
          input.versionId === GENERATED_VERTICAL_DIMENSION_VERSION_ID))
  );
}

export function layoutDimensionOrientationFromSymbol(
  input: { symbolId: string; versionId: string } | undefined
): LayoutDimensionOrientation | undefined {
  if (
    input?.symbolId === GENERATED_HORIZONTAL_DIMENSION_SYMBOL_ID &&
    input.versionId === GENERATED_HORIZONTAL_DIMENSION_VERSION_ID
  ) {
    return "horizontal";
  }

  if (
    input?.symbolId === GENERATED_VERTICAL_DIMENSION_SYMBOL_ID &&
    input.versionId === GENERATED_VERTICAL_DIMENSION_VERSION_ID
  ) {
    return "vertical";
  }

  return undefined;
}

export function isLayoutDimensionPlacement(
  placement: DrawingPlacement | undefined
): placement is DrawingPlacement & {
  layoutKind: "layout_helper";
  layoutDimension: NonNullable<DrawingPlacement["layoutDimension"]>;
} {
  return Boolean(
    placement &&
      placement.layoutKind === "layout_helper" &&
      placement.layoutDimension &&
      isGeneratedLayoutDimensionSymbolReference(placement)
  );
}

export function remapLayoutDimensionAttachmentPlacementIds(
  placement: DrawingPlacement,
  resolvePlacementId: (placementId: string) => string | undefined
): DrawingPlacement {
  const dimension = placement.layoutDimension;

  if (!dimension) {
    return placement;
  }

  const remapAttachment = (
    attachment: LayoutDimension["startAttachment"]
  ): LayoutDimension["startAttachment"] => {
    if (
      !attachment ||
      attachment.targetKind !== "placement" ||
      !attachment.placementId
    ) {
      return attachment;
    }

    const placementId = resolvePlacementId(attachment.placementId);

    return placementId ? { ...attachment, placementId } : undefined;
  };

  return {
    ...placement,
    layoutDimension: {
      ...dimension,
      startAttachment: remapAttachment(dimension.startAttachment),
      endAttachment: remapAttachment(dimension.endAttachment)
    }
  };
}

export function clearLayoutDimensionAttachmentToPlacement(
  placement: DrawingPlacement,
  placementId: string
): DrawingPlacement {
  return remapLayoutDimensionAttachmentPlacementIds(
    placement,
    (candidateId) => (candidateId === placementId ? undefined : candidateId)
  );
}

export function resolveLayoutDimensionPhysicalGeometry({
  model,
  placement,
  backplane
}: {
  model: DrawingSheetCanvasModel;
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
}): LayoutDimensionPhysicalGeometry | undefined {
  const dimension = placement.layoutDimension;

  if (!dimension) {
    return undefined;
  }

  const fallbackWitness = defaultWitnessMm({
    backplane,
    orientation: dimension.orientation,
    offsetMm: dimension.offsetMm
  });
  const startAttachmentPoint = dimension.startAttachment
    ? resolveDimensionAttachmentReferencePoint({
        model,
        backplane,
        reference: dimension.startAttachment
      })
    : undefined;
  const endAttachmentPoint = dimension.endAttachment
    ? resolveDimensionAttachmentReferencePoint({
        model,
        backplane,
        reference: dimension.endAttachment
      })
    : undefined;
  const startMm = startAttachmentPoint
    ? dimensionAxisValue(dimension.orientation, startAttachmentPoint)
    : dimension.startMm;
  const endMm = endAttachmentPoint
    ? dimensionAxisValue(dimension.orientation, endAttachmentPoint)
    : dimension.endMm;
  const startWitnessMm = startAttachmentPoint
    ? dimensionWitnessValue(dimension.orientation, startAttachmentPoint)
    : dimension.startWitnessMm ?? fallbackWitness;
  const endWitnessMm = endAttachmentPoint
    ? dimensionWitnessValue(dimension.orientation, endAttachmentPoint)
    : dimension.endWitnessMm ?? fallbackWitness;
  const minimum = Math.min(startMm, endMm);
  const maximum = Math.max(startMm, endMm);

  return {
    orientation: dimension.orientation,
    startMm: round(startMm),
    endMm: round(endMm),
    offsetMm: round(dimension.offsetMm),
    startWitnessMm: round(startWitnessMm),
    endWitnessMm: round(endWitnessMm),
    labelPositionMm: round(
      clamp(
        dimension.labelPositionMm ?? (startMm + endMm) / 2,
        minimum,
        maximum
      )
    )
  };
}

export function getLayoutDimensionDisplayGeometry({
  model,
  placement,
  backplane
}: {
  model: DrawingSheetCanvasModel;
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
}): LayoutDimensionDisplayGeometry | undefined {
  const geometry = resolveLayoutDimensionPhysicalGeometry({
    model,
    placement,
    backplane
  });

  if (!geometry) {
    return undefined;
  }

  const startWitness = dimensionAttachmentPointToSheet({
    sheet: model.sheet,
    backplane,
    pointMm: dimensionPointFromAxisAndWitness({
      orientation: geometry.orientation,
      axisMm: geometry.startMm,
      witnessMm: geometry.startWitnessMm
    })
  });
  const endWitness = dimensionAttachmentPointToSheet({
    sheet: model.sheet,
    backplane,
    pointMm: dimensionPointFromAxisAndWitness({
      orientation: geometry.orientation,
      axisMm: geometry.endMm,
      witnessMm: geometry.endWitnessMm
    })
  });
  const dimensionStart = dimensionAttachmentPointToSheet({
    sheet: model.sheet,
    backplane,
    pointMm: dimensionPointFromAxisAndWitness({
      orientation: geometry.orientation,
      axisMm: geometry.startMm,
      witnessMm: geometry.offsetMm
    })
  });
  const dimensionEnd = dimensionAttachmentPointToSheet({
    sheet: model.sheet,
    backplane,
    pointMm: dimensionPointFromAxisAndWitness({
      orientation: geometry.orientation,
      axisMm: geometry.endMm,
      witnessMm: geometry.offsetMm
    })
  });
  const label = dimensionAttachmentPointToSheet({
    sheet: model.sheet,
    backplane,
    pointMm: dimensionPointFromAxisAndWitness({
      orientation: geometry.orientation,
      axisMm: geometry.labelPositionMm,
      witnessMm: geometry.offsetMm
    })
  });
  const points = [startWitness, endWitness, dimensionStart, dimensionEnd];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);

  return {
    orientation: geometry.orientation,
    dimensionStart,
    dimensionEnd,
    startWitness,
    endWitness,
    label,
    bounds: {
      x: round(minimumX),
      y: round(minimumY),
      width: round(Math.max(1, maximumX - minimumX)),
      height: round(Math.max(1, maximumY - minimumY))
    }
  };
}

export function layoutDimensionValueLabel(
  placement: DrawingPlacement,
  resolvedDimension: Pick<LayoutDimensionPhysicalGeometry, "startMm" | "endMm"> | undefined = undefined
): string {
  const dimension = placement.layoutDimension;

  if (!dimension) {
    return "";
  }

  const measured = Math.abs(
    (resolvedDimension?.endMm ?? dimension.endMm) -
      (resolvedDimension?.startMm ?? dimension.startMm)
  );
  const rounded = Number(measured.toFixed(measured >= 10 ? 0 : 1));

  return dimension.labelOverride?.trim() || `${rounded} mm`;
}

function placementGeometryFromDimension(
  dimension: NonNullable<DrawingPlacement["layoutDimension"]>
): {
  layoutPosition: NonNullable<DrawingPlacement["layoutPosition"]>;
  layoutDimensions: NonNullable<DrawingPlacement["layoutDimensions"]>;
} {
  const start = Math.min(dimension.startMm, dimension.endMm);
  const end = Math.max(dimension.startMm, dimension.endMm);
  const measured = Math.max(1, end - start);

  if (dimension.orientation === "horizontal") {
    return {
      layoutPosition: {
        xMm: round(start),
        yMm: round(dimension.offsetMm)
      },
      layoutDimensions: {
        lengthMm: round(measured),
        widthMm: DIMENSION_THICKNESS_MM
      }
    };
  }

  return {
    layoutPosition: {
      xMm: round(dimension.offsetMm),
      yMm: round(start)
    },
    layoutDimensions: {
      lengthMm: DIMENSION_THICKNESS_MM,
      widthMm: round(measured)
    }
  };
}

export function resolveAssociatedLayoutDimensionPlacement({
  model,
  placement,
  backplane
}: {
  model: DrawingSheetCanvasModel;
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
}): DrawingPlacement {
  const resolved = resolveLayoutDimensionPhysicalGeometry({
    model,
    placement,
    backplane
  });

  if (!resolved || !placement.layoutDimension) {
    return placement;
  }

  const layoutDimension: LayoutDimension = {
    ...placement.layoutDimension,
    startMm: resolved.startMm,
    endMm: resolved.endMm,
    offsetMm: resolved.offsetMm,
    startWitnessMm: resolved.startWitnessMm,
    endWitnessMm: resolved.endWitnessMm,
    labelPositionMm: resolved.labelPositionMm
  };

  return {
    ...placement,
    layoutDimension,
    ...placementGeometryFromDimension(layoutDimension)
  };
}

export function createLayoutDimensionPlacement({
  backplane,
  sheet,
  orientation,
  id = `dim_${Date.now()}`
}: {
  backplane: DrawingPlacement;
  sheet: DrawingSheetCanvasModel["sheet"];
  orientation: LayoutDimensionOrientation;
  id?: string;
}): DrawingPlacement {
  const usable = getBackplaneUsableBounds(backplane);
  const startMm = orientation === "horizontal" ? usable.x : usable.y;
  const endMm =
    orientation === "horizontal"
      ? usable.x + usable.width
      : usable.y + usable.height;
  const offsetMm =
    orientation === "horizontal" ? usable.y + 5 : usable.x + 5;
  const witnessMm = orientation === "horizontal" ? usable.y : usable.x;
  const symbol = createDimensionLibrarySymbol({ orientation });
  const layoutDimension = {
    orientation,
    startMm: round(startMm),
    endMm: round(endMm),
    offsetMm: round(offsetMm),
    startWitnessMm: round(witnessMm),
    endWitnessMm: round(witnessMm),
    labelPositionMm: round((startMm + endMm) / 2),
    showValue: true
  };
  const geometry = placementGeometryFromDimension(layoutDimension);
  const physicalPlacement = {
    ...assignPlacementToBackplane(
      {
        id,
        symbolId: symbol.symbolId,
        versionId: symbol.versionId,
        role: "other" as const,
        tag: symbol.displayName,
        title: symbol.displayName,
        x: backplane.x,
        y: backplane.y,
        rotation: 0,
        scale: 1,
        layoutKind: "layout_helper" as const,
        layoutDimension,
        ...geometry
      },
      backplane
    )
  };
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

export function updateLayoutDimensionPlacement({
  placement,
  backplane,
  sheet,
  updates
}: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  sheet: DrawingSheetCanvasModel["sheet"];
  updates: Partial<NonNullable<DrawingPlacement["layoutDimension"]>>;
}): DrawingPlacement {
  const current = placement.layoutDimension;

  if (!current) {
    return placement;
  }

  const layoutDimension: LayoutDimension = {
    ...current,
    ...updates,
    startAttachment:
      hasOwn(updates, "startAttachment")
        ? updates.startAttachment
        : hasOwn(updates, "startMm") || hasOwn(updates, "startWitnessMm")
          ? undefined
          : current.startAttachment,
    endAttachment:
      hasOwn(updates, "endAttachment")
        ? updates.endAttachment
        : hasOwn(updates, "endMm") || hasOwn(updates, "endWitnessMm")
          ? undefined
          : current.endAttachment
  };
  const geometry = placementGeometryFromDimension(layoutDimension);
  const physicalPlacement = {
    ...placement,
    layoutDimension,
    ...geometry
  };
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

export type LayoutDimensionPointerUpdate = {
  placement: DrawingPlacement;
  snapTarget?: DimensionSnapTarget;
  guideSheetValue?: number;
  snapAttachmentTarget?: DimensionAttachmentTarget;
  guideSheetPoint?: { x: number; y: number };
};

export function resolveLayoutDimensionPointerUpdate({
  placement,
  backplane,
  sheet,
  handle,
  pointer,
  snapTargets = [],
  attachmentTargets = [],
  snapToleranceMm = 0,
  model
}: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  sheet: DrawingSheetCanvasModel["sheet"];
  handle:
    | "dimension-start"
    | "dimension-end"
    | "dimension-offset"
    | "dimension-label";
  pointer: { x: number; y: number };
  snapTargets?: DimensionSnapTarget[];
  attachmentTargets?: DimensionAttachmentTarget[];
  snapToleranceMm?: number;
  model?: DrawingSheetCanvasModel;
}): LayoutDimensionPointerUpdate {
  const resolvedPlacement = model
    ? resolveAssociatedLayoutDimensionPlacement({ model, placement, backplane })
    : placement;
  const dimension = resolvedPlacement.layoutDimension;

  if (!dimension) {
    return { placement };
  }

  const scale = resolveBackplaneLayoutScale(sheet, backplane).factor;
  const pointerXmm = (pointer.x - backplane.x) / scale;
  const pointerYmm = (pointer.y - backplane.y) / scale;
  const axisValue =
    dimension.orientation === "horizontal" ? pointerXmm : pointerYmm;
  const offsetValue =
    dimension.orientation === "horizontal" ? pointerYmm : pointerXmm;

  if (handle === "dimension-offset") {
    return {
      placement: updateLayoutDimensionPlacement({
        placement: resolvedPlacement,
        backplane,
        sheet,
        updates: {
          offsetMm: Math.round(offsetValue)
        }
      })
    };
  }

  if (handle === "dimension-label") {
    return {
      placement: updateLayoutDimensionPlacement({
        placement: resolvedPlacement,
        backplane,
        sheet,
        updates: {
          labelPositionMm: round(
            clamp(
              axisValue,
              Math.min(dimension.startMm, dimension.endMm),
              Math.max(dimension.startMm, dimension.endMm)
            )
          )
        }
      })
    };
  }

  const axis = dimension.orientation === "horizontal" ? "x" : "y";
  const axisLimit =
    dimension.orientation === "horizontal"
      ? getBackplanePhysicalBounds(backplane).width
      : getBackplanePhysicalBounds(backplane).height;
  const physicalBounds = getBackplanePhysicalBounds(backplane);
  const pointerPointMm = {
    x: clamp(pointerXmm, physicalBounds.x, physicalBounds.x + physicalBounds.width),
    y: clamp(pointerYmm, physicalBounds.y, physicalBounds.y + physicalBounds.height)
  };
  const attachmentSnap = attachmentTargets.length
    ? resolveLayoutDimensionAttachmentSnap({
        pointMm: pointerPointMm,
        targets: attachmentTargets,
        toleranceMm: snapToleranceMm
      })
    : undefined;
  const axisSnap = attachmentSnap
    ? undefined
    : resolveLayoutDimensionSnap({
        axis,
        valueMm: axisValue,
        targets: snapTargets,
        toleranceMm: snapToleranceMm
      });
  const isStartHandle = handle === "dimension-start";
  const minimumSpanMm = 1;
  const minimumValue = isStartHandle
    ? 0
    : Math.min(axisLimit, dimension.startMm + minimumSpanMm);
  const maximumValue = isStartHandle
    ? Math.max(0, Math.min(axisLimit, dimension.endMm - minimumSpanMm))
    : axisLimit;
  const requestedPoint = attachmentSnap?.pointMm ?? pointerPointMm;
  const requestedAxisValue = attachmentSnap
    ? dimensionAxisValue(dimension.orientation, requestedPoint)
    : axisSnap?.valueMm ?? axisValue;
  const resolvedValue = round(
    clamp(requestedAxisValue, minimumValue, maximumValue)
  );
  const resolvedWitness = round(
    dimensionWitnessValue(dimension.orientation, requestedPoint)
  );
  const snapTarget =
    axisSnap?.target && resolvedValue === axisSnap.target.valueMm
      ? axisSnap.target
      : undefined;
  const snapAttachmentTarget =
    attachmentSnap?.target &&
    resolvedValue ===
      dimensionAxisValue(dimension.orientation, attachmentSnap.pointMm)
      ? attachmentSnap.target
      : undefined;
  const attachment = snapAttachmentTarget
    ? attachmentSnap?.reference
    : undefined;
  const attachmentPoint = snapAttachmentTarget
    ? attachmentSnap?.pointMm
    : undefined;

  return {
    placement: updateLayoutDimensionPlacement({
      placement: resolvedPlacement,
      backplane,
      sheet,
      updates: {
        [isStartHandle ? "startMm" : "endMm"]: resolvedValue,
        [isStartHandle ? "startWitnessMm" : "endWitnessMm"]:
          resolvedWitness,
        [isStartHandle ? "startAttachment" : "endAttachment"]: attachment
      }
    }),
    snapTarget,
    guideSheetValue: snapTarget
      ? dimensionSnapTargetSheetValue({ sheet, backplane, target: snapTarget })
      : undefined,
    snapAttachmentTarget,
    guideSheetPoint: attachmentPoint
      ? dimensionAttachmentPointToSheet({
          sheet,
          backplane,
          pointMm: attachmentPoint
        })
      : undefined
  };
}

export function updateLayoutDimensionFromDisplayPointer(input: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  sheet: DrawingSheetCanvasModel["sheet"];
  handle:
    | "dimension-start"
    | "dimension-end"
    | "dimension-offset"
    | "dimension-label";
  pointer: { x: number; y: number };
}): DrawingPlacement {
  return resolveLayoutDimensionPointerUpdate(input).placement;
}

export function moveLayoutDimensionByDisplayDelta({
  placement,
  backplane,
  sheet,
  delta,
  model
}: {
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  sheet: DrawingSheetCanvasModel["sheet"];
  delta: { x: number; y: number };
  model?: DrawingSheetCanvasModel;
}): DrawingPlacement {
  const resolvedPlacement = model
    ? resolveAssociatedLayoutDimensionPlacement({ model, placement, backplane })
    : placement;
  const dimension = resolvedPlacement.layoutDimension;

  if (!dimension) {
    return placement;
  }

  const factor = resolveBackplaneLayoutScale(sheet, backplane).factor;
  const axisLimit =
    dimension.orientation === "horizontal"
      ? getBackplanePhysicalBounds(backplane).width
      : getBackplanePhysicalBounds(backplane).height;
  const requestedAxisDelta =
    (dimension.orientation === "horizontal" ? delta.x : delta.y) / factor;
  const requestedOffsetDelta =
    (dimension.orientation === "horizontal" ? delta.y : delta.x) / factor;
  const minimumEndpoint = Math.min(dimension.startMm, dimension.endMm);
  const maximumEndpoint = Math.max(dimension.startMm, dimension.endMm);
  const axisDelta = clamp(
    requestedAxisDelta,
    -minimumEndpoint,
    axisLimit - maximumEndpoint
  );

  return updateLayoutDimensionPlacement({
    placement: resolvedPlacement,
    backplane,
    sheet,
    updates: {
      startMm: round(dimension.startMm + axisDelta),
      endMm: round(dimension.endMm + axisDelta),
      offsetMm: round(dimension.offsetMm + requestedOffsetDelta),
      startWitnessMm: round(
        (dimension.startWitnessMm ?? dimension.offsetMm) +
          requestedOffsetDelta
      ),
      endWitnessMm: round(
        (dimension.endWitnessMm ?? dimension.offsetMm) + requestedOffsetDelta
      ),
      labelPositionMm: dimension.labelPositionMm !== undefined
        ? round(dimension.labelPositionMm + axisDelta)
        : undefined,
      startAttachment: undefined,
      endAttachment: undefined
    }
  });
}

export function renderLayoutDimensionSvg({
  model,
  sourcePlacement,
  backplane
}: {
  model: DrawingSheetCanvasModel;
  sourcePlacement: DrawingPlacement;
  backplane: DrawingPlacement;
}): string {
  const dimension = sourcePlacement.layoutDimension;
  const physicalGeometry = resolveLayoutDimensionPhysicalGeometry({
    model,
    placement: sourcePlacement,
    backplane
  });
  const geometry = getLayoutDimensionDisplayGeometry({
    model,
    placement: sourcePlacement,
    backplane
  });

  if (!dimension || !physicalGeometry || !geometry) {
    return "";
  }

  const showValue = dimension.showValue ?? true;
  const label = escapeXml(
    layoutDimensionValueLabel(sourcePlacement, physicalGeometry)
  );
  const stroke = "#0f5f86";
  const text = "#164e63";
  const witnessGap = 1.1;
  const witnessOverrun = 1.4;
  const arrowLength = 2.6;
  const arrowHalfWidth = 1.05;
  const fontSize = 2;

  if (dimension.orientation === "vertical") {
    const x = geometry.dimensionStart.x;
    const y1 = Math.min(geometry.dimensionStart.y, geometry.dimensionEnd.y);
    const y2 = Math.max(geometry.dimensionStart.y, geometry.dimensionEnd.y);
    const labelY = geometry.label.y;
    const span = Math.max(0, y2 - y1);
    const labelGap = Math.min(
      span * 0.7,
      Math.max(8, label.length * 1.25 + 4)
    );
    const splitLine = showValue && span > labelGap + 4;
    const linePath = splitLine
      ? `M ${x} ${y1} V ${round(labelY - labelGap / 2)} M ${x} ${round(labelY + labelGap / 2)} V ${y2}`
      : `M ${x} ${y1} V ${y2}`;
    const startDirection = Math.sign(
      geometry.dimensionStart.x - geometry.startWitness.x
    ) || 1;
    const endDirection = Math.sign(
      geometry.dimensionEnd.x - geometry.endWitness.x
    ) || 1;
    const extensionPath = [
      `M ${round(geometry.startWitness.x + startDirection * witnessGap)} ${geometry.startWitness.y}`,
      `H ${round(geometry.dimensionStart.x + startDirection * witnessOverrun)}`,
      `M ${round(geometry.endWitness.x + endDirection * witnessGap)} ${geometry.endWitness.y}`,
      `H ${round(geometry.dimensionEnd.x + endDirection * witnessOverrun)}`
    ].join(" ");
    const arrowPath = [
      `M ${x} ${y1} L ${round(x - arrowHalfWidth)} ${round(y1 + arrowLength)} L ${round(x + arrowHalfWidth)} ${round(y1 + arrowLength)} Z`,
      `M ${x} ${y2} L ${round(x - arrowHalfWidth)} ${round(y2 - arrowLength)} L ${round(x + arrowHalfWidth)} ${round(y2 - arrowLength)} Z`
    ].join(" ");

    return `
      <g data-generated-dimension="vertical" pointer-events="none">
        <path data-dimension-part="dimension-line" d="${linePath}" fill="none" stroke="${stroke}" stroke-width="0.32" vector-effect="non-scaling-stroke"/>
        <path data-dimension-part="extension-lines" d="${extensionPath}" fill="none" stroke="${stroke}" stroke-width="0.26" vector-effect="non-scaling-stroke"/>
        <path data-dimension-part="arrows" d="${arrowPath}" fill="${stroke}" stroke="none"/>
        ${
          showValue
            ? `<text data-dimension-part="label" x="${round(x - 1.6)}" y="${labelY}" transform="rotate(-90 ${round(x - 1.6)} ${labelY})" text-anchor="middle" font-family="Inter, Poppins, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="0" fill="${text}">${label}</text>`
            : ""
        }
      </g>
    `;
  }

  const y = geometry.dimensionStart.y;
  const x1 = Math.min(geometry.dimensionStart.x, geometry.dimensionEnd.x);
  const x2 = Math.max(geometry.dimensionStart.x, geometry.dimensionEnd.x);
  const labelX = geometry.label.x;
  const span = Math.max(0, x2 - x1);
  const labelGap = Math.min(
    span * 0.7,
    Math.max(8, label.length * 1.25 + 4)
  );
  const splitLine = showValue && span > labelGap + 4;
  const linePath = splitLine
    ? `M ${x1} ${y} H ${round(labelX - labelGap / 2)} M ${round(labelX + labelGap / 2)} ${y} H ${x2}`
    : `M ${x1} ${y} H ${x2}`;
  const startDirection = Math.sign(
    geometry.dimensionStart.y - geometry.startWitness.y
  ) || 1;
  const endDirection = Math.sign(
    geometry.dimensionEnd.y - geometry.endWitness.y
  ) || 1;
  const extensionPath = [
    `M ${geometry.startWitness.x} ${round(geometry.startWitness.y + startDirection * witnessGap)}`,
    `V ${round(geometry.dimensionStart.y + startDirection * witnessOverrun)}`,
    `M ${geometry.endWitness.x} ${round(geometry.endWitness.y + endDirection * witnessGap)}`,
    `V ${round(geometry.dimensionEnd.y + endDirection * witnessOverrun)}`
  ].join(" ");
  const arrowPath = [
    `M ${x1} ${y} L ${round(x1 + arrowLength)} ${round(y - arrowHalfWidth)} L ${round(x1 + arrowLength)} ${round(y + arrowHalfWidth)} Z`,
    `M ${x2} ${y} L ${round(x2 - arrowLength)} ${round(y - arrowHalfWidth)} L ${round(x2 - arrowLength)} ${round(y + arrowHalfWidth)} Z`
  ].join(" ");

  return `
    <g data-generated-dimension="horizontal" pointer-events="none">
      <path data-dimension-part="dimension-line" d="${linePath}" fill="none" stroke="${stroke}" stroke-width="0.32" vector-effect="non-scaling-stroke"/>
      <path data-dimension-part="extension-lines" d="${extensionPath}" fill="none" stroke="${stroke}" stroke-width="0.26" vector-effect="non-scaling-stroke"/>
      <path data-dimension-part="arrows" d="${arrowPath}" fill="${stroke}" stroke="none"/>
      ${
        showValue
          ? `<text data-dimension-part="label" x="${labelX}" y="${round(y - 1.45)}" text-anchor="middle" font-family="Inter, Poppins, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="0" fill="${text}">${label}</text>`
          : ""
      }
    </g>
  `;
}
