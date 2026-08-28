import { z } from "zod";

export const engineeringAttributeCategorySchema = z.enum([
  "documentation",
  "supply",
  "load",
  "protection",
  "conductor",
  "thermal"
]);

export const engineeringAttributeValueKindSchema = z.enum([
  "text",
  "number",
  "quantity",
  "choice"
]);

export const engineeringDimensionSchema = z.enum([
  "voltage",
  "current",
  "frequency",
  "active_power",
  "apparent_power",
  "cross_section"
]);

export const engineeringAttributeSubjectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("managed_asset"),
    typeToken: z.string().trim().min(1).max(80)
  }),
  z.object({
    kind: z.literal("structured_terminal_strip_member"),
    role: z.enum(["electrical", "end_bracket", "accessory"])
  })
]);

export const engineeringAttributeSourceSchema = z.object({
  kind: z.enum(["manufacturer", "engineer_entered", "imported"]),
  reference: z.string().trim().max(500).optional()
});

const engineeringAttributeValueBaseSchema = z.object({
  definitionKey: z.string().trim().min(1).max(120),
  definitionVersion: z.literal(1),
  source: engineeringAttributeSourceSchema.default({
    kind: "engineer_entered"
  })
});

export const engineeringAttributeValueSchema = z.discriminatedUnion("kind", [
  engineeringAttributeValueBaseSchema.extend({
    kind: z.literal("text"),
    value: z.string().trim().min(1).max(400)
  }),
  engineeringAttributeValueBaseSchema.extend({
    kind: z.literal("number"),
    value: z.number().finite()
  }),
  engineeringAttributeValueBaseSchema.extend({
    kind: z.literal("choice"),
    value: z.string().trim().min(1).max(120)
  }),
  engineeringAttributeValueBaseSchema.extend({
    kind: z.literal("quantity"),
    value: z.number().finite(),
    unit: z.string().trim().min(1).max(24)
  })
]);

export const engineeringAttributeContainerSchema = z
  .object({
    version: z.literal(1),
    values: z.array(engineeringAttributeValueSchema)
  })
  .superRefine((container, context) => {
    const seen = new Set<string>();
    container.values.forEach((value, index) => {
      if (seen.has(value.definitionKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["values", index, "definitionKey"],
          message: `Attribute ${value.definitionKey} is assigned more than once.`
        });
      }
      seen.add(value.definitionKey);
    });
  });

export const engineeringAttributeDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  version: z.literal(1),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  category: engineeringAttributeCategorySchema,
  valueKind: engineeringAttributeValueKindSchema,
  engineeringDimension: engineeringDimensionSchema.optional(),
  canonicalUnit: z.string().trim().min(1).max(24).optional(),
  allowedUnits: z.array(z.string().trim().min(1).max(24)).optional(),
  choices: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(120),
        label: z.string().trim().min(1).max(120)
      })
    )
    .optional(),
  minimum: z.number().finite().optional(),
  minimumExclusive: z.boolean().optional(),
  maximum: z.number().finite().optional(),
  precision: z.number().int().min(0).max(12).optional(),
  maximumTextLength: z.number().int().positive().max(4000).optional(),
  applicableAssetTypes: z.array(z.string().trim().min(1).max(80)).optional(),
  copyPolicy: z.enum(["copy", "clear"]),
  status: z.enum(["active", "deprecated"]).default("active")
});

export type EngineeringAttributeCategory = z.infer<
  typeof engineeringAttributeCategorySchema
>;
export type EngineeringAttributeSource = z.infer<
  typeof engineeringAttributeSourceSchema
>;
export type EngineeringAttributeValue = z.infer<
  typeof engineeringAttributeValueSchema
>;
export type EngineeringAttributeContainer = z.infer<
  typeof engineeringAttributeContainerSchema
>;
export type EngineeringAttributeDefinition = z.infer<
  typeof engineeringAttributeDefinitionSchema
>;
export type EngineeringAttributeSubject = z.infer<
  typeof engineeringAttributeSubjectSchema
>;
