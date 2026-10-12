import { ENGINEERING_UNITS, ENGINEERING_BASE_UNITS } from "../../data/unit-catalog";

export type UnitConversionResult = { ok: true; value: number; unit: string } | { ok: false; message: string };
export function convertEngineeringUnit(value: number, dimension: string, from: string, to: string): UnitConversionResult {
  const source = ENGINEERING_UNITS[dimension]?.[from]; const target = ENGINEERING_UNITS[dimension]?.[to];
  if (!Number.isFinite(value)) return { ok: false, message: "Enter a finite numeric value." };
  if (!source || !target) return { ok: false, message: "Units must belong to the same engineering dimension." };
  const base = value * source.scale + (source.offset ?? 0);
  if (!Number.isFinite(base) || dimension === "temperature" && base < -1e-10) return { ok: false, message: "Value is outside the supported physical range." };
  const result = (base - (target.offset ?? 0)) / target.scale;
  if (!Number.isFinite(result)) return { ok: false, message: "Conversion exceeds the supported numeric range." };
  return { ok: true, value: Math.abs(result) < 1e-12 ? 0 : Number(result.toPrecision(15)), unit: to };
}

/** AWG is logarithmic, not a unit multiplier; preserve its original designation. */
export function awgToSquareMillimetres(gauge: string): UnitConversionResult {
  const text = gauge.trim().toUpperCase().replace(/\s*AWG$/, "");
  const aliases: Record<string, number> = { "1/0": 0, "2/0": -1, "3/0": -2, "4/0": -3, "00": -1, "000": -2, "0000": -3 };
  const n = Object.hasOwn(aliases, text) ? aliases[text] : /^(0|[1-9]|[1-3][0-9]|40)$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(n) || n < -3 || n > 40) return { ok: false, message: "Use a supported AWG designation from 40 through 4/0." };
  const diameterMm = .127 * 92 ** ((36 - n) / 39);
  return { ok: true, value: Number((Math.PI * diameterMm ** 2 / 4).toPrecision(15)), unit: "mm²" };
}

export type NormalizableEngineeringValue =
  | { kind: "number"; value: number }
  | { kind: "quantity"; value: number; unit: string }
  | { kind: "range"; minimum: number; maximum: number; unit: string }
  | { kind: "conductor_size"; system: "AWG"; gauge: string };
export type NormalizedEngineeringValue = { ok: false; message: string } |
  { ok: true; original: NormalizableEngineeringValue; value?: number; minimum?: number; maximum?: number; unit?: string };
export function normalizeEngineeringValue(input: { value: NormalizableEngineeringValue; dimension?: string; canonicalUnit?: string }): NormalizedEngineeringValue {
  const value = input.value; const original = structuredClone(value);
  if (value.kind === "number") return Number.isFinite(value.value) ? { ok: true, original, value: value.value } : { ok: false, message: "Enter a finite numeric value." };
  if (value.kind === "conductor_size") {
    if (input.dimension && input.dimension !== "cross_section") return { ok: false, message: "Conductor size requires an area dimension." };
    const result = awgToSquareMillimetres(value.gauge); return result.ok ? { ...result, original } : result;
  }
  const dimension = input.dimension ?? ""; const target = input.canonicalUnit ?? ENGINEERING_BASE_UNITS[dimension];
  if (!target) return { ok: false, message: "A supported engineering dimension is required." };
  if (value.kind === "quantity") { const result = convertEngineeringUnit(value.value, dimension, value.unit, target); return result.ok ? { ...result, original } : result; }
  if (value.minimum > value.maximum) return { ok: false, message: "Maximum must be at least the minimum." };
  const low = convertEngineeringUnit(value.minimum, dimension, value.unit, target);
  const high = convertEngineeringUnit(value.maximum, dimension, value.unit, target);
  if (!low.ok) return low; if (!high.ok) return high;
  return { ok: true, original, minimum: low.value, maximum: high.value, unit: target };
}
