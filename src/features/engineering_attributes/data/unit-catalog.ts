/** y = x * scale + offset, expressed in the dimension's base unit. */
export type EngineeringUnit = { scale: number; offset?: number };
export const ENGINEERING_UNITS: Record<string, Record<string, EngineeringUnit>> = {
  voltage: { mV: { scale: .001 }, V: { scale: 1 }, kV: { scale: 1000 } },
  current: { "µA": { scale: .000001 }, mA: { scale: .001 }, A: { scale: 1 }, kA: { scale: 1000 } },
  frequency: { Hz: { scale: 1 }, kHz: { scale: 1000 }, MHz: { scale: 1e6 } },
  active_power: { W: { scale: 1 }, kW: { scale: 1000 } },
  apparent_power: { VA: { scale: 1 }, kVA: { scale: 1000 } },
  cross_section: { "mm²": { scale: 1 } },
  length: { mm: { scale: 1 }, cm: { scale: 10 }, m: { scale: 1000 }, in: { scale: 25.4 }, ft: { scale: 304.8 } },
  temperature: { "°C": { scale: 1, offset: 273.15 }, "°F": { scale: 5 / 9, offset: 273.15 - 32 * 5 / 9 }, K: { scale: 1 } },
  temperature_difference: { "Δ°C": { scale: 1 }, "Δ°F": { scale: 5 / 9 }, "ΔK": { scale: 1 } },
  time: { "µs": { scale: .000001 }, ms: { scale: .001 }, s: { scale: 1 }, min: { scale: 60 }, h: { scale: 3600 } },
  resistance: { "Ω": { scale: 1 }, "kΩ": { scale: 1000 }, "MΩ": { scale: 1e6 } },
  torque: { "N·m": { scale: 1 }, "lbf·in": { scale: .1129848290276167 } },
  mass: { g: { scale: .001 }, kg: { scale: 1 }, lb: { scale: .45359237 } },
  ratio: { fraction: { scale: 1 }, "%": { scale: .01 } }
};
// Compatibility unit-picker index; normalization must use convertEngineeringUnit.
export const ATTRIBUTE_UNITS: Record<string, Record<string, number>> = Object.fromEntries(
  Object.entries(ENGINEERING_UNITS).map(([dimension, units]) => [dimension,
    Object.fromEntries(Object.entries(units).map(([unit, conversion]) => [unit, conversion.scale]))])
);
export const ENGINEERING_BASE_UNITS: Record<string, string> = {
  voltage: "V", current: "A", frequency: "Hz", active_power: "W", apparent_power: "VA", cross_section: "mm²", length: "mm",
  temperature: "K", temperature_difference: "ΔK", time: "s", resistance: "Ω", torque: "N·m", mass: "kg", ratio: "fraction"
};
