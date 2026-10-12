import { z } from "zod";
import { engineeringAttributeDefinitionSchema } from "./schema";

import { ATTRIBUTE_UNITS } from "./unit-catalog";
export { ATTRIBUTE_UNITS } from "./unit-catalog";
export const attributeTypeDefinitionSchema = engineeringAttributeDefinitionSchema.omit({
  key: true, version: true, status: true, copyPolicy: true
}).extend({
  valueKind: z.enum(["number", "quantity", "text", "choice", "range"]),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  payloadKind: z.enum(["scalar", "short_circuit", "terminal_range"]).default("scalar")
}).superRefine((definition, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (definition.valueKind === "quantity" || definition.valueKind === "range") {
    const units = ATTRIBUTE_UNITS[definition.engineeringDimension ?? ""];
    if (!units || !definition.allowedUnits?.length || !definition.canonicalUnit ||
        !definition.allowedUnits.includes(definition.canonicalUnit) ||
        definition.allowedUnits.some(unit => units[unit] === undefined)) fail("Select compatible units and a default unit.");
  } else if (definition.engineeringDimension || definition.allowedUnits?.length || definition.canonicalUnit) {
    fail("This value format does not use engineering units.");
  }
  if (definition.valueKind === "choice" && (!definition.choices?.length ||
      new Set(definition.choices.map(choice => choice.value)).size !== definition.choices.length)) fail("Enter distinct selection options.");
  if (definition.minimum !== undefined && definition.maximum !== undefined && definition.minimum > definition.maximum) fail("Maximum must be at least the minimum.");
});
export type AttributeTypeDefinition = z.infer<typeof attributeTypeDefinitionSchema>;
export const attributeTypeSnapshotSchema = z.strictObject({
  typeId: z.string().min(1), revisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(), analysisKey: z.string().nullable(),
  definition: attributeTypeDefinitionSchema
});
export type AttributeTypeSnapshot = z.infer<typeof attributeTypeSnapshotSchema>;
export type AttributeTypeOption = AttributeTypeSnapshot & { status: "active" | "retired" };
export class AttributeTypeError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
