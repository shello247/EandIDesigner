import { z } from "zod";
import {
  cloneStructuredTerminalStrip,
  composeTerminalStripGeometry,
  validateStructuredTerminalStripMembers
} from "@/features/drawing_terminal_blocks/api/public";
import { cloneEngineeringAttributesForNewAsset } from "@/features/engineering_attributes/api/public";
import {
  drawingPackageModelSchema,
  type DrawingModel,
  type DrawingPackageSheet,
  type DrawingPlacement
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  getBackplanesForSheet,
  isBackplanePlacement
} from "../services/drawing-backplane-layouts";
import {
  getBackplanePhysicalUsableBounds,
  getLayoutPosition,
  getParentPanelForBackplane,
  resolveLayoutHelperDisplayPlacement
} from "../services/drawing-backplane-scale";
import {
  createAndPlaceStructuredTerminalStrip,
  placeStructuredTerminalStripReference
} from "./drawing-structured-terminal-strip-commands";
import {
  structuredTerminalStripSymbolId,
  structuredTerminalStripVersionId
} from "../services/drawing-generated-symbols";

export const structuredTerminalStripReuseModeSchema = z.enum([
  "copy_as_new",
  "place_representation"
]);

const structuredTerminalStripReuseInputSchema = z.object({
  mode: structuredTerminalStripReuseModeSchema,
  sourceSheetId: z.string().trim().min(1),
  sourcePlacementId: z.string().trim().min(1),
  targetSheetId: z.string().trim().min(1),
  targetBackplaneId: z.string().trim().min(1).optional()
});

export type StructuredTerminalStripReuseMode = z.infer<
  typeof structuredTerminalStripReuseModeSchema
>;

export type StructuredTerminalStripReuseInput = z.infer<
  typeof structuredTerminalStripReuseInputSchema
>;

export type StructuredTerminalStripReuseResult = {
  model: DrawingModel;
  assetId: string;
  placement: DrawingPlacement;
  createdNewAsset: boolean;
};

export type StructuredTerminalStripReuseBackplaneOption = {
  id: string;
  label: string;
  panelAssetId?: string;
  canPlaceRepresentation: boolean;
  unavailableReason?: string;
};

export type StructuredTerminalStripReuseSheetOption = {
  id: string;
  name: string;
  number: number;
  alreadyRepresented: boolean;
  backplanes: StructuredTerminalStripReuseBackplaneOption[];
};

export type StructuredTerminalStripReuseDestinations = {
  sourceAssetId: string;
  sourceMountPanelAssetId?: string;
  sourceMountAmbiguous: boolean;
  sheets: StructuredTerminalStripReuseSheetOption[];
};

export type StructuredTerminalStripCopySourceOption = {
  assetId: string;
  sourceSheetId: string;
  sourcePlacementId: string;
  tag: string;
  name: string;
  sourceMount?: string;
  sourceSheet: string;
  memberCount: number;
  terminalCount: number;
  widthMm: number;
  heightMm: number;
};

type ResolvedSource = {
  sheet: DrawingPackageSheet;
  placement: DrawingPlacement;
  asset: DrawingModel["assets"][number] & {
    terminalStrip: NonNullable<DrawingModel["assets"][number]["terminalStrip"]>;
  };
  backplane?: DrawingPlacement;
};

function canvasSheet(model: DrawingModel, sheet: DrawingPackageSheet) {
  return { ...sheet.page, titleBlock: model.titleBlock };
}

function resolveSource(
  model: DrawingModel,
  sourceSheetId: string,
  sourcePlacementId: string
): ResolvedSource {
  const sheet = model.sheets.find((candidate) => candidate.id === sourceSheetId);
  const placement = sheet?.placements.find(
    (candidate) => candidate.id === sourcePlacementId
  );
  const asset = placement?.assetId
    ? model.assets.find((candidate) => candidate.id === placement.assetId)
    : undefined;

  if (!sheet || !placement || !asset?.terminalStrip) {
    throw new Error("The source terminal strip is no longer available.");
  }

  const backplane = placement.layoutParentId
    ? sheet.placements.find(
        (candidate) =>
          candidate.id === placement.layoutParentId &&
          isBackplanePlacement(candidate)
      )
    : undefined;

  return {
    sheet,
    placement,
    asset: asset as ResolvedSource["asset"],
    backplane
  };
}

function panelLabel(model: DrawingModel, panelAssetId: string | undefined) {
  if (!panelAssetId) return "Unassigned panel";
  const panel = model.assets.find((asset) => asset.id === panelAssetId);
  return panel ? `${panel.tag} Backplane` : "Panel backplane";
}

function sourceMountContexts(model: DrawingModel, assetId: string): Set<string> {
  const contexts = new Set<string>();
  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      if (
        placement.assetId === assetId &&
        placement.layoutParentId &&
        placement.containerAssetId
      ) {
        contexts.add(placement.containerAssetId);
      }
    }
  }
  return contexts;
}

export function listStructuredTerminalStripCopySources(params: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
}): StructuredTerminalStripCopySourceOption[] {
  const model = drawingPackageModelSchema.parse(params.model);
  const occurrencesByAssetId = new Map<
    string,
    Array<{
      sheet: DrawingPackageSheet;
      sheetIndex: number;
      placement: DrawingPlacement;
      placementIndex: number;
    }>
  >();

  model.sheets.forEach((sheet, sheetIndex) => {
    if (sheet.kind === "section_title") return;
    sheet.placements.forEach((placement, placementIndex) => {
      if (!placement.assetId) return;
      const occurrences = occurrencesByAssetId.get(placement.assetId) ?? [];
      occurrences.push({ sheet, sheetIndex, placement, placementIndex });
      occurrencesByAssetId.set(placement.assetId, occurrences);
    });
  });

  return model.assets
    .flatMap((asset): StructuredTerminalStripCopySourceOption[] => {
      if (!asset.terminalStrip) return [];
      if (
        validateStructuredTerminalStripMembers(
          asset.terminalStrip,
          params.symbols
        ).length > 0
      ) {
        return [];
      }

      const expectedSymbolId = structuredTerminalStripSymbolId(asset.id);
      const expectedVersionId = structuredTerminalStripVersionId(asset.id);
      const occurrences = (occurrencesByAssetId.get(asset.id) ?? [])
        .filter(({ placement }) => {
          const mounted = Boolean(
            placement.layoutParentId && placement.containerAssetId
          );
          const unmounted = Boolean(
            !placement.layoutParentId && !placement.containerAssetId
          );
          return (
            (mounted || unmounted) &&
            placement.symbolId === expectedSymbolId &&
            placement.versionId === expectedVersionId
          );
        })
        .sort((first, second) => {
          const firstMounted = Boolean(
            first.placement.layoutParentId && first.placement.containerAssetId
          );
          const secondMounted = Boolean(
            second.placement.layoutParentId && second.placement.containerAssetId
          );
          if (firstMounted !== secondMounted) return firstMounted ? -1 : 1;
          return (
            first.sheetIndex - second.sheetIndex ||
            first.placementIndex - second.placementIndex
          );
        });
      const source = occurrences[0];
      if (!source) return [];

      const geometry = composeTerminalStripGeometry(
        asset.terminalStrip,
        params.symbols
      );
      if (geometry.missingMemberTokens.length > 0) return [];

      const panel = source.placement.containerAssetId
        ? model.assets.find(
            (candidate) => candidate.id === source.placement.containerAssetId
          )
        : undefined;
      if (source.placement.containerAssetId && !panel) return [];

      return [
        {
          assetId: asset.id,
          sourceSheetId: source.sheet.id,
          sourcePlacementId: source.placement.id,
          tag: asset.tag,
          name: asset.title,
          sourceMount: panel ? `${panel.tag} Backplane` : undefined,
          sourceSheet: source.sheet.name,
          memberCount: asset.terminalStrip.members.length,
          terminalCount: geometry.members.reduce(
            (count, member) =>
              count + (member.symbol?.metadata.terminals?.length ?? 0),
            0
          ),
          widthMm: geometry.widthMm,
          heightMm: geometry.heightMm
        }
      ];
    })
    .sort((first, second) =>
      first.tag.localeCompare(second.tag, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
}

export function listStructuredTerminalStripReuseDestinations(params: {
  model: DrawingModel;
  sourceSheetId: string;
  sourcePlacementId: string;
}): StructuredTerminalStripReuseDestinations {
  const model = drawingPackageModelSchema.parse(params.model);
  const source = resolveSource(
    model,
    params.sourceSheetId,
    params.sourcePlacementId
  );
  const mountContexts = sourceMountContexts(model, source.asset.id);
  const sourceMountPanelAssetId =
    mountContexts.size === 1 ? [...mountContexts][0] : undefined;
  const sourceMountAmbiguous = mountContexts.size > 1;

  return {
    sourceAssetId: source.asset.id,
    sourceMountPanelAssetId,
    sourceMountAmbiguous,
    sheets: model.sheets.flatMap((sheet, index) => {
        if (sheet.kind === "section_title") return [];
        const alreadyRepresented = sheet.placements.some(
          (placement) => placement.assetId === source.asset.id
        );
        const backplanes = getBackplanesForSheet({
          sheet: canvasSheet(model, sheet),
          placements: sheet.placements,
          connections: sheet.connections,
          annotations: sheet.annotations
        });
        const countsByPanel = new Map<string, number>();
        for (const backplane of backplanes) {
          if (!backplane.containerAssetId) continue;
          countsByPanel.set(
            backplane.containerAssetId,
            (countsByPanel.get(backplane.containerAssetId) ?? 0) + 1
          );
        }

        return [{
          id: sheet.id,
          name: sheet.name,
          number: index + 1,
          alreadyRepresented,
          backplanes: backplanes.map((backplane) => {
            const sameMount = Boolean(
              sourceMountPanelAssetId &&
                backplane.containerAssetId === sourceMountPanelAssetId
            );
            const unambiguousTarget = Boolean(
              backplane.containerAssetId &&
                countsByPanel.get(backplane.containerAssetId) === 1
            );
            const canPlaceRepresentation =
              !alreadyRepresented &&
              !sourceMountAmbiguous &&
              sameMount &&
              unambiguousTarget;
            let unavailableReason: string | undefined;
            if (alreadyRepresented) {
              unavailableReason = "This strip is already represented on the sheet.";
            } else if (sourceMountAmbiguous || !unambiguousTarget) {
              unavailableReason = "The physical backplane cannot be resolved unambiguously.";
            } else if (!sameMount) {
              unavailableReason =
                "A different physical backplane requires Copy as new terminal strip.";
            }

            return {
              id: backplane.id,
              label: panelLabel(model, backplane.containerAssetId),
              panelAssetId: backplane.containerAssetId,
              canPlaceRepresentation,
              unavailableReason
            };
          })
        } satisfies StructuredTerminalStripReuseSheetOption];
      })
  };
}

function rotatedPhysicalSize(
  placement: DrawingPlacement,
  widthMm: number,
  heightMm: number
) {
  const quarterTurns = ((Math.round(placement.rotation / 90) % 4) + 4) % 4;
  return quarterTurns % 2 === 0
    ? { width: widthMm, height: heightMm }
    : { width: heightMm, height: widthMm };
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function assertPreferredMountedPosition(params: {
  model: DrawingModel;
  sheet: DrawingPackageSheet;
  backplane: DrawingPlacement;
  sourcePlacement: DrawingPlacement;
  position: NonNullable<DrawingPlacement["layoutPosition"]>;
  widthMm: number;
  heightMm: number;
}) {
  const size = rotatedPhysicalSize(
    params.sourcePlacement,
    params.widthMm,
    params.heightMm
  );
  const usable = getBackplanePhysicalUsableBounds(params.backplane);
  const proposed = {
    x: params.position.xMm,
    y: params.position.yMm,
    width: size.width,
    height: size.height
  };
  if (
    proposed.x < usable.x ||
    proposed.y < usable.y ||
    proposed.x + proposed.width > usable.x + usable.width ||
    proposed.y + proposed.height > usable.y + usable.height
  ) {
    throw new Error("The source position does not fit on the destination backplane.");
  }

  const collision = params.sheet.placements.some((candidate) => {
    if (
      candidate.layoutParentId !== params.backplane.id ||
      !candidate.layoutDimensions
    ) {
      return false;
    }
    const position = getLayoutPosition(
      canvasSheet(params.model, params.sheet),
      candidate,
      params.backplane
    );
    const candidateSize = rotatedPhysicalSize(
      candidate,
      candidate.layoutDimensions.lengthMm,
      candidate.layoutDimensions.widthMm
    );
    return rectanglesOverlap(proposed, {
      x: position.xMm,
      y: position.yMm,
      width: candidateSize.width,
      height: candidateSize.height
    });
  });
  if (collision) {
    throw new Error("The source position overlaps equipment on the destination backplane.");
  }
}

function withSourceAppearance(params: {
  model: DrawingModel;
  targetSheetId: string;
  placementId: string;
  source: DrawingPlacement;
  targetBackplane?: DrawingPlacement;
  layoutPosition?: NonNullable<DrawingPlacement["layoutPosition"]>;
}): { model: DrawingModel; placement: DrawingPlacement } {
  const targetSheet = params.model.sheets.find(
    (sheet) => sheet.id === params.targetSheetId
  );
  const created = targetSheet?.placements.find(
    (placement) => placement.id === params.placementId
  );
  if (!targetSheet || !created) {
    throw new Error("The new terminal strip occurrence could not be resolved.");
  }
  const deltaX = created.x - params.source.x;
  const deltaY = created.y - params.source.y;
  let placement: DrawingPlacement = {
    ...created,
    rotation: params.source.rotation,
    scale: params.source.scale,
    layoutLabel: params.source.layoutLabel
      ? { ...params.source.layoutLabel }
      : created.layoutLabel,
    labelPosition: params.source.labelPosition
      ? {
          x: Number((params.source.labelPosition.x + deltaX).toFixed(2)),
          y: Number((params.source.labelPosition.y + deltaY).toFixed(2))
        }
      : undefined,
    deviceTitlePosition: params.source.deviceTitlePosition
      ? {
          x: Number((params.source.deviceTitlePosition.x + deltaX).toFixed(2)),
          y: Number((params.source.deviceTitlePosition.y + deltaY).toFixed(2))
        }
      : undefined,
    layoutPosition: params.layoutPosition ?? created.layoutPosition
  };

  if (params.targetBackplane && params.layoutPosition) {
    placement = resolveLayoutHelperDisplayPlacement({
      sheet: canvasSheet(params.model, targetSheet),
      placement,
      backplane: params.targetBackplane,
      parentPanel: getParentPanelForBackplane(
        targetSheet.placements,
        params.targetBackplane
      )
    });
  }

  const model = drawingPackageModelSchema.parse({
    ...params.model,
    sheets: params.model.sheets.map((sheet) =>
      sheet.id === targetSheet.id
        ? {
            ...sheet,
            placements: sheet.placements.map((candidate) =>
              candidate.id === placement.id ? placement : candidate
            )
          }
        : sheet
    )
  });
  return { model, placement };
}

export function reuseStructuredTerminalStrip(params: {
  model: DrawingModel;
  symbols: ApprovedDrawingSymbol[];
  input: StructuredTerminalStripReuseInput;
}): StructuredTerminalStripReuseResult {
  const model = drawingPackageModelSchema.parse(params.model);
  const input = structuredTerminalStripReuseInputSchema.parse(params.input);
  const source = resolveSource(model, input.sourceSheetId, input.sourcePlacementId);
  const targetSheet = model.sheets.find((sheet) => sheet.id === input.targetSheetId);
  if (!targetSheet || targetSheet.kind === "section_title") {
    throw new Error("Choose a drawing sheet for the terminal strip.");
  }
  const targetBackplane = input.targetBackplaneId
    ? targetSheet.placements.find(
        (placement) =>
          placement.id === input.targetBackplaneId &&
          isBackplanePlacement(placement)
      )
    : undefined;
  if (input.targetBackplaneId && !targetBackplane) {
    throw new Error("The selected destination backplane is no longer available.");
  }

  if (input.mode === "copy_as_new") {
    const copied = createAndPlaceStructuredTerminalStrip({
      model,
      symbols: params.symbols,
      input: {
        sheetId: targetSheet.id,
        backplaneId: targetBackplane?.id,
        name: source.asset.title,
        description: source.asset.description,
        engineeringAttributes: cloneEngineeringAttributesForNewAsset({
          container: source.asset.engineeringAttributes,
          assetType: source.asset.type
        }),
        strip: cloneStructuredTerminalStrip(source.asset.terminalStrip),
        rotation: source.placement.rotation
      }
    });
    const appearance = withSourceAppearance({
      model: copied.model,
      targetSheetId: targetSheet.id,
      placementId: copied.placement.id,
      source: source.placement,
      targetBackplane
    });
    return {
      model: appearance.model,
      assetId: copied.assetId,
      placement: appearance.placement,
      createdNewAsset: true
    };
  }

  if (
    targetSheet.placements.some(
      (placement) => placement.assetId === source.asset.id
    )
  ) {
    throw new Error("This terminal strip is already represented on the target sheet.");
  }

  let sourceLayoutPosition: DrawingPlacement["layoutPosition"];
  if (targetBackplane) {
    if (!source.backplane || !source.placement.containerAssetId) {
      throw new Error(
        "An unmounted source can only be placed as an unmounted representation."
      );
    }
    const destinations = listStructuredTerminalStripReuseDestinations({
      model,
      sourceSheetId: input.sourceSheetId,
      sourcePlacementId: input.sourcePlacementId
    });
    const selected = destinations.sheets
      .find((sheet) => sheet.id === targetSheet.id)
      ?.backplanes.find((backplane) => backplane.id === targetBackplane.id);
    if (!selected?.canPlaceRepresentation) {
      throw new Error(
        selected?.unavailableReason ??
          "This backplane cannot represent the same physical terminal strip."
      );
    }
    sourceLayoutPosition = getLayoutPosition(
      canvasSheet(model, source.sheet),
      source.placement,
      source.backplane
    );
    const geometry = composeTerminalStripGeometry(
      source.asset.terminalStrip,
      params.symbols
    );
    assertPreferredMountedPosition({
      model,
      sheet: targetSheet,
      backplane: targetBackplane,
      sourcePlacement: source.placement,
      position: sourceLayoutPosition,
      widthMm: geometry.widthMm,
      heightMm: geometry.heightMm
    });
  }

  const referenced = placeStructuredTerminalStripReference({
    model,
    symbols: params.symbols,
    sheetId: targetSheet.id,
    assetId: source.asset.id,
    backplaneId: targetBackplane?.id
  });
  const appearance = withSourceAppearance({
    model: referenced.model,
    targetSheetId: targetSheet.id,
    placementId: referenced.placement.id,
    source: source.placement,
    targetBackplane,
    layoutPosition: sourceLayoutPosition
  });
  return {
    model: appearance.model,
    assetId: source.asset.id,
    placement: appearance.placement,
    createdNewAsset: false
  };
}
