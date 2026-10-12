import { describe, expect, it } from "vitest";
import { awgToSquareMillimetres, convertEngineeringUnit, normalizeEngineeringValue } from "../api/public";
import { ENGINEERING_UNITS, ENGINEERING_BASE_UNITS } from "../data/unit-catalog";

describe("Engineering normalization", () => {
  it.each([[32,"°F",0,"°C"],[212,"°F",100,"°C"],[0,"°C",273.15,"K"],[-40,"°C",-40,"°F"]])("converts absolute temperature %s %s", (value, from, expected, to) => {
    const result = convertEngineeringUnit(value as number, "temperature", from as string, to as string);
    expect(result.ok).toBe(true); if (result.ok) expect(result.value).toBeCloseTo(expected as number, 9);
  });
  it("keeps differences distinct and rejects temperatures below absolute zero", () => {
    expect(convertEngineeringUnit(18, "temperature_difference", "Δ°F", "Δ°C")).toEqual({ ok: true, value: 10, unit: "Δ°C" });
    expect(convertEngineeringUnit(18, "temperature_difference", "°F", "Δ°C").ok).toBe(false);
    expect(convertEngineeringUnit(-1,"temperature","K","°C").ok).toBe(false);
  });
  it("round-trips all supported units without changing dimension", () => {
    for (const [dimension, units] of Object.entries(ENGINEERING_UNITS)) for (const unit of Object.keys(units)) {
      const base = ENGINEERING_BASE_UNITS[dimension];
      const one = convertEngineeringUnit(42.125, dimension, unit, base);
      expect(one.ok).toBe(true); if (!one.ok) continue;
      const two = convertEngineeringUnit(one.value, dimension, base, unit);
      expect(two.ok).toBe(true); if (two.ok) expect(two.value).toBeCloseTo(42.125, 9);
    }
    expect(convertEngineeringUnit(1,"active_power","VA","W").ok).toBe(false);
    expect(convertEngineeringUnit(Infinity,"length","m","mm").ok).toBe(false);
  });
  it("preserves entered ranges while normalizing and never guesses empty numbers", () => {
    const value = { kind: "range" as const, minimum: 32, maximum: 212, unit: "°F" };
    const result = normalizeEngineeringValue({ value, dimension: "temperature", canonicalUnit: "°C" });
    expect(result).toEqual({ ok: true, original: value, minimum: 0, maximum: 100, unit: "°C" });
    expect(value.unit).toBe("°F");
    expect(normalizeEngineeringValue({ value: { ...value, minimum: 250 }, dimension: "temperature" }).ok).toBe(false);
    expect(normalizeEngineeringValue({ value: { kind: "number", value: NaN } }).ok).toBe(false);
  });
  it("validates AWG designations and applies the gauge equation instead of a multiplier", () => {
    const small = awgToSquareMillimetres("14 AWG"); const large = awgToSquareMillimetres("4/0");
    expect(small.ok).toBe(true); if (small.ok) expect(small.value).toBeCloseTo(2.0809, 3);
    expect(large.ok).toBe(true); if (large.ok) expect(large.value).toBeCloseTo(107.2193, 3);
    expect(awgToSquareMillimetres("0000")).toEqual(large);
    for (const invalid of ["", "-1", "2.5", "41", "5/0", "1e1", "014"]) expect(awgToSquareMillimetres(invalid).ok).toBe(false);
  });
});
