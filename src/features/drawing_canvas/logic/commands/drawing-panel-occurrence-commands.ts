import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";
import { getPlacementBounds } from "../services/drawing-geometry";
import { getRenderableSymbolForPlacement } from "../services/drawing-generated-symbols";

const DRAWING_MARGIN = 20;
const TITLE_BLOCK_CLEARANCE = 55;

type PlacementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlacePanelAssetOccurrenceResult = {
  model: DrawingModel;
  placement: DrawingPlacement;
};

export type RemovePanelAssetOccurrenceResult = {
  model: DrawingModel;
  assetId: string;
};

function createOccurrencePlacementId(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return `panel_occurrence_${suffix}`;
}

function rectanglesOverlap(first: PlacementRect, second: PlacementRect): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function placementRect(
  placement: DrawingPlacement,
  symbols: ApprovedDrawingSymbol[]
): PlacementRect {
  const symbol = getRenderableSymbolForPlacement(placement, symbols);

  if (!symbol) {
    return {
      x: placement.x,
      y: placement.y,
      width: 20,
      height: 20
    };
  }

  return getPlacementBounds(placement, symbol.metadata);
}

export function findNextPanelOccurrencePosition({
  sheet,
  placement,
  symbols
}: {
  sheet: DrawingPackageSheet;
  placement: DrawingPlacement;
  symbols: ApprovedDrawingSymbol[];
}): { x: number; y: number } {
  const bounds = placementRect(placement, symbols);
  const occupied = sheet.placements.map((candidate) =>
    placementRect(candidate, symbols)
  );
  const step = Math.max(5, sheet.page.gridSize);
  const maxX = Math.max(DRAWING_MARGIN, sheet.page.width - DRAWING_MARGIN - bounds.width);
  const maxY = Math.max(
    DRAWING_MARGIN,
    sheet.page.height - TITLE_BLOCK_CLEARANCE - bounds.height
  );

  for (let y = DRAWING_MARGIN; y <= maxY; y += step) {
    for (let x = DRAWING_MARGIN; x <= maxX; x += step) {
      const candidate = { x, y, width: bounds.width, height: bounds.height };

      if (!occupied.some((current) => rectanglesOverlap(candidate, current))) {
        return { x, y };
      }
    }
  }

  return { x: DRAWING_MARGIN, y: DRAWING_MARGIN };
}

function getDetailedPanelSheet(
  model: DrawingModel,
  sheetId: string
): DrawingPackageSheet & {
  panelDrawingContext: NonNullable<DrawingPackageSheet["panelDrawingContext"]>;
} {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);

  if (!sheet) {
    throw new Error("The Detailed Panel Drawing sheet no longer exists.");
  }

  if (sheet.panelDrawingContext?.kind !== "detailed_panel_wiring") {
    throw new Error("Asset occurrences can only be placed on a Detailed Panel Drawing.");
  }

  return sheet as DrawingPackageSheet & {
    panelDrawingContext: NonNullable<DrawingPackageSheet["panelDrawingContext"]>;
  };
}

function getCanonicalSourcePlacement(
  model: DrawingModel,
  sourceOccurrences: Array<{ sheetId: string; placementId: string; occurrenceKind: string }>
): DrawingPlacement | undefined {
  const ordered = [...sourceOccurrences].sort((first, second) => {
    const firstPriority = first.occurrenceKind === "wiring" ? 0 : 1;
    const secondPriority = second.occurrenceKind === "wiring" ? 0 : 1;

    return (
      firstPriority - secondPriority ||
      first.sheetId.localeCompare(second.sheetId) ||
      first.placementId.localeCompare(second.placementId)
    );
  });

  for (const occurrence of ordered) {
    const placement = model.sheets
      .find((sheet) => sheet.id === occurrence.sheetId)
      ?.placements.find((candidate) => candidate.id === occurrence.placementId);

    if (placement) {
      return placement;
    }
  }

  return undefined;
}

function createRepresentationPlacement({
  source,
  panelAssetId,
  id
}: {
  source: DrawingPlacement;
  panelAssetId: string;
  id: string;
}): DrawingPlacement {
  return {
    id,
    assetId: source.assetId,
    containerAssetId: panelAssetId,
    symbolId: source.symbolId,
    versionId: source.versionId,
    role: source.role,
    tag: source.tag,
    title: source.title,
    x: 0,
    y: 0,
    rotation: 0,
    scale: source.scale,
    terminalBlock: source.terminalBlock
  };
}

export function placePanelAssetOccurrence({
  model: inputModel,
  sheetId,
  assetId,
  symbols = []
}: {
  model: DrawingModel;
  sheetId: string;
  assetId: string;
  symbols?: ApprovedDrawingSymbol[];
}): PlacePanelAssetOccurrenceResult {
  const model = drawingPackageModelSchema.parse(inputModel);
  const sheet = getDetailedPanelSheet(model, sheetId);
  const panelAssetId = sheet.panelDrawingContext.panelAssetId;
  const graph = buildPackageConnectivityGraph(
    createPanelWiringSource(model, symbols)
  );
  const discovery = buildPanelDiscoveryIndex({
    graph,
    panelAssetId,
    detailedSheetId: sheetId
  });
  const row = discovery.assetsById.get(assetId);

  if (!row) {
    throw new Error("The selected asset is not associated with this panel.");
  }

  if (row.representedPlacementId) {
    throw new Error("This asset is already represented on the Detailed Panel Drawing.");
  }

  if (row.status !== "available") {
    throw new Error(row.disabledReason ?? "This panel asset cannot be placed.");
  }

  const source = getCanonicalSourcePlacement(model, row.sourceOccurrences);

  if (!source?.assetId) {
    throw new Error("No compatible source occurrence is available for this asset.");
  }

  const draft = createRepresentationPlacement({
    source,
    panelAssetId,
    id: createOccurrencePlacementId()
  });
  const position = findNextPanelOccurrencePosition({
    sheet,
    placement: draft,
    symbols
  });
  const placement = { ...draft, ...position };
  const nextModel = {
    ...model,
    sheets: model.sheets.map((candidate) =>
      candidate.id === sheetId
        ? { ...candidate, placements: [...candidate.placements, placement] }
        : candidate
    )
  };

  return {
    model: drawingPackageModelSchema.parse(nextModel),
    placement
  };
}

export function removePanelAssetOccurrence({
  model: inputModel,
  sheetId,
  placementId
}: {
  model: DrawingModel;
  sheetId: string;
  placementId: string;
}): RemovePanelAssetOccurrenceResult {
  const model = drawingPackageModelSchema.parse(inputModel);
  const sheet = getDetailedPanelSheet(model, sheetId);
  const placement = sheet.placements.find(
    (candidate) => candidate.id === placementId
  );

  if (!placement?.assetId) {
    throw new Error("The selected placement is not a panel asset occurrence.");
  }

  if (placement.containerAssetId !== sheet.panelDrawingContext.panelAssetId) {
    throw new Error("The selected occurrence does not belong to this panel.");
  }

  const referenced = sheet.connections.some(
    (connection) =>
      connection.from.placementId === placementId ||
      connection.to.placementId === placementId ||
      connection.cablePlacementId === placementId
  );

  if (referenced) {
    throw new Error(
      "Remove sheet-local connections from this occurrence before removing its representation."
    );
  }

  return {
    model: drawingPackageModelSchema.parse({
      ...model,
      sheets: model.sheets.map((candidate) =>
        candidate.id === sheetId
          ? {
              ...candidate,
              placements: candidate.placements.filter(
                (current) => current.id !== placementId
              )
            }
          : candidate
      )
    }),
    assetId: placement.assetId
  };
}
