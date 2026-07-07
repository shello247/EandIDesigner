import { z } from "zod";
import {
  drawingAnnotationSchema,
  drawingConnectionSchema,
  drawingPackageModelSchema,
  drawingPlacementSchema,
  drawingSheetPageSchema
} from "@/features/drawing_canvas/api/template-contracts";

export const drawingSheetTemplateStatusSchema = z.enum(["active", "archived"]);
export const templateAssetResolutionModeSchema = z.enum(["create", "reference"]);

export const drawingSheetTemplateAssetSchema = z.object({
  templateAssetId: z.string().trim().min(1),
  originalAssetId: z.string().trim().min(1).optional(),
  originalTag: z.string().trim().min(1).max(120),
  role: z.enum([
    "device",
    "cable_assembly",
    "terminal_block",
    "enclosure",
    "other"
  ]),
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  symbolKey: z.string().trim().min(1).optional(),
  symbolName: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  defaultResolutionMode: templateAssetResolutionModeSchema
});

export const drawingSheetTemplatePlacementSchema = drawingPlacementSchema
  .omit({ assetId: true })
  .extend({
    templateAssetId: z.string().trim().min(1)
  });

export const drawingSheetTemplateMetadataSchema = z.object({
  summary: z.string().trim().max(400).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).default([]),
  requiredSymbols: z
    .array(
      z.object({
        symbolId: z.string().trim().min(1),
        versionId: z.string().trim().min(1),
        symbolKey: z.string().trim().min(1).optional(),
        displayName: z.string().trim().min(1).optional()
      })
    )
    .default([]),
  assetCount: z.number().int().nonnegative().default(0),
  source: z
    .object({
      drawingId: z.string().trim().min(1).optional(),
      sheetId: z.string().trim().min(1).optional(),
      sheetName: z.string().trim().min(1).optional()
    })
    .optional()
});

export const drawingSheetTemplateModelSchema = z.object({
  version: z.literal(1),
  sheet: z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).optional(),
    page: drawingSheetPageSchema,
    placements: z.array(drawingSheetTemplatePlacementSchema),
    connections: z.array(drawingConnectionSchema),
    annotations: z.array(drawingAnnotationSchema)
  }),
  assets: z.array(drawingSheetTemplateAssetSchema),
  metadata: drawingSheetTemplateMetadataSchema
});

export const saveSheetTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).default([]),
  sourceDrawingId: z.string().trim().min(1).optional(),
  sourceSheetId: z.string().trim().min(1),
  sheetId: z.string().trim().min(1),
  model: drawingPackageModelSchema
});

export type DrawingSheetTemplateStatus = z.infer<
  typeof drawingSheetTemplateStatusSchema
>;
export type TemplateAssetResolutionMode = z.infer<
  typeof templateAssetResolutionModeSchema
>;
export type DrawingSheetTemplateAsset = z.infer<
  typeof drawingSheetTemplateAssetSchema
>;
export type DrawingSheetTemplatePlacement = z.infer<
  typeof drawingSheetTemplatePlacementSchema
>;
export type DrawingSheetTemplateMetadata = z.infer<
  typeof drawingSheetTemplateMetadataSchema
>;
export type DrawingSheetTemplateModel = z.infer<
  typeof drawingSheetTemplateModelSchema
>;
export type SaveSheetTemplateInput = z.infer<typeof saveSheetTemplateInputSchema>;

export function parseDrawingSheetTemplateModelJson(
  modelJson: string
): DrawingSheetTemplateModel {
  return drawingSheetTemplateModelSchema.parse(JSON.parse(modelJson));
}

export function stringifyDrawingSheetTemplateModel(
  model: DrawingSheetTemplateModel
): string {
  return JSON.stringify(drawingSheetTemplateModelSchema.parse(model), null, 2);
}

export function parseDrawingSheetTemplateMetadataJson(
  metadataJson: string
): DrawingSheetTemplateMetadata {
  return drawingSheetTemplateMetadataSchema.parse(JSON.parse(metadataJson));
}
