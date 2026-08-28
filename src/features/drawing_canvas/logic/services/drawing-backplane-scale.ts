import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import {
  getPanelEnclosureDisplayBounds,
  isGeneratedPanelEnclosurePlacement,
  isLegacyPanelEnclosureLayout,
  resolvePanelEnclosureLayoutScale
} from "./drawing-asset-containment";
import { placementAssetId } from "./drawing-asset-identity";
import {
  getPhysicalLayoutPrintableArea,
  resolvePhysicalLayoutScale
} from "./drawing-physical-layout-scale";

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

export type PanelPhysicalContentRequirements = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  fits: boolean;
};

const BACKPLANE_USABLE_MARGIN = 3;

function round(value: number): number {
  return Number(value.toFixed(2));
}

function positiveDimension(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
}

export function getBackplanePrintableArea(
  sheet: DrawingSheetCanvasModel["sheet"]
): BackplaneBounds {
  return getPhysicalLayoutPrintableArea(sheet);
}

export function getParentPanelForBackplane(
  placements: DrawingPlacement[],
  backplane: DrawingPlacement
): DrawingPlacement | undefined {
  if (!backplane.containerAssetId) {
    return undefined;
  }

  return placements.find(
    (placement) =>
      isGeneratedPanelEnclosurePlacement(placement) &&
      placementAssetId(placement) === backplane.containerAssetId
  );
}

export function resolveBackplaneLayoutScale(
  sheet: DrawingSheetCanvasModel["sheet"],
  backplane: DrawingPlacement,
  parentPanel?: DrawingPlacement
): ResolvedBackplaneScale {
  if (
    parentPanel &&
    isGeneratedPanelEnclosurePlacement(parentPanel) &&
    !isLegacyPanelEnclosureLayout(parentPanel)
  ) {
    const inherited = resolvePanelEnclosureLayoutScale(sheet, parentPanel);

    return {
      mode: inherited.mode,
      denominator: inherited.denominator,
      factor: inherited.factor,
      label: inherited.label
    };
  }

  const physicalWidth = positiveDimension(backplane.layoutDimensions?.lengthMm, 1);
  const physicalHeight = positiveDimension(backplane.layoutDimensions?.widthMm, 1);
  const resolved = resolvePhysicalLayoutScale({
    sheet,
    physicalWidth,
    physicalHeight,
    layoutScale: backplane.layoutScale
  });

  return {
    mode: resolved.mode,
    denominator: resolved.denominator,
    factor: resolved.factor,
    label: resolved.label
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

export function getBackplaneLayoutPosition({
  backplane,
  parentPanel
}: {
  backplane: DrawingPlacement;
  parentPanel?: DrawingPlacement;
}): NonNullable<DrawingPlacement["layoutPosition"]> {
  if (backplane.layoutPosition) {
    return backplane.layoutPosition;
  }

  return {
    xMm: round(backplane.x - (parentPanel?.x ?? 0)),
    yMm: round(backplane.y - (parentPanel?.y ?? 0))
  };
}

export function getPanelPhysicalContentRequirements({
  panel,
  placements
}: {
  panel: DrawingPlacement;
  placements: DrawingPlacement[];
}): PanelPhysicalContentRequirements {
  const panelAssetId = placementAssetId(panel);
  const backplanes = placements.filter(
    (placement) =>
      placement.containerAssetId === panelAssetId &&
      placement.layoutKind === "backplane" &&
      placement.layoutDimensions
  );
  const extents = backplanes.map((backplane) => {
    const position = getBackplaneLayoutPosition({ backplane, parentPanel: panel });

    return {
      left: position.xMm,
      top: position.yMm,
      right: position.xMm + positiveDimension(
        backplane.layoutDimensions?.lengthMm,
        1
      ),
      bottom: position.yMm + positiveDimension(
        backplane.layoutDimensions?.widthMm,
        1
      )
    };
  });
  const minX = round(Math.min(0, ...extents.map((extent) => extent.left)));
  const minY = round(Math.min(0, ...extents.map((extent) => extent.top)));
  const width = round(Math.max(0, ...extents.map((extent) => extent.right)));
  const height = round(Math.max(0, ...extents.map((extent) => extent.bottom)));
  const panelWidth = positiveDimension(panel.enclosure?.width, 1);
  const panelHeight = positiveDimension(panel.enclosure?.height, 1);

  return {
    minX,
    minY,
    width,
    height,
    fits:
      minX >= 0 &&
      minY >= 0 &&
      width <= panelWidth &&
      height <= panelHeight
  };
}

export function getBackplaneDisplayOrigin({
  sheet,
  backplane,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  parentPanel?: DrawingPlacement;
}): Pick<BackplaneBounds, "x" | "y"> {
  if (
    !parentPanel ||
    !isGeneratedPanelEnclosurePlacement(parentPanel) ||
    isLegacyPanelEnclosureLayout(parentPanel)
  ) {
    return { x: backplane.x, y: backplane.y };
  }

  const panelBounds = getPanelEnclosureDisplayBounds(sheet, parentPanel);
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
  const layoutPosition = getBackplaneLayoutPosition({ backplane, parentPanel });

  return {
    x: round(panelBounds.x + layoutPosition.xMm * scale.factor),
    y: round(panelBounds.y + layoutPosition.yMm * scale.factor)
  };
}

export function physicalRectToSheetRect({
  sheet,
  backplane,
  rect,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  rect: BackplaneBounds;
  parentPanel?: DrawingPlacement;
}): BackplaneBounds {
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
  const origin = getBackplaneDisplayOrigin({ sheet, backplane, parentPanel });

  return {
    x: round(origin.x + rect.x * scale.factor),
    y: round(origin.y + rect.y * scale.factor),
    width: round(rect.width * scale.factor),
    height: round(rect.height * scale.factor)
  };
}

export function getBackplaneDisplayBounds(
  sheet: DrawingSheetCanvasModel["sheet"],
  backplane: DrawingPlacement,
  parentPanel?: DrawingPlacement
): BackplaneBounds {
  return physicalRectToSheetRect({
    sheet,
    backplane,
    rect: getBackplanePhysicalBounds(backplane),
    parentPanel
  });
}

export function getBackplaneCenteredPosition({
  sheet,
  backplane,
  area,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  backplane: DrawingPlacement;
  area: BackplaneBounds;
  parentPanel?: DrawingPlacement;
}): Pick<BackplaneBounds, "x" | "y"> {
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
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
  backplane: DrawingPlacement,
  parentPanel?: DrawingPlacement
): BackplaneBounds {
  return physicalRectToSheetRect({
    sheet,
    backplane,
    rect: getBackplanePhysicalUsableBounds(backplane),
    parentPanel
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
  backplane,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  parentPanel?: DrawingPlacement;
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
  const layoutPosition = getLayoutPosition(
    sheet,
    placement,
    backplane
  );
  const origin = getBackplaneDisplayOrigin({ sheet, backplane, parentPanel });
  const physicalLength = positiveDimension(placement.layoutDimensions?.lengthMm, 1);
  const physicalWidth = positiveDimension(placement.layoutDimensions?.widthMm, 1);
  const x = round(origin.x + layoutPosition.xMm * scale.factor);
  const y = round(origin.y + layoutPosition.yMm * scale.factor);
  const delta = { x: x - placement.x, y: y - placement.y };

  return {
    ...placement,
    x,
    y,
    layoutDimensions: {
      lengthMm: round(physicalLength * scale.factor),
      widthMm: round(physicalWidth * scale.factor)
    },
    labelPosition: placement.labelPosition
      ? {
          x: round(placement.labelPosition.x + delta.x),
          y: round(placement.labelPosition.y + delta.y)
        }
      : placement.labelPosition,
    deviceTitlePosition: placement.deviceTitlePosition
      ? {
          x: round(placement.deviceTitlePosition.x + delta.x),
          y: round(placement.deviceTitlePosition.y + delta.y)
        }
      : placement.deviceTitlePosition
  };
}

export function resizeLayoutHelperFromDisplayBounds({
  sheet,
  placement,
  backplane,
  bounds,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  bounds: BackplaneBounds;
  parentPanel?: DrawingPlacement;
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
  const origin = getBackplaneDisplayOrigin({ sheet, backplane, parentPanel });

  return {
    ...placement,
    x: round(bounds.x),
    y: round(bounds.y),
    layoutPosition: {
      xMm: round((bounds.x - origin.x) / scale.factor),
      yMm: round((bounds.y - origin.y) / scale.factor)
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
  delta,
  parentPanel
}: {
  sheet: DrawingSheetCanvasModel["sheet"];
  placement: DrawingPlacement;
  backplane: DrawingPlacement;
  delta: { x: number; y: number };
  parentPanel?: DrawingPlacement;
}): DrawingPlacement {
  const scale = resolveBackplaneLayoutScale(sheet, backplane, parentPanel);
  const layoutPosition = getLayoutPosition(
    sheet,
    placement,
    backplane
  );

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
      : placement.labelPosition,
    deviceTitlePosition: placement.deviceTitlePosition
      ? {
          x: round(placement.deviceTitlePosition.x + delta.x),
          y: round(placement.deviceTitlePosition.y + delta.y)
        }
      : placement.deviceTitlePosition
  };
}

export function resolveDrawingBackplaneScaleLabel(
  model: DrawingSheetCanvasModel
): string {
  const panelPlacements = model.placements.filter(
    isGeneratedPanelEnclosurePlacement
  );
  const scaleLabels = new Set(
    panelPlacements.map(
      (placement) =>
        resolvePanelEnclosureLayoutScale(model.sheet, placement).label
    )
  );

  model.placements
    .filter(
      (placement) =>
        placement.layoutKind === "backplane" && placement.layoutDimensions
    )
    .forEach((placement) => {
      const parentPanel = getParentPanelForBackplane(
        model.placements,
        placement
      );

      if (!parentPanel) {
        scaleLabels.add(
          resolveBackplaneLayoutScale(model.sheet, placement).label
        );
      }
    });

  if (scaleLabels.size === 0) {
    return "NTS";
  }

  if (scaleLabels.size === 1) {
    return [...scaleLabels][0];
  }

  return "AS NOTED";
}
