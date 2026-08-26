import { z } from "zod";

export function normalizeWireCatalogName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export const wireCatalogEntryIdSchema = z.string().trim().min(1).max(120);
export const wireCatalogNameSchema = z.string().trim().min(1).max(120);
export const wireCatalogWireTypeSchema = z.string().trim().min(1).max(120);
export const wireCatalogSizeSchema = z.string().trim().min(1).max(80);
export const wireCatalogColorSchema = z.string().trim().min(1).max(80);
export const wireCatalogNotesSchema = z.string().trim().max(240).optional();

export const wireCatalogEntrySchema = z.object({
  id: wireCatalogEntryIdSchema,
  name: wireCatalogNameSchema,
  wireType: wireCatalogWireTypeSchema,
  size: wireCatalogSizeSchema,
  color: wireCatalogColorSchema,
  notes: z.string().max(240).optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const wireCatalogEntryInputSchema = z.object({
  name: wireCatalogNameSchema,
  wireType: wireCatalogWireTypeSchema,
  size: wireCatalogSizeSchema,
  color: wireCatalogColorSchema,
  notes: wireCatalogNotesSchema,
  makeDefault: z.boolean().optional()
});

export const updateWireCatalogEntryInputSchema =
  wireCatalogEntryInputSchema.extend({
    entryId: wireCatalogEntryIdSchema
  });

export const deleteWireCatalogEntryInputSchema = z.object({
  entryId: wireCatalogEntryIdSchema,
  replacementDefaultId: wireCatalogEntryIdSchema.optional()
});

export const setDefaultWireCatalogEntryInputSchema = z.object({
  entryId: wireCatalogEntryIdSchema
});

export const wireSpecificationSnapshotSchema = z.object({
  catalogEntryId: wireCatalogEntryIdSchema,
  catalogEntryName: wireCatalogNameSchema,
  wireType: wireCatalogWireTypeSchema,
  size: wireCatalogSizeSchema,
  color: wireCatalogColorSchema
});

export type WireCatalogEntry = z.infer<typeof wireCatalogEntrySchema>;
export type WireCatalogEntryInput = z.infer<
  typeof wireCatalogEntryInputSchema
>;
export type UpdateWireCatalogEntryInput = z.infer<
  typeof updateWireCatalogEntryInputSchema
>;
export type DeleteWireCatalogEntryInput = z.infer<
  typeof deleteWireCatalogEntryInputSchema
>;
export type SetDefaultWireCatalogEntryInput = z.infer<
  typeof setDefaultWireCatalogEntryInputSchema
>;
export type WireSpecificationSnapshot = z.infer<
  typeof wireSpecificationSnapshotSchema
>;
