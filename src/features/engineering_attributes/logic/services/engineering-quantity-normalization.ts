import type { EngineeringAttributeDefinition } from "../../data/schema";

import { convertEngineeringUnit } from "./normalize-engineering-value";

export type EngineeringQuantityNormalizationResult =
  | { ok: true; value: number; unit: string }
  | { ok: false; message: string };

export function normalizeEngineeringQuantity(input: {
  definition: EngineeringAttributeDefinition;
  value: number;
  unit: string;
}): EngineeringQuantityNormalizationResult {
  if (!Number.isFinite(input.value)) {
    return { ok: false, message: "Enter a finite numeric value." };
  }

  const dimension = input.definition.engineeringDimension;
  const canonicalUnit = input.definition.canonicalUnit;
  const allowedUnits = input.definition.allowedUnits ?? [];
  if (!dimension || !canonicalUnit || !allowedUnits.includes(input.unit)) {
    return {
      ok: false,
      message: `${input.unit} is not valid for ${input.definition.label}.`
    };
  }

  return convertEngineeringUnit(input.value, dimension, input.unit, canonicalUnit);
}
