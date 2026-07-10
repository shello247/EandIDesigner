import { z } from "zod";
import {
  buildCompatiblePanelOptions,
  updateDetailedPanelDrawingContext,
  type PanelConnectivityFinding
} from "@/features/drawing_panel_wiring/api/public";
import {
  drawingAssetRecordSchema,
  drawingPackageModelSchema,
  type DrawingModel
} from "../../data/schema";
import type { ApprovedDrawingSymbol } from "../../types";
import {
  applyPanelWiringMutations,
  createPanelWiringSource
} from "../../api/panel-wiring-contracts";
import {
  assertUniqueAssetTag,
  createDrawingAssetId
} from "../services/drawing-asset-identity";
import {
  addDrawingSheet,
  updateSheetMetadata
} from "./drawing-sheet-commands";

const commonInputSchema = z.object({
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional()
});

export const createDetailedPanelDrawingInputSchema = z.discriminatedUnion(
  "mode",
  [
    commonInputSchema.extend({
      mode: z.literal("reference"),
      panelAssetId: z.string().trim().min(1)
    }),
    commonInputSchema.extend({
      mode: z.literal("create"),
      panelType: z.enum(["panel", "junction_box"]),
      tag: z.string().trim().min(1).max(120),
      title: z.string().trim().min(1).max(160)
    })
  ]
);

export type CreateDetailedPanelDrawingInput = z.infer<
  typeof createDetailedPanelDrawingInputSchema
>;

export type CreateDetailedPanelDrawingResult = {
  model: DrawingModel;
  sheetId: string;
  panelAssetId: string;
  warnings: PanelConnectivityFinding[];
};

function defaultSheetName(tag: string): string {
  return `${tag} Detailed Panel Drawing`.slice(0, 120);
}

function defaultDescription(tag: string): string {
  return `Detailed electrical connectivity for ${tag}`.slice(0, 400);
}

export function createDetailedPanelDrawingSheet(
  inputModel: DrawingModel,
  input: CreateDetailedPanelDrawingInput,
  symbols: ApprovedDrawingSymbol[] = []
): CreateDetailedPanelDrawingResult {
  const parsed = createDetailedPanelDrawingInputSchema.parse(input);
  let model = drawingPackageModelSchema.parse(inputModel);
  let panelAssetId: string;
  let panelTag: string;

  if (parsed.mode === "reference") {
    const option = buildCompatiblePanelOptions(
      createPanelWiringSource(model, symbols)
    ).find((candidate) => candidate.assetId === parsed.panelAssetId);

    if (!option) {
      throw new Error("The selected asset is not a compatible panel or enclosure.");
    }

    panelAssetId = option.assetId;
    panelTag = option.tag;
  } else {
    assertUniqueAssetTag(model, parsed.tag);
    const asset = drawingAssetRecordSchema.parse({
      id: createDrawingAssetId(),
      tag: parsed.tag,
      type: parsed.panelType,
      title: parsed.title
    });

    panelAssetId = asset.id;
    panelTag = asset.tag;
    model = {
      ...model,
      assets: [...model.assets, asset]
    };
  }

  const added = addDrawingSheet(
    model,
    parsed.name || defaultSheetName(panelTag)
  );
  model = updateSheetMetadata(added.model, added.sheetId, {
    description: parsed.description || defaultDescription(panelTag)
  });
  const contextResult = updateDetailedPanelDrawingContext(
    createPanelWiringSource(model, symbols),
    { sheetId: added.sheetId, panelAssetId }
  );
  const blocking = contextResult.warnings.find(
    (warning) => warning.severity === "error"
  );

  if (blocking) {
    throw new Error(blocking.message);
  }

  model = applyPanelWiringMutations(model, contextResult.mutations);

  return {
    model: drawingPackageModelSchema.parse(model),
    sheetId: added.sheetId,
    panelAssetId,
    warnings: contextResult.warnings
  };
}
