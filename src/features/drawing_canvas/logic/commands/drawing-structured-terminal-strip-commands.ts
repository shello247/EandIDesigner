import { z } from "zod";
import {
  composeTerminalStripGeometry,
  projectStructuredTerminalStripTerminals,
  structuredTerminalStripSchema,
  validateStructuredTerminalStripMembers,
  type StructuredTerminalStrip
} from "@/features/drawing_terminal_blocks/api/public";
import {
  engineeringAttributeContainerSchema
} from "@/features/engineering_attributes/api/public";
import {
  drawingPackageModelSchema,
  type DrawingAssetRecord,
  type DrawingModel,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  allocateNextTagFromPrefix,
  createDrawingAssetId
} from "../services/drawing-asset-identity";
import {
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "../services/drawing-generated-symbols";
import {
  getBackplanesForSheet,
  isBackplanePlacement
} from "../services/drawing-backplane-layouts";
import {
  getParentPanelForBackplane,
  resolveLayoutHelperDisplayPlacement
} from "../services/drawing-backplane-scale";
import {
  getBackplanePhysicalUsableBounds,
  getLayoutPosition
} from "../services/drawing-backplane-scale";
import { isDinRailSymbol } from "../services/drawing-layout-labels";
import { findTerminalBlockGroupPosition } from "./drawing-terminal-block-group-commands";

const inputSchema = z.object({
  sheetId: z.string().trim().min(1),
  backplaneId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional(),
  engineeringAttributes: engineeringAttributeContainerSchema.optional(),
  strip: structuredTerminalStripSchema,
  rotation: z.number().finite().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional()
});

export type CreateStructuredTerminalStripInput = z.infer<typeof inputSchema> & {
  assetId?: string;
  placementId?: string;
};

export type StructuredTerminalStripCommandResult = {
  model: DrawingModel;
  assetId: string;
  placement: DrawingPlacement;
};

function createId(prefix: string): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${suffix}`;
}

function canvasSheet(model: DrawingModel, sheet: DrawingModel["sheets"][number]) {
  return { ...sheet.page, titleBlock: model.titleBlock };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function placementForStructuredStrip(params: {
  model: DrawingModel;
  sheet: DrawingModel["sheets"][number];
  asset: DrawingAssetRecord & { terminalStrip: StructuredTerminalStrip };
  symbols: ApprovedDrawingSymbol[];
  placementId: string;
  backplaneId?: string;
  rotation?: number;
  x?: number;
  y?: number;
}): DrawingPlacement {
  const geometry = composeTerminalStripGeometry(
    params.asset.terminalStrip,
    params.symbols
  );
  const symbolId = structuredTerminalStripSymbolId(params.asset.id);
  const versionId = structuredTerminalStripVersionId(params.asset.id);
  const backplane = params.backplaneId
    ? params.sheet.placements.find(
        (placement) =>
          placement.id === params.backplaneId && isBackplanePlacement(placement)
      )
    : undefined;
  const rotation = params.rotation ?? 0;
  const quarterTurns = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const occupiedSize =
    quarterTurns % 2 === 0
      ? { lengthMm: geometry.widthMm, widthMm: geometry.heightMm }
      : { lengthMm: geometry.heightMm, widthMm: geometry.widthMm };

  if (params.backplaneId && !backplane) {
    throw new Error("The selected backplane is unavailable.");
  }

  if (backplane) {
    if (!backplane.containerAssetId) {
      throw new Error("Choose a backplane assigned to a panel or enclosure.");
    }
    const position = findTerminalBlockGroupPosition({
      model: params.model,
      sheet: params.sheet,
      backplane,
      size: occupiedSize
    });
    if (!position) {
      throw new Error("The terminal strip does not fit in the available backplane space.");
    }
    const physicalPlacement: DrawingPlacement = {
      id: params.placementId,
      assetId: params.asset.id,
      containerAssetId: backplane.containerAssetId,
      layoutKind: "layout_helper",
      layoutParentId: backplane.id,
      symbolId,
      versionId,
      role: "terminal_block",
      tag: params.asset.tag,
      title: params.asset.title,
      x: backplane.x,
      y: backplane.y,
      rotation,
      scale: 1,
      layoutPosition: position,
      layoutDimensions: {
        lengthMm: geometry.widthMm,
        widthMm: geometry.heightMm
      },
      layoutLabel: { visible: true, position: "top-center" }
    };
    const display = resolveLayoutHelperDisplayPlacement({
      sheet: canvasSheet(params.model, params.sheet),
      placement: physicalPlacement,
      backplane,
      parentPanel: getParentPanelForBackplane(
        params.sheet.placements,
        backplane
      )
    });
    return { ...physicalPlacement, x: display.x, y: display.y };
  }

  const sheet = canvasSheet(params.model, params.sheet);
  return {
    id: params.placementId,
    assetId: params.asset.id,
    symbolId,
    versionId,
    role: "terminal_block",
    tag: params.asset.tag,
    title: params.asset.title,
    x: Number(
      clamp(
        params.x ?? (sheet.width - geometry.widthMm) / 2,
        0,
        Math.max(0, sheet.width - geometry.widthMm)
      ).toFixed(2)
    ),
    y: Number(
      clamp(
        params.y ?? (sheet.height - geometry.heightMm) / 2,
        0,
        Math.max(0, sheet.height - geometry.heightMm)
      ).toFixed(2)
    ),
    rotation,
    scale: 1
  };
}

export function createAndPlaceStructuredTerminalStrip(params: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  input: CreateStructuredTerminalStripInput;
}): StructuredTerminalStripCommandResult {
  const model = drawingPackageModelSchema.parse(params.model);
  const input = inputSchema.parse(params.input);
  const memberErrors = validateStructuredTerminalStripMembers(
    input.strip,
    params.symbols
  );
  if (memberErrors.length > 0) {
    throw new Error(memberErrors[0]);
  }
  const sheet = model.sheets.find((candidate) => candidate.id === input.sheetId);
  if (!sheet) {
    throw new Error("The active drawing sheet was not found.");
  }
  const assetId = params.input.assetId ?? createDrawingAssetId();
  const placementId = params.input.placementId ?? createId("terminal_strip");
  const tag = allocateNextTagFromPrefix({ model, prefix: "TB" });
  const asset: DrawingAssetRecord & { terminalStrip: StructuredTerminalStrip } = {
    id: assetId,
    tag,
    type: "terminal_block",
    title: input.name,
    description: input.description || undefined,
    engineeringAttributes: input.engineeringAttributes,
    symbolId: structuredTerminalStripSymbolId(assetId),
    versionId: structuredTerminalStripVersionId(assetId),
    metadata: {
      generatedKind: "structured_terminal_strip",
      symbolKey: `structured_terminal_strip_${assetId}`
    },
    terminalStrip: input.strip
  };
  const placement = placementForStructuredStrip({
    model,
    sheet,
    asset,
    symbols: params.symbols,
    placementId,
    backplaneId: input.backplaneId,
    rotation: input.rotation,
    x: input.x,
    y: input.y
  });
  const nextModel = {
    ...model,
    assets: [...model.assets, asset],
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

export function placeStructuredTerminalStripReference(params: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  sheetId: string;
  assetId: string;
  backplaneId?: string;
  x?: number;
  y?: number;
}): StructuredTerminalStripCommandResult {
  const model = drawingPackageModelSchema.parse(params.model);
  const sheet = model.sheets.find((candidate) => candidate.id === params.sheetId);
  const asset = model.assets.find((candidate) => candidate.id === params.assetId);
  if (!sheet) {
    throw new Error("The active drawing sheet was not found.");
  }
  if (!asset?.terminalStrip) {
    throw new Error("Only structured terminal strips can be referenced.");
  }
  const structuredAsset = asset as DrawingAssetRecord & {
    terminalStrip: StructuredTerminalStrip;
  };
  const placement = placementForStructuredStrip({
    model,
    sheet,
    asset: structuredAsset,
    symbols: params.symbols,
    placementId: createId("terminal_strip_reference"),
    backplaneId: params.backplaneId,
    x: params.x,
    y: params.y
  });
  const nextModel = {
    ...model,
    sheets: model.sheets.map((candidate) =>
      candidate.id === sheet.id
        ? { ...candidate, placements: [...candidate.placements, placement] }
        : candidate
    )
  };

  return {
    model: drawingPackageModelSchema.parse(nextModel),
    assetId: asset.id,
    placement
  };
}

export function listStructuredTerminalStripAssets(model: DrawingModel) {
  return model.assets.filter(
    (asset): asset is DrawingAssetRecord & { terminalStrip: StructuredTerminalStrip } =>
      Boolean(asset.terminalStrip)
  );
}

export function listStructuredTerminalStripBackplanes(
  model: DrawingModel,
  sheetId: string
) {
  const sheet = model.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) return [];
  return getBackplanesForSheet({
    sheet: { ...sheet.page, titleBlock: model.titleBlock },
    placements: sheet.placements,
    connections: sheet.connections,
    annotations: sheet.annotations
  }).filter((backplane) => Boolean(backplane.containerAssetId));
}

function terminalRefMatches(
  ref: { assetId: string; terminalKey: string } | undefined,
  assetId: string,
  keys: Set<string>
): boolean {
  return Boolean(ref && ref.assetId === assetId && keys.has(ref.terminalKey));
}

function structuredTerminalKeysInUse(
  model: DrawingModel,
  assetId: string,
  removedTerminalKeys: Set<string>,
  removedAnchorKeys: Set<string>
): boolean {
  const placementIds = new Set(
    model.sheets
      .flatMap((sheet) => sheet.placements)
      .filter((placement) => placement.assetId === assetId)
      .map((placement) => placement.id)
  );
  if (
    model.sheets.some((sheet) =>
      sheet.connections.some(
        (connection) =>
          (placementIds.has(connection.from.placementId) &&
            removedAnchorKeys.has(connection.from.anchorKey)) ||
          (placementIds.has(connection.to.placementId) &&
            removedAnchorKeys.has(connection.to.anchorKey))
      )
    )
  ) {
    return true;
  }
  const wiring = model.panelWiring;
  if (!wiring) return false;
  return Boolean(
    wiring.terminalMappings.some((mapping) =>
      terminalRefMatches(mapping.target, assetId, removedTerminalKeys)
    ) ||
      wiring.internalWires.some(
        (wire) =>
          terminalRefMatches(wire.from, assetId, removedTerminalKeys) ||
          terminalRefMatches(wire.to, assetId, removedTerminalKeys)
      ) ||
      wiring.bridges.some((bridge) =>
        bridge.members.some((member) =>
          terminalRefMatches(member, assetId, removedTerminalKeys)
        )
      ) ||
      wiring.bonds.some(
        (bond) =>
          terminalRefMatches(bond.source, assetId, removedTerminalKeys) ||
          bond.endpoints.some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              terminalRefMatches(endpoint.terminal, assetId, removedTerminalKeys)
          )
      )
  );
}

function assertStructuredStripOccurrenceBounds(params: {
  model: DrawingModel;
  assetId: string;
  widthMm: number;
  heightMm: number;
  symbols: ApprovedDrawingSymbol[];
}) {
  const symbolByVersion = new Map(
    params.symbols.map((symbol) => [
      `${symbol.symbolId}:${symbol.versionId}`,
      symbol
    ])
  );

  for (const sheet of params.model.sheets) {
    for (const placement of sheet.placements) {
      if (placement.assetId !== params.assetId) continue;
      if (placement.layoutParentId) {
        const backplane = sheet.placements.find(
          (candidate) =>
            candidate.id === placement.layoutParentId &&
            isBackplanePlacement(candidate)
        );
        if (!backplane) {
          // Connection-drawing representations use layoutParentId to remain
          // grouped with their schematic panel frame, but they deliberately
          // carry no physical layout geometry. Their shared composition must
          // not be validated as a second physical mount.
          if (
            !placement.layoutKind &&
            !placement.layoutDimensions &&
            !placement.layoutPosition
          ) {
            continue;
          }
          throw new Error("A terminal-strip occurrence has a missing backplane.");
        }
        const position = getLayoutPosition(
          canvasSheet(params.model, sheet),
          placement,
          backplane
        );
        const usable = getBackplanePhysicalUsableBounds(backplane);
        if (
          position.xMm < usable.x ||
          position.yMm < usable.y ||
          position.xMm + params.widthMm > usable.x + usable.width ||
          position.yMm + params.heightMm > usable.y + usable.height
        ) {
          throw new Error(
            `${placement.tag} no longer fits within its backplane after this edit.`
          );
        }
        const nextBounds = {
          x: position.xMm,
          y: position.yMm,
          width: params.widthMm,
          height: params.heightMm
        };
        const collidingPlacement = sheet.placements.find((candidate) => {
          if (
            candidate.id === placement.id ||
            candidate.layoutParentId !== backplane.id ||
            !candidate.assetId ||
            candidate.assetId === params.assetId ||
            !candidate.layoutDimensions
          ) {
            return false;
          }
          const candidateSymbol = symbolByVersion.get(
            `${candidate.symbolId}:${candidate.versionId}`
          );
          // Rails and other non-asset layout infrastructure are intentionally
          // allowed beneath or around equipment. This mirrors the placement
          // scan, which treats only asset-backed siblings as competing
          // equipment. The explicit rail check also covers legacy rails that
          // were stored with an asset identity.
          if (isDinRailSymbol(candidateSymbol)) {
            return false;
          }
          const candidatePosition = getLayoutPosition(
            canvasSheet(params.model, sheet),
            candidate,
            backplane
          );
          const quarterTurns =
            ((Math.round(candidate.rotation / 90) % 4) + 4) % 4;
          const candidateWidth =
            quarterTurns % 2 === 0
              ? candidate.layoutDimensions.lengthMm
              : candidate.layoutDimensions.widthMm;
          const candidateHeight =
            quarterTurns % 2 === 0
              ? candidate.layoutDimensions.widthMm
              : candidate.layoutDimensions.lengthMm;
          return !(
            nextBounds.x + nextBounds.width <= candidatePosition.xMm ||
            candidatePosition.xMm + candidateWidth <= nextBounds.x ||
            nextBounds.y + nextBounds.height <= candidatePosition.yMm ||
            candidatePosition.yMm + candidateHeight <= nextBounds.y
          );
        });
        if (collidingPlacement) {
          const obstacle =
            collidingPlacement.tag.trim() || "nearby backplane equipment";
          throw new Error(
            `${placement.tag} would overlap ${obstacle} after this edit. Move one of the items to create space, then apply the change again.`
          );
        }
      } else if (
        placement.x < 0 ||
        placement.y < 0 ||
        placement.x + params.widthMm > sheet.page.width ||
        placement.y + params.heightMm > sheet.page.height
      ) {
        throw new Error(
          `${placement.tag} no longer fits within its drawing sheet after this edit.`
        );
      }
    }
  }
}

export function updateStructuredTerminalStrip(params: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  assetId: string;
  name: string;
  description?: string;
  strip: StructuredTerminalStrip;
}): DrawingModel {
  const model = drawingPackageModelSchema.parse(params.model);
  const asset = model.assets.find((candidate) => candidate.id === params.assetId);
  if (!asset?.terminalStrip) {
    throw new Error("Structured terminal strip was not found.");
  }
  const nextStrip = structuredTerminalStripSchema.parse(params.strip);
  const memberErrors = validateStructuredTerminalStripMembers(
    nextStrip,
    params.symbols
  );
  if (memberErrors.length > 0) {
    throw new Error(memberErrors[0]);
  }
  const oldProjection = projectStructuredTerminalStripTerminals(
    asset.terminalStrip,
    params.symbols
  );
  const nextProjection = projectStructuredTerminalStripTerminals(
    nextStrip,
    params.symbols
  );
  const nextTerminalKeys = new Set(
    nextProjection.terminals.map((terminal) => terminal.key)
  );
  const nextAnchorKeys = new Set(
    nextProjection.anchors.map((anchor) => anchor.key)
  );
  const removedTerminalKeys = new Set(
    oldProjection.terminals
      .map((terminal) => terminal.key)
      .filter((key) => !nextTerminalKeys.has(key))
  );
  const removedAnchorKeys = new Set(
    oldProjection.anchors
      .map((anchor) => anchor.key)
      .filter((key) => !nextAnchorKeys.has(key))
  );
  const nextTerminalByKey = new Map(
    nextProjection.terminals.map((terminal) => [terminal.key, terminal])
  );
  const incompatibleTerminalKeys = new Set(removedTerminalKeys);
  const incompatibleAnchorKeys = new Set(removedAnchorKeys);
  for (const terminal of oldProjection.terminals) {
    const replacement = nextTerminalByKey.get(terminal.key);
    if (
      replacement &&
      replacement.panelSide !== terminal.panelSide
    ) {
      incompatibleTerminalKeys.add(terminal.key);
      incompatibleAnchorKeys.add(terminal.anchorKey);
    }
  }
  if (
    structuredTerminalKeysInUse(
      model,
      params.assetId,
      incompatibleTerminalKeys,
      incompatibleAnchorKeys
    )
  ) {
    throw new Error(
      "This edit removes or changes the side of a terminal that is already connected or mapped."
    );
  }
  const geometry = composeTerminalStripGeometry(nextStrip, params.symbols);
  assertStructuredStripOccurrenceBounds({
    model,
    assetId: params.assetId,
    widthMm: geometry.widthMm,
    heightMm: geometry.heightMm,
    symbols: params.symbols
  });
  const title = params.name.trim();
  if (!title) throw new Error("Enter a terminal strip name.");

  return drawingPackageModelSchema.parse({
    ...model,
    assets: model.assets.map((candidate) =>
      candidate.id === params.assetId
        ? {
            ...candidate,
            title,
            description: params.description?.trim() || undefined,
            terminalStrip: nextStrip
          }
        : candidate
    ),
    sheets: model.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((placement) => {
        if (placement.assetId !== params.assetId) return placement;
        const nextPlacement = {
          ...placement,
          title,
          layoutDimensions: placement.layoutKind
            ? {
                lengthMm: geometry.widthMm,
                widthMm: geometry.heightMm
              }
            : placement.layoutDimensions
        };
        if (!nextPlacement.layoutParentId) return nextPlacement;
        const backplane = sheet.placements.find(
          (candidate) =>
            candidate.id === nextPlacement.layoutParentId &&
            isBackplanePlacement(candidate)
        );
        if (!backplane) return nextPlacement;
        const display = resolveLayoutHelperDisplayPlacement({
          sheet: canvasSheet(model, sheet),
          placement: nextPlacement,
          backplane,
          parentPanel: getParentPanelForBackplane(sheet.placements, backplane)
        });
        return { ...nextPlacement, x: display.x, y: display.y };
      })
    }))
  });
}
