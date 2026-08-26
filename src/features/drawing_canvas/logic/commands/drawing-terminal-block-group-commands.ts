import { z } from "zod";
import {
  buildTerminalBlockGroupDefinition,
  getTerminalBlockGroupPhysicalSize,
  resolveDefaultTerminalBlockModule,
  type ResolvedTerminalBlockModule
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-groups";
import { formatDrawingMeasurementPair } from "../services/drawing-measurement-units";
import {
  GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
  GENERATED_TERMINAL_BLOCK_VERSION_ID,
  TERMINAL_BLOCK_TAG_PREFIX,
  normalizeTerminalBlockPlacement,
  terminalBlockTerminals
} from "@/features/drawing_terminal_blocks/logic/services/terminal-block-layout";
import {
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId,
  placementAssetId
} from "../services/drawing-asset-identity";
import {
  getBackplanePhysicalUsableBounds,
  getLayoutPosition,
  getParentPanelForBackplane,
  resolveLayoutHelperDisplayPlacement
} from "../services/drawing-backplane-scale";
import { isBackplanePlacement } from "../services/drawing-backplane-layouts";

const GROUP_GRID_MM = 5;

const createTerminalBlockGroupInputSchema = z.object({
  sheetId: z.string().trim().min(1),
  backplaneId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional(),
  count: z.number().int().min(2).max(80)
});

type PhysicalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CreateTerminalBlockGroupInput = z.infer<
  typeof createTerminalBlockGroupInputSchema
> & {
  assetId?: string;
  placementId?: string;
};

export type TerminalBlockGroupCommandResult = {
  model: DrawingModel;
  assetId: string;
  placement: DrawingPlacement;
};

export type TerminalBlockGroupResizeValidation =
  | { ok: true }
  | { ok: false; error: string };

function createPlacementId(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return `terminal_group_${suffix}`;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function rectanglesOverlap(first: PhysicalRect, second: PhysicalRect): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function sheetCanvasDefinition(
  model: DrawingModel,
  sheet: DrawingPackageSheet
) {
  return { ...sheet.page, titleBlock: model.titleBlock };
}

function orthogonalPhysicalSize(
  placement: DrawingPlacement
): { width: number; height: number } {
  const width = placement.layoutDimensions?.lengthMm ?? 1;
  const height = placement.layoutDimensions?.widthMm ?? 1;
  const rotation = ((Math.round(placement.rotation / 90) * 90) % 360 + 360) % 360;

  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function occupiedEquipmentRects({
  model,
  sheet,
  backplane,
  excludeAssetId
}: {
  model: DrawingModel;
  sheet: DrawingPackageSheet;
  backplane: DrawingPlacement;
  excludeAssetId?: string;
}): PhysicalRect[] {
  const canvasSheet = sheetCanvasDefinition(model, sheet);

  return sheet.placements
    .filter(
      (placement) =>
        placement.layoutParentId === backplane.id &&
        Boolean(placement.assetId) &&
        placementAssetId(placement) !== excludeAssetId
    )
    .map((placement) => {
      const position = getLayoutPosition(canvasSheet, placement, backplane);
      const size = orthogonalPhysicalSize(placement);

      return {
        x: position.xMm - GROUP_GRID_MM,
        y: position.yMm - GROUP_GRID_MM,
        width: size.width + GROUP_GRID_MM * 2,
        height: size.height + GROUP_GRID_MM * 2
      };
    });
}

function axisCandidates(minimum: number, maximum: number): number[] {
  if (maximum < minimum) return [];

  const values: number[] = [];
  for (
    let value = Math.ceil(minimum / GROUP_GRID_MM) * GROUP_GRID_MM;
    value <= maximum + 0.001;
    value += GROUP_GRID_MM
  ) {
    values.push(round(value));
  }

  if (values.length === 0 || Math.abs(values[values.length - 1] - maximum) > 0.001) {
    values.push(round(maximum));
  }

  return values;
}

export function findTerminalBlockGroupPosition({
  model,
  sheet,
  backplane,
  size,
  excludeAssetId
}: {
  model: DrawingModel;
  sheet: DrawingPackageSheet;
  backplane: DrawingPlacement;
  size: { lengthMm: number; widthMm: number };
  excludeAssetId?: string;
}): { xMm: number; yMm: number } | undefined {
  const usable = getBackplanePhysicalUsableBounds(backplane);
  const maximumX = usable.x + usable.width - size.lengthMm;
  const maximumY = usable.y + usable.height - size.widthMm;

  if (maximumX < usable.x || maximumY < usable.y) {
    return undefined;
  }

  const centerX = usable.x + (usable.width - size.lengthMm) / 2;
  const centerY = usable.y + (usable.height - size.widthMm) / 2;
  const occupied = occupiedEquipmentRects({
    model,
    sheet,
    backplane,
    excludeAssetId
  });
  const candidates = axisCandidates(usable.y, maximumY).flatMap((y) =>
    axisCandidates(usable.x, maximumX).map((x) => ({
      x,
      y,
      distanceX: Math.abs(x - centerX),
      distanceY: Math.abs(y - centerY),
      rightFirst: x >= centerX ? 0 : 1
    }))
  );

  candidates.sort(
    (first, second) =>
      first.distanceY - second.distanceY ||
      first.distanceX - second.distanceX ||
      first.rightFirst - second.rightFirst ||
      first.y - second.y ||
      first.x - second.x
  );

  const available = candidates.find((candidate) =>
    occupied.every(
      (rect) =>
        !rectanglesOverlap(
          {
            x: candidate.x,
            y: candidate.y,
            width: size.lengthMm,
            height: size.widthMm
          },
          rect
        )
    )
  );

  return available ? { xMm: available.x, yMm: available.y } : undefined;
}

function findSheetAndBackplane(
  model: DrawingModel,
  sheetId: string,
  backplaneId: string
): { sheet: DrawingPackageSheet; backplane: DrawingPlacement } {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new Error("The active drawing sheet was not found.");

  const backplane = sheet.placements.find(
    (placement) => placement.id === backplaneId && isBackplanePlacement(placement)
  );
  if (!backplane) throw new Error("Choose a backplane before adding a terminal group.");
  if (!backplane.containerAssetId) {
    throw new Error("Choose a backplane assigned to a panel or enclosure.");
  }

  return { sheet, backplane };
}

export function createAndPlaceTerminalBlockGroup({
  model: inputModel,
  symbols,
  input
}: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  input: CreateTerminalBlockGroupInput;
}): TerminalBlockGroupCommandResult {
  const model = drawingPackageModelSchema.parse(inputModel);
  const parsed = createTerminalBlockGroupInputSchema.parse(input);
  const { sheet, backplane } = findSheetAndBackplane(
    model,
    parsed.sheetId,
    parsed.backplaneId
  );
  const moduleResolution = resolveDefaultTerminalBlockModule(symbols);

  if (!moduleResolution.ok) throw new Error(moduleResolution.error);

  const terminalBlock = buildTerminalBlockGroupDefinition({
    count: parsed.count,
    module: moduleResolution.module
  });
  const size = getTerminalBlockGroupPhysicalSize(terminalBlock);
  const position = findTerminalBlockGroupPosition({
    model,
    sheet,
    backplane,
    size
  });

  if (!position) {
    throw new Error(
      `This ${formatDrawingMeasurementPair(
        size.lengthMm,
        size.widthMm,
        model.measurementUnit
      )} terminal group does not fit in the available backplane space.`
    );
  }

  const placementId = input.placementId ?? createPlacementId();
  const assetId = input.assetId ?? createDrawingAssetId(placementId);
  const tag = allocateNextTagFromPrefix({
    model,
    prefix: TERMINAL_BLOCK_TAG_PREFIX
  });
  const physicalPlacement: DrawingPlacement = {
    id: placementId,
    assetId,
    containerAssetId: backplane.containerAssetId,
    layoutKind: "layout_helper",
    layoutParentId: backplane.id,
    symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
    versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
    role: "terminal_block",
    tag,
    title: parsed.name,
    x: backplane.x,
    y: backplane.y,
    rotation: 0,
    scale: 1,
    layoutPosition: position,
    layoutDimensions: size,
    layoutLabel: { visible: true, position: "top-center" },
    terminalBlock
  };
  const displayPlacement = resolveLayoutHelperDisplayPlacement({
    sheet: sheetCanvasDefinition(model, sheet),
    placement: physicalPlacement,
    backplane,
    parentPanel: getParentPanelForBackplane(sheet.placements, backplane)
  });
  const placement = {
    ...physicalPlacement,
    x: displayPlacement.x,
    y: displayPlacement.y
  };
  const nextModel: DrawingModel = {
    ...model,
    assets: [
      ...model.assets,
      {
        id: assetId,
        tag,
        type: "terminal_block",
        title: parsed.name,
        description: parsed.description || undefined,
        symbolId: GENERATED_TERMINAL_BLOCK_SYMBOL_ID,
        versionId: GENERATED_TERMINAL_BLOCK_VERSION_ID,
        metadata: {
          generatedKind: "modular_terminal_strip",
          symbolKey: "generated_modular_terminal_block"
        },
        terminalBlock
      }
    ],
    sheets: model.sheets.map((candidate) =>
      candidate.id === sheet.id
        ? { ...candidate, placements: [...candidate.placements, placement] }
        : candidate
    )
  };

  return {
    model: drawingPackageModelSchema.parse(nextModel),
    assetId,
    placement
  };
}

function terminalRefIsRemoved(
  ref: { assetId: string; terminalKey: string } | undefined,
  assetId: string,
  removedKeys: Set<string>
): boolean {
  return Boolean(
    ref && ref.assetId === assetId && removedKeys.has(ref.terminalKey)
  );
}

function removedTerminalIsInUse(
  model: DrawingModel,
  assetId: string,
  removedKeys: Set<string>
): boolean {
  const placementIds = new Set(
    model.sheets
      .flatMap((sheet) => sheet.placements)
      .filter((placement) => placementAssetId(placement) === assetId)
      .map((placement) => placement.id)
  );
  const removedAnchors = new Set(
    [...removedKeys].flatMap((key) => [`${key}_TOP`, `${key}_BOTTOM`])
  );

  if (
    model.sheets.some((sheet) =>
      sheet.connections.some(
        (connection) =>
          (placementIds.has(connection.from.placementId) &&
            removedAnchors.has(connection.from.anchorKey)) ||
          (placementIds.has(connection.to.placementId) &&
            removedAnchors.has(connection.to.anchorKey))
      )
    )
  ) {
    return true;
  }

  const wiring = model.panelWiring;
  if (!wiring) return false;

  return Boolean(
    wiring.terminalMappings.some((mapping) =>
      terminalRefIsRemoved(mapping.target, assetId, removedKeys)
    ) ||
      wiring.internalWires.some(
        (wire) =>
          terminalRefIsRemoved(wire.from, assetId, removedKeys) ||
          terminalRefIsRemoved(wire.to, assetId, removedKeys)
      ) ||
      wiring.bridges.some((bridge) =>
        bridge.members.some((member) =>
          terminalRefIsRemoved(member, assetId, removedKeys)
        )
      ) ||
      wiring.bonds.some(
        (bond) =>
          terminalRefIsRemoved(bond.source, assetId, removedKeys) ||
          bond.endpoints.some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              terminalRefIsRemoved(endpoint.terminal, assetId, removedKeys)
          )
      )
  );
}

export function validateTerminalBlockGroupResize({
  model,
  assetId,
  count
}: {
  model: DrawingModel;
  assetId: string;
  count: number;
}): TerminalBlockGroupResizeValidation {
  if (!Number.isInteger(count) || count < 2 || count > 80) {
    return { ok: false, error: "Terminal count must be between 2 and 80." };
  }

  const asset = model.assets.find((candidate) => candidate.id === assetId);
  const occurrence = model.sheets
    .flatMap((sheet) => sheet.placements)
    .find(
      (placement) =>
        placementAssetId(placement) === assetId && placement.terminalBlock
    );
  const current = normalizeTerminalBlockPlacement(
    asset?.terminalBlock ?? occurrence?.terminalBlock
  );

  if (count >= current.count) return { ok: true };

  const removedKeys = new Set(
    terminalBlockTerminals(current)
      .slice(count)
      .map((terminal) => terminal.key)
  );

  return removedTerminalIsInUse(model, assetId, removedKeys)
    ? {
        ok: false,
        error:
          "Terminal count cannot remove terminals used by wiring or terminal mappings."
      }
    : { ok: true };
}

export function updateTerminalBlockGroup({
  model: inputModel,
  assetId,
  count,
  name,
  description,
  module
}: {
  model: DrawingModel;
  assetId: string;
  count?: number;
  name?: string;
  description?: string;
  module?: ResolvedTerminalBlockModule;
}): DrawingModel {
  const model = drawingPackageModelSchema.parse(inputModel);
  const asset = model.assets.find((candidate) => candidate.id === assetId);
  const occurrence = model.sheets
    .flatMap((sheet) => sheet.placements)
    .find(
      (placement) =>
        placementAssetId(placement) === assetId && placement.terminalBlock
    );

  if (!asset || asset.type !== "terminal_block" || !occurrence?.terminalBlock) {
    throw new Error("Terminal block group was not found.");
  }

  const current = normalizeTerminalBlockPlacement(
    asset.terminalBlock ?? occurrence.terminalBlock
  );
  const nextCount = count ?? current.count;
  const validation = validateTerminalBlockGroupResize({
    model,
    assetId,
    count: nextCount
  });
  if (!validation.ok) throw new Error(validation.error);

  const moduleDefinition = module
    ? buildTerminalBlockGroupDefinition({
        count: nextCount,
        module
      })
    : current;
  const terminalBlock = normalizeTerminalBlockPlacement({
    ...moduleDefinition,
    count: nextCount,
    startNumber: current.startNumber
  });
  const size = getTerminalBlockGroupPhysicalSize(terminalBlock);
  const normalizedName = name?.trim();
  const normalizedDescription = description?.trim();
  const sheets = model.sheets.map((sheet) => {
    const canvasSheet = sheetCanvasDefinition(model, sheet);
    const placements = sheet.placements.map((placement) => {
      if (placementAssetId(placement) !== assetId || !placement.terminalBlock) {
        return placement;
      }

      const base = {
        ...placement,
        title: normalizedName || placement.title,
        terminalBlock
      };

      if (placement.layoutKind !== "layout_helper" || !placement.layoutParentId) {
        return base;
      }

      const backplane = sheet.placements.find(
        (candidate) =>
          candidate.id === placement.layoutParentId &&
          isBackplanePlacement(candidate)
      );
      if (!backplane) return { ...base, layoutDimensions: size };

      const currentPosition = getLayoutPosition(
        canvasSheet,
        placement,
        backplane
      );
      const oldWidth = placement.layoutDimensions?.lengthMm ?? size.lengthMm;
      const layoutPosition = {
        xMm: round(currentPosition.xMm + (oldWidth - size.lengthMm) / 2),
        yMm: currentPosition.yMm
      };
      const usable = getBackplanePhysicalUsableBounds(backplane);

      if (
        layoutPosition.xMm < usable.x ||
        layoutPosition.yMm < usable.y ||
        layoutPosition.xMm + size.lengthMm > usable.x + usable.width ||
        layoutPosition.yMm + size.widthMm > usable.y + usable.height
      ) {
        throw new Error(
          "Move the terminal group to create enough backplane space before resizing it."
        );
      }

      const nextBounds = {
        x: layoutPosition.xMm,
        y: layoutPosition.yMm,
        width: size.lengthMm,
        height: size.widthMm
      };
      const overlapsEquipment = occupiedEquipmentRects({
        model,
        sheet,
        backplane,
        excludeAssetId: assetId
      }).some((bounds) => rectanglesOverlap(nextBounds, bounds));

      if (overlapsEquipment) {
        throw new Error(
          "Move nearby equipment to create enough backplane space before resizing this terminal group."
        );
      }

      const physical = {
        ...base,
        layoutPosition,
        layoutDimensions: size
      };
      const display = resolveLayoutHelperDisplayPlacement({
        sheet: canvasSheet,
        placement: physical,
        backplane,
        parentPanel: getParentPanelForBackplane(sheet.placements, backplane)
      });

      return { ...physical, x: display.x, y: display.y };
    });

    return { ...sheet, placements };
  });

  return drawingPackageModelSchema.parse({
    ...model,
    assets: model.assets.map((candidate) =>
      candidate.id === assetId
        ? {
            ...candidate,
            title: normalizedName || candidate.title,
            description:
              description === undefined
                ? candidate.description
                : normalizedDescription || undefined,
            terminalBlock
          }
        : candidate
    ),
    sheets
  });
}
