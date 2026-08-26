import { describe, expect, it } from "vitest";
import {
  ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY,
  normalizeEngineeringQuantity
} from "../api/public";

function definition(key: string) {
  const result = ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY.get(key);
  if (!result) throw new Error(`Missing ${key}`);
  return result;
}

describe("engineering quantity normalization", () => {
  it.each([
    ["nominal_voltage", 0.024, "kV", 24, "V"],
    ["rated_current", 350, "mA", 0.35, "A"],
    ["short_circuit_current_rating", 10, "kA", 10_000, "A"],
    ["active_power_consumption", 1.5, "kW", 1_500, "W"],
    ["apparent_power_consumption", 2.5, "kVA", 2_500, "VA"],
    ["conductor_cross_section", 1.5, "mm²", 1.5, "mm²"]
  ])("normalizes %s from %s %s", (key, value, unit, expected, expectedUnit) => {
    const result = normalizeEngineeringQuantity({
      definition: definition(String(key)),
      value: Number(value),
      unit: String(unit)
    });
    expect(result).toEqual({
      ok: true,
      value: expected,
      unit: expectedUnit
    });
  });

  it("rejects a dimensionally invalid unit", () => {
    expect(
      normalizeEngineeringQuantity({
        definition: definition("nominal_voltage"),
        value: 24,
        unit: "A"
      })
    ).toMatchObject({ ok: false });
  });
});

