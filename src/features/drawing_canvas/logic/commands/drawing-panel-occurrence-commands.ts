import {
  buildPackageConnectivityGraph,
  buildPanelDiscoveryIndex
} from "@/features/drawing_panel_wiring/api/public";
import { TERMINAL_BLOCK_SCHEMATIC_SCALE } from "../services/drawing-terminal-blocks";
import {
  drawingPackageModelSchema,
  type DrawingAssetRecord,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import { createPanelWiringSource } from "../../api/panel-wiring-contracts";
import { getPlacementBounds } from "../services/drawing-geometry";
import { getRenderableSymbolForPlacement } from "../services/drawing-generated-symbols";
import { moveCanvasSelection } from "../services/drawing-movement";
import {
  replaceSheetFromCanvasModel,
  toSheetCanvasModel
} from "./drawing-sheet-commands";

const DRAWING_MARGIN = 20;
const TITLE_BLOCK_CLEARANCE = 55;
const DEFAULT_DETAILED_PANEL_SCHEMATIC_SCALE = 0.34;

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

export type CenterDetailedPanelEquipmentResult = {
  model: DrawingModel;
  placementIds: string[];
  delta: { x: number; y: number };
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function getDetailedPanelUsableDrawingRect(
  sheet: DrawingPackageSheet
): PlacementRect {
  const right = Math.max(DRAWING_MARGIN, sheet.page.width - DRAWING_MARGIN);
  const bottom = Math.max(
    DRAWING_MARGIN,
    sheet.page.height - TITLE_BLOCK_CLEARANCE
  );

  return {
    x: DRAWING_MARGIN,
    y: DRAWING_MARGIN,
    width: Math.max(0, right - DRAWING_MARGIN),
    height: Math.max(0, bottom - DRAWING_MARGIN)
  };
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
  const usable = getDetailedPanelUsableDrawingRect(sheet);
  const step = Math.max(5, sheet.page.gridSize);
  const localOffsetX = bounds.x - placement.x;
  const localOffsetY = bounds.y - placement.y;
  const minimumX = usable.x - localOffsetX;
  const maximumX = Math.max(
    minimumX,
    usable.x + usable.width - localOffsetX - bounds.width
  );
  const minimumY = usable.y - localOffsetY;
  const maximumY = Math.max(
    minimumY,
    usable.y + usable.height - localOffsetY - bounds.height
  );
  const centerX = usable.x + usable.width / 2;
  const centerY = usable.y + usable.height / 2;
  const occupied = sheet.placements.map((candidate) => {
    const rect = placementRect(candidate, symbols);
    return {
      x: rect.x - step,
      y: rect.y - step,
      width: rect.width + step * 2,
      height: rect.height + step * 2
    };
  });
  const candidates: Array<{
    x: number;
    y: number;
    centerDistanceX: number;
    centerDistanceY: number;
    horizontalOrder: number;
  }> = [];

  for (
    let y = Math.ceil(minimumY / step) * step;
    y <= maximumY + 0.001;
    y += step
  ) {
    for (
      let x = Math.ceil(minimumX / step) * step;
      x <= maximumX + 0.001;
      x += step
    ) {
      const candidateCenterX = x + localOffsetX + bounds.width / 2;
      const candidateCenterY = y + localOffsetY + bounds.height / 2;
      candidates.push({
        x,
        y,
        centerDistanceX: Math.abs(candidateCenterX - centerX),
        centerDistanceY: Math.abs(candidateCenterY - centerY),
        horizontalOrder: candidateCenterX >= centerX ? 0 : 1
      });
    }
  }

  candidates.sort(
    (first, second) =>
      first.centerDistanceY - second.centerDistanceY ||
      first.centerDistanceX - second.centerDistanceX ||
      first.horizontalOrder - second.horizontalOrder ||
      first.y - second.y ||
      first.x - second.x
  );

  const available = candidates.find((candidate) => {
    const candidateRect = {
      x: candidate.x + localOffsetX,
      y: candidate.y + localOffsetY,
      width: bounds.width,
      height: bounds.height
    };
    return !occupied.some((current) => rectanglesOverlap(candidateRect, current));
  });

  if (available) {
    return { x: available.x, y: available.y };
  }

  return {
    x: clamp(
      snap(centerX - localOffsetX - bounds.width / 2, step),
      minimumX,
      maximumX
    ),
    y: clamp(
      snap(centerY - localOffsetY - bounds.height / 2, step),
      minimumY,
      maximumY
    )
  };
}

export function centerDetailedPanelEquipment({
  model: inputModel,
  sheetId,
  symbols = []
}: {
  model: DrawingModel;
  sheetId: string;
  symbols?: ApprovedDrawingSymbol[];
}): CenterDetailedPanelEquipmentResult {
  const model = drawingPackageModelSchema.parse(inputModel);
  const sheet = getDetailedPanelSheet(model, sheetId);
  const panelAssetId = sheet.panelDrawingContext.panelAssetId;
  const placements = sheet.placements.filter(
    (placement) =>
      Boolean(placement.assetId) &&
      placement.containerAssetId === panelAssetId &&
      !placement.layoutKind &&
      !placement.panelReference &&
      !placement.panelPatternLegend
  );
  const placementIds = placements.map((placement) => placement.id);

  if (placements.length === 0) {
    return { model, placementIds, delta: { x: 0, y: 0 } };
  }

  const bounds = placements.map((placement) => placementRect(placement, symbols));
  const minimumX = Math.min(...bounds.map((rect) => rect.x));
  const minimumY = Math.min(...bounds.map((rect) => rect.y));
  const maximumX = Math.max(...bounds.map((rect) => rect.x + rect.width));
  const maximumY = Math.max(...bounds.map((rect) => rect.y + rect.height));
  const usable = getDetailedPanelUsableDrawingRect(sheet);
  const step = Math.max(5, sheet.page.gridSize);
  const centeredX = usable.x + usable.width / 2 - (minimumX + maximumX) / 2;
  const centeredY = usable.y + usable.height / 2 - (minimumY + maximumY) / 2;
  const groupWidth = maximumX - minimumX;
  const groupHeight = maximumY - minimumY;
  const delta = {
    x:
      groupWidth <= usable.width
        ? clamp(
            snap(centeredX, step),
            usable.x - minimumX,
            usable.x + usable.width - maximumX
          )
        : usable.x - minimumX,
    y:
      groupHeight <= usable.height
        ? clamp(
            snap(centeredY, step),
            usable.y - minimumY,
            usable.y + usable.height - maximumY
          )
        : usable.y - minimumY
  };

  if (delta.x === 0 && delta.y === 0) {
    return { model, placementIds, delta };
  }

  const canvasModel = toSheetCanvasModel(model, sheetId);
  const moved = moveCanvasSelection({
    model: canvasModel,
    selection: { placementIds, annotationIds: [] },
    delta,
    symbols
  });

  return {
    model: drawingPackageModelSchema.parse(
      replaceSheetFromCanvasModel(model, sheetId, moved)
    ),
    placementIds,
    delta
  };
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

function getRepresentationSourcePlacement(
  model: DrawingModel,
  sourceOccurrence: { sheetId: string; placementId: string }
): DrawingPlacement | undefined {
  return model.sheets
    .find((sheet) => sheet.id === sourceOccurrence.sheetId)
    ?.placements.find(
      (candidate) => candidate.id === sourceOccurrence.placementId
    );
}

function createRepresentationPlacement({
  source,
  sourceOccurrenceKind,
  asset,
  panelAssetId,
  id,
  symbols
}: {
  source: DrawingPlacement;
  sourceOccurrenceKind: "wiring" | "layout" | "enclosure_reference";
  asset: DrawingAssetRecord;
  panelAssetId: string;
  id: string;
  symbols: ApprovedDrawingSymbol[];
}): DrawingPlacement {
  const terminalBlock = asset.terminalBlock ?? source.terminalBlock;
  const effectiveSource = terminalBlock
    ? { ...source, terminalBlock }
    : source;
  const sourceSymbol = getRenderableSymbolForPlacement(
    effectiveSource,
    symbols
  );
  const scale =
    sourceOccurrenceKind === "layout"
      ? terminalBlock
        ? TERMINAL_BLOCK_SCHEMATIC_SCALE
        : sourceSymbol?.metadata.panelWiring?.schematicScale ??
          DEFAULT_DETAILED_PANEL_SCHEMATIC_SCALE
      : source.scale;

  return {
    id,
    assetId: asset.id,
    containerAssetId: panelAssetId,
    symbolId: source.symbolId,
    versionId: source.versionId,
    role: source.role,
    tag: asset.tag,
    title: asset.title,
    x: 0,
    y: 0,
    rotation: 0,
    scale,
    terminalBlock
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

  if (!row.representationSource) {
    throw new Error("No resolved electrical representation source is available.");
  }

  const source = getRepresentationSourcePlacement(
    model,
    row.representationSource
  );
  const asset = model.assets.find((candidate) => candidate.id === assetId);

  if (!source?.assetId || !asset) {
    throw new Error(
      "The selected electrical representation source is no longer available."
    );
  }

  const draft = createRepresentationPlacement({
    source,
    sourceOccurrenceKind: row.representationSource.occurrenceKind,
    asset,
    panelAssetId,
    id: createOccurrencePlacementId(),
    symbols
  });
  const draftSymbol = getRenderableSymbolForPlacement(draft, symbols);

  if (!draftSymbol || draftSymbol.metadata.terminals.length === 0) {
    throw new Error(
      "The selected asset no longer has resolved electrical terminal metadata."
    );
  }

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
