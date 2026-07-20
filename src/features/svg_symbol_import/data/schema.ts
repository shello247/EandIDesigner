import { z } from "zod";
import {
  networkDeviceTypeSchema,
  networkPortMediaSchema,
  symbolAnchorSchema,
  symbolCategorySchema,
  symbolMetadataSchema,
  symbolTerminalSchema
} from "@/features/symbol_registry/data/schema";

export const svgImportSourceAssetSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.literal("image/svg+xml"),
  sizeBytes: z.number().int().positive(),
  dataUrl: z.string().trim().optional()
});

export const svgImportMetadataFormSchema = z.object({
  symbolKey: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(),
  category: symbolCategorySchema
});

export const svgImportNetworkPortDraftSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  anchorKey: z.string().trim().min(1).max(80),
  media: z.union([networkPortMediaSchema, z.literal("")]),
  speedMbps: z.string().trim().max(20),
  protocolHints: z.string().trim().max(2000)
});

export const svgImportNetworkProfileDraftSchema = z.object({
  deviceType: z.union([networkDeviceTypeSchema, z.literal("")]),
  managed: z.boolean().optional(),
  ports: z.array(svgImportNetworkPortDraftSchema)
});

export const svgSymbolImportDraftSchema = z.object({
  svg: z.string().trim().min(1),
  sourceAsset: svgImportSourceAssetSchema,
  metadata: symbolMetadataSchema
});

export const svgImportAnchorDraftSchema = symbolAnchorSchema;
export const svgImportTerminalDraftSchema = symbolTerminalSchema;

export type SvgImportMetadataForm = z.infer<
  typeof svgImportMetadataFormSchema
>;
export type SvgSymbolImportDraftInput = z.infer<
  typeof svgSymbolImportDraftSchema
>;
export type SvgImportNetworkPortDraft = z.infer<
  typeof svgImportNetworkPortDraftSchema
>;
export type SvgImportNetworkProfileDraft = z.infer<
  typeof svgImportNetworkProfileDraftSchema
>;
