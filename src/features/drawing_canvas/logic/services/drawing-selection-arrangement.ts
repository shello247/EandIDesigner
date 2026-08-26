import type {
  DrawingPlacement,
  DrawingSheetCanvasModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  isGeneratedPanelEnclosurePlacement
} from "./drawing-asset-containment";
import {
  isBackplanePlacement,
  isLayoutHelperPlacement
} from "./drawing-backplane-layouts";
import {
  getBackplaneDisplayUsableBounds,
  getParentPanelForBackplane,
  moveLayoutHelperByDisplayDelta,
  resolveLayoutHelperDisplayPlacement
} from "./drawing-backplane-scale";
import { getSymbolForPlacement } from "./drawing-connections";
import { getRotatedPlacementBounds } from "./drawing-geometry";
import { isLayoutDimensionPlacement } from "./drawing-layout-dimensions";
import { isDinRailSymbol } from "./drawing-layout-labels";
import {
  isGeneratedPanelPatternLegendPlacement,
  isGeneratedPanelReferencePlacement
} from "./drawing-panel-reference-symbols";
import { isWireTrayPlacement } from "./drawing-wire-tray-layouts";
import {
  moveConnectionRouteWithinSheet,
  movePlacementWithAttachedLabel
} from "./drawing-movement";

export type PlacementArrangementAction =
  | "align_left"
  | "align_center"
  | "align_right"
  | "align_top"
  | "align_middle"
  | "align_bottom"
  | "distribute_horizontal"
  | "distribute_vertical";

export type PlacementArrangementDelta = {
  placementId: string;
  x: number;
  y: number;
};

export type PlacementArrangementFailureReason =
  | "insufficient_selection"
  | "unsupported_selection"
  | "mixed_coordinate_context"
  | "insufficient_distribution_span"
  | "containment_violation"
  | "unresolved_geometry";

export type PlacementArrangementResult =
  | {
      ok: true;
      deltas: PlacementArrangementDelta[];
    }
  | {
      ok: false;
      reason: PlacementArrangementFailureReason;
      message: string;
    };

type ArrangementItem = {
  placement: DrawingPlacement;
  symbol: ApprovedDrawingSymbol;
  displayPlacement: DrawingPlacement;
  bounds: ReturnType<typeof getRotatedPlacementBounds>;
  documentIndex: number;
  parentBackplane?: DrawingPlacement;
};

const ARRANGEMENT_ACTION_MESSAGES: Record<
  PlacementArrangementAction,
  (count: number) => string
> = {
  align_left: (count) => `Aligned ${count} symbols left.`,
  align_center: (count) =>
    `Aligned ${count} symbols to horizontal center.`,
  align_right: (count) => `Aligned ${count} symbols right.`,
  align_top: (count) => `Aligned ${count} symbols to top.`,
  align_middle: (count) =>
    `Aligned ${count} symbols to vertical middle.`,
  align_bottom: (count) => `Aligned ${count} symbols to bottom.`,
  distribute_horizontal: (count) =>
    `Distributed ${count} symbols horizontally.`,
  distribute_vertical: (count) =>
    `Distributed ${count} symbols vertically.`
};

const BOUNDS_EPSILON = 0.02;
const UNSUPPORTED_TECHNICAL_KINDS: ReadonlySet<string> = new Set([
  "cable_assembly",
  "ducting",
  "rail",
  "label"
]);

function round(value: number): number {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function failure(
  reason: PlacementArrangementFailureReason,
  message: string
): PlacementArrangementResult {
  return { ok: false, reason, message };
}

function isSupportedEquipmentPlacement(
  placement: DrawingPlacement,
  symbol: ApprovedDrawingSymbol | undefined
): symbol is ApprovedDrawingSymbol {
  if (!symbol || !placement.assetId) {
    return false;
  }

  if (!["device", "terminal_block"].includes(placement.role)) {
    return false;
  }

  if (
    isGeneratedPanelEnclosurePlacement(placement) ||
    isBackplanePlacement(placement) ||
    isLayoutDimensionPlacement(placement) ||
    isWireTrayPlacement(placement) ||
    isGeneratedPanelReferencePlacement(placement) ||
    isGeneratedPanelPatternLegendPlacement(placement) ||
    isDinRailSymbol(symbol)
  ) {
    return false;
  }

  const technicalKind = symbol.technicalKind ?? symbol.category;
  return !UNSUPPORTED_TECHNICAL_KINDS.has(technicalKind);
}

function resolveArrangementItems({
  model,
  symbols,
  placementIds
}: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  placementIds: string[];
}):
  | { ok: true; items: ArrangementItem[] }
  | { ok: false; result: PlacementArrangementResult } {
  const selectedIds = new Set(placementIds);
  const selected = model.placements.filter((placement) =>
    selectedIds.has(placement.id)
  );

  if (selected.length !== selectedIds.size) {
    return {
      ok: false,
      result: failure(
        "unresolved_geometry",
        "One or more selected symbols could not be resolved."
      )
    };
  }

  const unsupportedLabels = selected.flatMap((placement) => {
    const symbol = getSymbolForPlacement(placement, symbols);
    return isSupportedEquipmentPlacement(placement, symbol)
      ? []
      : [placement.tag || placement.id];
  });

  if (unsupportedLabels.length > 0) {
    return {
      ok: false,
      result: failure(
        "unsupported_selection",
        `Deselect unsupported items before arranging: ${unsupportedLabels.join(", ")}.`
      )
    };
  }

  const coordinateContexts = new Set(
    selected.map((placement) => placement.layoutParentId ?? "__sheet__")
  );

  if (coordinateContexts.size > 1) {
    return {
      ok: false,
      result: failure(
        "mixed_coordinate_context",
        "Select equipment from one backplane or one drawing coordinate space."
      )
    };
  }

  const items: ArrangementItem[] = [];

  for (const placement of selected) {
    const symbol = getSymbolForPlacement(placement, symbols);

    if (!isSupportedEquipmentPlacement(placement, symbol)) {
      return {
        ok: false,
        result: failure("unsupported_selection", "The selection is unsupported.")
      };
    }

    let parentBackplane: DrawingPlacement | undefined;
    let displayPlacement = placement;

    if (placement.layoutParentId) {
      parentBackplane = model.placements.find(
        (candidate) =>
          candidate.id === placement.layoutParentId &&
          isBackplanePlacement(candidate)
      );

      if (!parentBackplane || !isLayoutHelperPlacement(placement)) {
        return {
          ok: false,
          result: failure(
            "unresolved_geometry",
            "The selected equipment has incomplete backplane placement geometry."
          )
        };
      }

      displayPlacement = resolveLayoutHelperDisplayPlacement({
        sheet: model.sheet,
        placement,
        backplane: parentBackplane,
        parentPanel: getParentPanelForBackplane(
          model.placements,
          parentBackplane
        )
      });
    }

    items.push({
      placement,
      symbol,
      displayPlacement,
      bounds: getRotatedPlacementBounds(displayPlacement, symbol.metadata),
      documentIndex: model.placements.indexOf(placement),
      parentBackplane
    });
  }

  return { ok: true, items };
}

function alignmentDeltas(
  items: ArrangementItem[],
  action: Exclude<
    PlacementArrangementAction,
    "distribute_horizontal" | "distribute_vertical"
  >
): PlacementArrangementDelta[] {
  const left = Math.min(...items.map((item) => item.bounds.x));
  const top = Math.min(...items.map((item) => item.bounds.y));
  const right = Math.max(...items.map((item) => item.bounds.right));
  const bottom = Math.max(...items.map((item) => item.bounds.bottom));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  return items.map((item) => {
    let x = 0;
    let y = 0;

    switch (action) {
      case "align_left":
        x = left - item.bounds.x;
        break;
      case "align_center":
        x = centerX - item.bounds.centerX;
        break;
      case "align_right":
        x = right - item.bounds.right;
        break;
      case "align_top":
        y = top - item.bounds.y;
        break;
      case "align_middle":
        y = centerY - item.bounds.centerY;
        break;
      case "align_bottom":
        y = bottom - item.bounds.bottom;
        break;
    }

    return { placementId: item.placement.id, x: round(x), y: round(y) };
  });
}

function distributionDeltas(
  items: ArrangementItem[],
  action: "distribute_horizontal" | "distribute_vertical"
): PlacementArrangementResult {
  const horizontal = action === "distribute_horizontal";
  const sorted = [...items].sort((first, second) => {
    const coordinateDifference = horizontal
      ? first.bounds.x - second.bounds.x
      : first.bounds.y - second.bounds.y;

    return coordinateDifference || first.documentIndex - second.documentIndex;
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = horizontal
    ? last.bounds.right - first.bounds.x
    : last.bounds.bottom - first.bounds.y;
  const occupied = sorted.reduce(
    (total, item) =>
      total + (horizontal ? item.bounds.width : item.bounds.height),
    0
  );
  const gap = (span - occupied) / (sorted.length - 1);

  if (gap < -BOUNDS_EPSILON) {
    return failure(
      "insufficient_distribution_span",
      "The selection is too compressed to distribute without overlap."
    );
  }

  let cursor = horizontal ? first.bounds.right + gap : first.bounds.bottom + gap;
  const deltas = sorted.map((item, index) => {
    if (index === 0 || index === sorted.length - 1) {
      return { placementId: item.placement.id, x: 0, y: 0 };
    }

    const delta = horizontal ? cursor - item.bounds.x : cursor - item.bounds.y;
    const result = {
      placementId: item.placement.id,
      x: horizontal ? round(delta) : 0,
      y: horizontal ? 0 : round(delta)
    };
    cursor +=
      (horizontal ? item.bounds.width : item.bounds.height) + gap;
    return result;
  });

  return { ok: true, deltas };
}

function boundsContain(
  container: { x: number; y: number; width: number; height: number },
  item: { x: number; y: number; right: number; bottom: number }
): boolean {
  return (
    item.x >= container.x - BOUNDS_EPSILON &&
    item.y >= container.y - BOUNDS_EPSILON &&
    item.right <= container.x + container.width + BOUNDS_EPSILON &&
    item.bottom <= container.y + container.height + BOUNDS_EPSILON
  );
}

function validateContainment(
  model: DrawingSheetCanvasModel,
  items: ArrangementItem[],
  deltas: PlacementArrangementDelta[]
): PlacementArrangementResult | undefined {
  const deltaById = new Map(deltas.map((delta) => [delta.placementId, delta]));

  for (const item of items) {
    const delta = deltaById.get(item.placement.id) ?? { x: 0, y: 0 };
    const proposed = {
      x: item.bounds.x + delta.x,
      y: item.bounds.y + delta.y,
      right: item.bounds.right + delta.x,
      bottom: item.bounds.bottom + delta.y
    };
    const container = item.parentBackplane
      ? getBackplaneDisplayUsableBounds(
          model.sheet,
          item.parentBackplane,
          getParentPanelForBackplane(model.placements, item.parentBackplane)
        )
      : { x: 0, y: 0, width: model.sheet.width, height: model.sheet.height };

    if (!boundsContain(container, proposed)) {
      return failure(
        "containment_violation",
        item.parentBackplane
          ? "The arrangement would move equipment outside the usable backplane area."
          : "The arrangement would move equipment outside the drawing sheet."
      );
    }
  }

  return undefined;
}

export function resolvePlacementArrangement({
  model,
  symbols,
  placementIds,
  action
}: {
  model: DrawingSheetCanvasModel;
  symbols: ApprovedDrawingSymbol[];
  placementIds: string[];
  action: PlacementArrangementAction;
}): PlacementArrangementResult {
  const minimum = action.startsWith("distribute_") ? 3 : 2;

  if (new Set(placementIds).size < minimum) {
    return failure(
      "insufficient_selection",
      minimum === 3
        ? "Select at least three equipment symbols to distribute them."
        : "Select at least two equipment symbols to align them."
    );
  }

  const resolved = resolveArrangementItems({ model, symbols, placementIds });
  if (!resolved.ok) {
    return resolved.result;
  }

  const result = action.startsWith("distribute_")
    ? distributionDeltas(
        resolved.items,
        action as "distribute_horizontal" | "distribute_vertical"
      )
    : {
        ok: true as const,
        deltas: alignmentDeltas(
          resolved.items,
          action as Exclude<
            PlacementArrangementAction,
            "distribute_horizontal" | "distribute_vertical"
          >
        )
      };

  if (!result.ok) {
    return result;
  }

  return (
    validateContainment(model, resolved.items, result.deltas) ?? result
  );
}

function equalDelta(
  first: PlacementArrangementDelta,
  second: PlacementArrangementDelta
): boolean {
  return first.x === second.x && first.y === second.y;
}

export function applyPlacementArrangement({
  model,
  deltas
}: {
  model: DrawingSheetCanvasModel;
  deltas: PlacementArrangementDelta[];
}): DrawingSheetCanvasModel {
  if (deltas.every((delta) => delta.x === 0 && delta.y === 0)) {
    return model;
  }

  const deltaById = new Map(deltas.map((delta) => [delta.placementId, delta]));
  const placementById = new Map(
    model.placements.map((placement) => [placement.id, placement])
  );

  return {
    ...model,
    placements: model.placements.map((placement) => {
      const delta = deltaById.get(placement.id);
      if (!delta || (delta.x === 0 && delta.y === 0)) {
        return placement;
      }

      const parentBackplane = placement.layoutParentId
        ? placementById.get(placement.layoutParentId)
        : undefined;

      return parentBackplane && isBackplanePlacement(parentBackplane)
        ? moveLayoutHelperByDisplayDelta({
            sheet: model.sheet,
            placement,
            backplane: parentBackplane,
            delta,
            parentPanel: getParentPanelForBackplane(
              model.placements,
              parentBackplane
            )
          })
        : movePlacementWithAttachedLabel(placement, delta);
    }),
    connections: model.connections.map((connection) => {
      if (!connection.route) {
        return connection;
      }

      const participantIds = [
        connection.from.placementId,
        connection.to.placementId
      ];
      const participantDeltas = participantIds.map((placementId) =>
        deltaById.get(placementId)
      );
      const commonDelta = participantDeltas[0];

      if (
        !commonDelta ||
        participantDeltas.some(
          (delta) => !delta || !equalDelta(commonDelta, delta)
        ) ||
        (commonDelta.x === 0 && commonDelta.y === 0)
      ) {
        return connection;
      }

      return {
        ...connection,
        route: moveConnectionRouteWithinSheet(
          connection.route,
          commonDelta,
          model.sheet
        )
      };
    })
  };
}

export function placementArrangementMessage(
  action: PlacementArrangementAction,
  count: number
): string {
  return ARRANGEMENT_ACTION_MESSAGES[action](count);
}
