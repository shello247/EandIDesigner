import { z } from "zod";

export const SYMBOL_COMPONENT_MAX_DEPTH = 16;

export const symbolComponentKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
    "Component keys must use lowercase letters, numbers, and underscores."
  );

export const symbolComponentBoxSchema = z.object({
  centerX: z.number().finite(),
  centerY: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotationDeg: z.number().finite()
});

export const symbolComponentDefinitionSchema = z.object({
  key: symbolComponentKeySchema,
  label: z.string().trim().min(1).max(160),
  box: symbolComponentBoxSchema,
  allowedSymbolIds: z
    .array(z.string().trim().min(1).max(120))
    .max(500)
    .transform((ids) => [...new Set(ids)])
});

export const symbolComponentPositionSchema = z.object({
  key: symbolComponentKeySchema,
  label: z.string().trim().min(1).max(160),
  required: z.boolean().default(false),
  components: z.array(symbolComponentDefinitionSchema).min(1).max(100)
});

export const symbolComponentPositionsSchema = z
  .array(symbolComponentPositionSchema)
  .max(100);

export const drawingComponentSelectionSchema: z.ZodType<{
  positionKey: string;
  componentKey: string;
  symbolId: string;
  versionId: string;
  children?: DrawingComponentSelection[];
}> = z.lazy(() =>
  z.object({
    positionKey: symbolComponentKeySchema,
    componentKey: symbolComponentKeySchema,
    symbolId: z.string().trim().min(1).max(120),
    versionId: z.string().trim().min(1).max(120),
    children: z.array(drawingComponentSelectionSchema).max(100).optional()
  })
);

export const drawingComponentSelectionsSchema = z
  .array(drawingComponentSelectionSchema)
  .max(100);

export type SymbolComponentBox = z.infer<typeof symbolComponentBoxSchema>;
export type SymbolComponentDefinition = z.infer<
  typeof symbolComponentDefinitionSchema
>;
export type SymbolComponentPosition = z.infer<
  typeof symbolComponentPositionSchema
>;
export type DrawingComponentSelection = {
  positionKey: string;
  componentKey: string;
  symbolId: string;
  versionId: string;
  children?: DrawingComponentSelection[];
};
