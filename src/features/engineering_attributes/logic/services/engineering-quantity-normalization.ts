import type { EngineeringAttributeDefinition } from "../../data/schema";

const UNIT_FACTORS: Record<string, Record<string, number>> = {
  voltage: { V: 1, kV: 1_000 },
  current: { mA: 0.001, A: 1, kA: 1_000 },
  frequency: { Hz: 1 },
  active_power: { W: 1, kW: 1_000 },
  apparent_power: { VA: 1, kVA: 1_000 },
  cross_section: { "mm²": 1 }
};

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

  const factor = UNIT_FACTORS[dimension]?.[input.unit];
  if (factor === undefined) {
    return {
      ok: false,
      message: `No ${input.unit} conversion is defined for ${input.definition.label}.`
    };
  }

  return {
    ok: true,
    value: Number((input.value * factor).toPrecision(15)),
    unit: canonicalUnit
  };
}
