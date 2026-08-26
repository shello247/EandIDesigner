import { z } from "zod";

export const SYMBOL_CATEGORY_SEEDS = [
  "Protection",
  "Termination",
  "Controller",
  "Power",
  "Ducting",
  "Rail",
  "Label",
  "Instrument",
  "Monitor",
  "Network Device",
  "Terminal Block",
  "Cable Assembly",
  "Gland",
  "Other"
] as const;

export const PROTECTED_SYMBOL_CATEGORY_NAME = "Other";

export function normalizeSymbolCategoryName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export const symbolCategoryIdSchema = z.string().trim().min(1).max(120);

export const symbolCategoryNameSchema = z.string().trim().min(1).max(80);

export const symbolCategoryDescriptionSchema = z
  .string()
  .trim()
  .max(240)
  .optional();

export const symbolCategorySummarySchema = z.object({
  id: symbolCategoryIdSchema,
  name: symbolCategoryNameSchema
});

export const symbolCategoryRecordSchema = symbolCategorySummarySchema.extend({
  description: z.string().max(240).optional(),
  isProtected: z.boolean(),
  symbolCount: z.number().int().nonnegative()
});

export const createSymbolCategoryInputSchema = z.object({
  name: symbolCategoryNameSchema,
  description: symbolCategoryDescriptionSchema
});

export const updateSymbolCategoryInputSchema =
  createSymbolCategoryInputSchema.extend({
    categoryId: symbolCategoryIdSchema
  });

export const deleteSymbolCategoryInputSchema = z.object({
  categoryId: symbolCategoryIdSchema,
  replacementCategoryId: symbolCategoryIdSchema.optional()
});

export type SymbolCategorySummary = z.infer<
  typeof symbolCategorySummarySchema
>;
export type SymbolCategoryRecord = z.infer<typeof symbolCategoryRecordSchema>;
export type CreateSymbolCategoryInput = z.infer<
  typeof createSymbolCategoryInputSchema
>;
export type UpdateSymbolCategoryInput = z.infer<
  typeof updateSymbolCategoryInputSchema
>;
export type DeleteSymbolCategoryInput = z.infer<
  typeof deleteSymbolCategoryInputSchema
>;

const PANEL_CATEGORY_NAMES: Record<string, string> = {
  protection: "Protection",
  termination: "Termination",
  controller: "Controller",
  power: "Power",
  ducting: "Ducting",
  rail: "Rail",
  label: "Label",
  other: "Other"
};

const TECHNICAL_KIND_CATEGORY_NAMES: Record<string, string> = {
  instrument: "Instrument",
  monitor: "Monitor",
  network_device: "Network Device",
  terminal_block: "Terminal Block",
  cable_assembly: "Cable Assembly",
  gland: "Gland",
  protection: "Protection",
  termination: "Termination",
  controller: "Controller",
  power: "Power",
  ducting: "Ducting",
  rail: "Rail",
  label: "Label",
  other: "Other"
};

const PANEL_TECHNICAL_KINDS: Record<string, string> = {
  protection: "protection",
  termination: "termination",
  controller: "controller",
  power: "power",
  ducting: "ducting",
  rail: "rail",
  label: "label"
};

export function resolveLegacySymbolTechnicalKind(input: {
  panelCategory?: string | null;
  technicalKind?: string | null;
}): string {
  const technicalKind = input.technicalKind?.trim().toLowerCase();
  if (technicalKind && technicalKind !== "other") {
    return technicalKind;
  }

  const panelCategory = input.panelCategory?.trim().toLowerCase();
  return (
    (panelCategory ? PANEL_TECHNICAL_KINDS[panelCategory] : undefined) ??
    technicalKind ??
    "other"
  );
}

export function resolveLegacySymbolCategoryName(input: {
  panelCategory?: string | null;
  technicalKind?: string | null;
}): string {
  const panelCategory = input.panelCategory?.trim().toLowerCase();
  if (panelCategory && PANEL_CATEGORY_NAMES[panelCategory]) {
    return PANEL_CATEGORY_NAMES[panelCategory];
  }

  const technicalKind = input.technicalKind?.trim().toLowerCase();
  if (technicalKind && TECHNICAL_KIND_CATEGORY_NAMES[technicalKind]) {
    return TECHNICAL_KIND_CATEGORY_NAMES[technicalKind];
  }

  return PROTECTED_SYMBOL_CATEGORY_NAME;
}

export function sortSymbolCategories<
  T extends { name: string; isProtected?: boolean }
>(categories: readonly T[]): T[] {
  return [...categories].sort((first, second) => {
    const firstIsOther =
      normalizeSymbolCategoryName(first.name) ===
      normalizeSymbolCategoryName(PROTECTED_SYMBOL_CATEGORY_NAME);
    const secondIsOther =
      normalizeSymbolCategoryName(second.name) ===
      normalizeSymbolCategoryName(PROTECTED_SYMBOL_CATEGORY_NAME);

    if (firstIsOther !== secondIsOther) {
      return firstIsOther ? 1 : -1;
    }

    return first.name.localeCompare(second.name);
  });
}
