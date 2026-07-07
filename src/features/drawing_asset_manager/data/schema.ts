import { z } from "zod";
import { drawingAssetTypeSchema } from "@/features/drawing_canvas/api/asset-contracts";

export const managedAssetCreateInputSchema = z.object({
  type: drawingAssetTypeSchema,
  tag: z.string().trim().max(120).optional(),
  title: z.string().trim().max(160).optional(),
  symbolId: z.string().trim().min(1).optional(),
  versionId: z.string().trim().min(1).optional()
});

export const managedAssetUpdateInputSchema = z.object({
  type: drawingAssetTypeSchema.optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  symbolId: z.string().trim().min(1).optional(),
  versionId: z.string().trim().min(1).optional()
});

export type ManagedAssetCreateInput = z.infer<
  typeof managedAssetCreateInputSchema
>;
export type ManagedAssetUpdateInput = z.infer<
  typeof managedAssetUpdateInputSchema
>;
