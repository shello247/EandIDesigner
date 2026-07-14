import { z } from "zod";
import {
  MAX_BOM_ITEM_IMAGE_BYTES,
  validateBomItemImageBudget
} from "../logic/services/bom-item-image-budget";

export {
  MAX_BOM_ITEM_IMAGE_BYTES,
  MAX_BOM_ITEM_IMAGES,
  MAX_BOM_ITEM_TOTAL_IMAGE_BYTES
} from "../logic/services/bom-item-image-budget";

export const bomItemStatusSchema = z.enum(["active", "archived"]);

export const bomItemDeleteResultSchema = z.object({
  id: z.string().trim().min(1),
  mode: z.enum(["deleted", "archived"])
});

export const bomQuantityRuleSchema = z.enum([
  "fixed_per_assembly",
  "per_cable_end",
  "per_conductor_termination",
  "per_connection",
  "manual"
]);

export const bomQuantityStatusSchema = z.enum([
  "calculated",
  "manual_required",
  "unavailable"
]);

export const generatedBomWarningCodeSchema = z.enum([
  "missing_template",
  "missing_item",
  "archived_item",
  "manual_quantity_required",
  "generated_symbol",
  "missing_symbol"
]);

const optionalTextSchema = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    z.string().trim().max(maxLength).optional()
  );

const optionalNumberSchema = (maxValue: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    z.coerce.number().nonnegative().max(maxValue).optional()
  );

const optionalIntegerSchema = (maxValue: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    z.coerce.number().int().nonnegative().max(maxValue).optional()
  );

export const bomItemImageInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120).refine(
    (value) => value.startsWith("image/"),
    "BOM item images must be image files."
  ),
  sizeBytes: z.number().int().positive().max(MAX_BOM_ITEM_IMAGE_BYTES),
  dataUrl: z.string().trim().min(1).refine(
    (value) => value.startsWith("data:image/"),
    "BOM item image data must be an image data URL."
  ),
  caption: optionalTextSchema(240),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0)
});

export const bomItemImagesInputSchema = z
  .array(bomItemImageInputSchema)
  .superRefine((images, context) => {
    const budget = validateBomItemImageBudget(images);
    const primaryCount = images.filter((image) => image.isPrimary).length;

    for (const violation of budget.violations) {
      context.addIssue({
        code: "custom",
        message: violation.message,
        path:
          violation.imageIndex === undefined ? [] : [violation.imageIndex]
      });
    }

    if (primaryCount > 1) {
      context.addIssue({
        code: "custom",
        message: "Only one BOM item image can be primary."
      });
    }
  });

export const bomItemWritableFieldsSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200),
    description: optionalTextSchema(600),
    category: z.string().trim().min(1).max(80),
    unit: z.string().trim().min(1).max(40),
    manufacturer: optionalTextSchema(160),
    partNumber: optionalTextSchema(160),
    model: optionalTextSchema(160),
    notes: optionalTextSchema(1000),
    supplierName: optionalTextSchema(200),
    supplierContactName: optionalTextSchema(160),
    supplierEmail: optionalTextSchema(200),
    supplierPhone: optionalTextSchema(80),
    supplierWebsite: optionalTextSchema(240),
    supplierSku: optionalTextSchema(160),
    unitCost: optionalNumberSchema(1_000_000_000),
    currency: optionalTextSchema(12),
    leadTimeDays: optionalIntegerSchema(10_000),
    minimumOrderQuantity: optionalNumberSchema(1_000_000_000),
    costNotes: optionalTextSchema(1000),
    images: bomItemImagesInputSchema.default([])
  })
  .strict();

export const bomItemInputSchema = bomItemWritableFieldsSchema;

export const bomItemOptionInputSchema = z.object({
  name: z.string().trim().min(1).max(160)
});

export const bomItemOptionSchema = z.object({
  value: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160)
});

export const bomItemFormOptionsSchema = z.object({
  categories: z.array(bomItemOptionSchema),
  manufacturers: z.array(bomItemOptionSchema)
});

export const bomItemUpdateInputSchema = bomItemInputSchema
  .partial()
  .extend({
    id: z.string().trim().min(1),
    status: bomItemStatusSchema.optional()
  })
  .strict();

export const bomTemplateLineInputSchema = z.object({
  itemId: z.string().trim().min(1),
  quantityRule: bomQuantityRuleSchema,
  quantity: z.coerce.number().positive().max(1_000_000).default(1),
  notes: optionalTextSchema(500)
});

export const saveSymbolBomTemplateInputSchema = z.object({
  symbolId: z.string().trim().min(1),
  notes: optionalTextSchema(1000),
  lines: z.array(bomTemplateLineInputSchema).max(200)
});

export const bomItemSummarySchema = bomItemWritableFieldsSchema.extend({
  id: z.string().trim().min(1),
  itemKey: z.string().trim().min(1).max(80),
  status: bomItemStatusSchema,
  primaryImage: bomItemImageInputSchema.optional(),
  templateLineCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});

export const bomItemImageSummarySchema = bomItemImageInputSchema.extend({
  id: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});

export const bomItemUsageSchema = z.object({
  symbolId: z.string().trim().min(1),
  symbolKey: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  lineId: z.string().trim().min(1),
  quantityRule: bomQuantityRuleSchema,
  quantity: z.number().positive()
});

export const bomItemDetailSchema = bomItemSummarySchema.extend({
  images: z.array(bomItemImageSummarySchema),
  usage: z.array(bomItemUsageSchema)
});

export const symbolBomTemplateLineDetailSchema = z.object({
  id: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  lineNumber: z.number().int().positive(),
  quantityRule: bomQuantityRuleSchema,
  quantity: z.number().positive(),
  notes: optionalTextSchema(500),
  item: bomItemSummarySchema
});

export const symbolBomTemplateDetailSchema = z.object({
  id: z.string().trim().min(1),
  symbolId: z.string().trim().min(1),
  notes: optionalTextSchema(1000),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  lines: z.array(symbolBomTemplateLineDetailSchema)
});

export const bomAssemblyQuantityFactsSchema = z.object({
  cableEndCount: z.number().int().nonnegative(),
  conductorTerminationCount: z.number().int().nonnegative(),
  connectionCount: z.number().int().nonnegative()
});

export const bomAssemblyProjectionSchema = z.object({
  assetId: z.string().trim().min(1),
  assetTag: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  symbolId: z.string().trim().min(1).optional(),
  versionId: z.string().trim().min(1).optional(),
  sheetRefs: z.array(
    z.object({
      sheetId: z.string().trim().min(1),
      sheetName: z.string().trim().min(1),
      sheetNumber: z.number().int().positive()
    })
  ),
  quantityFacts: bomAssemblyQuantityFactsSchema
});

export const generatedBomWarningSchema = z.object({
  code: generatedBomWarningCodeSchema,
  message: z.string().trim().min(1),
  assetId: z.string().trim().min(1).optional(),
  itemId: z.string().trim().min(1).optional()
});

export const generatedBomLineSchema = z.object({
  id: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  itemKey: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  manufacturer: z.string().trim().optional(),
  partNumber: z.string().trim().optional(),
  quantity: z.number().nonnegative().optional(),
  quantityRule: bomQuantityRuleSchema,
  quantityStatus: bomQuantityStatusSchema,
  sourceLineId: z.string().trim().min(1),
  sourceAssetId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional()
});

export const generatedBomAssemblySchema = z.object({
  assetId: z.string().trim().min(1),
  assetTag: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  symbolId: z.string().trim().min(1).optional(),
  symbolName: z.string().trim().optional(),
  sheetRefs: z.array(
    z.object({
      sheetId: z.string().trim().min(1),
      sheetName: z.string().trim().min(1),
      sheetNumber: z.number().int().positive()
    })
  ),
  lines: z.array(generatedBomLineSchema),
  warnings: z.array(generatedBomWarningSchema)
});

export const consolidatedBomLineSchema = generatedBomLineSchema.extend({
  sourceAssetTags: z.array(z.string().trim().min(1))
});

export const generatedDrawingBomSchema = z.object({
  drawingId: z.string().trim().min(1),
  drawingTitle: z.string().trim().min(1),
  assemblies: z.array(generatedBomAssemblySchema),
  consolidatedLines: z.array(consolidatedBomLineSchema),
  warnings: z.array(generatedBomWarningSchema)
});

export type BomItemStatus = z.infer<typeof bomItemStatusSchema>;
export type BomQuantityRule = z.infer<typeof bomQuantityRuleSchema>;
export type BomQuantityStatus = z.infer<typeof bomQuantityStatusSchema>;
export type GeneratedBomWarningCode = z.infer<
  typeof generatedBomWarningCodeSchema
>;
export type BomItemInput = z.infer<typeof bomItemInputSchema>;
export type BomItemUpdateInput = z.infer<typeof bomItemUpdateInputSchema>;
export type BomItemDeleteResult = z.infer<typeof bomItemDeleteResultSchema>;
export type BomItemOptionInput = z.infer<typeof bomItemOptionInputSchema>;
export type BomItemOption = z.infer<typeof bomItemOptionSchema>;
export type BomItemFormOptions = z.infer<typeof bomItemFormOptionsSchema>;
export type BomItemImageInput = z.infer<typeof bomItemImageInputSchema>;
export type BomItemImageSummary = z.infer<typeof bomItemImageSummarySchema>;
export type BomItemUsage = z.infer<typeof bomItemUsageSchema>;
export type BomItemDetail = z.infer<typeof bomItemDetailSchema>;
export type BomTemplateLineInput = z.infer<typeof bomTemplateLineInputSchema>;
export type SaveSymbolBomTemplateInput = z.infer<
  typeof saveSymbolBomTemplateInputSchema
>;
export type BomItemSummary = z.infer<typeof bomItemSummarySchema>;
export type SymbolBomTemplateLineDetail = z.infer<
  typeof symbolBomTemplateLineDetailSchema
>;
export type SymbolBomTemplateDetail = z.infer<
  typeof symbolBomTemplateDetailSchema
>;
export type BomAssemblyQuantityFacts = z.infer<
  typeof bomAssemblyQuantityFactsSchema
>;
export type BomAssemblyProjection = z.infer<
  typeof bomAssemblyProjectionSchema
>;
export type GeneratedBomWarning = z.infer<typeof generatedBomWarningSchema>;
export type GeneratedBomLine = z.infer<typeof generatedBomLineSchema>;
export type GeneratedBomAssembly = z.infer<typeof generatedBomAssemblySchema>;
export type ConsolidatedBomLine = z.infer<typeof consolidatedBomLineSchema>;
export type GeneratedDrawingBom = z.infer<typeof generatedDrawingBomSchema>;
