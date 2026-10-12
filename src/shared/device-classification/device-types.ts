import { z } from "zod";

// Identifiers are storage contracts. Labels/order are shared by every catalogue
// and drawing surface; technical behaviour is deliberately not inferred here.
export const deviceTypeSchema = z.enum([
  "instrument", "controller", "panel", "junction_box", "terminal_block",
  "breaker", "fuse", "relay", "power_supply", "ups", "chassis_rack",
  "isolator", "converter", "io_module", "network_device", "earth_bar",
  "cable", "cable_gland", "din_rail", "wire_duct", "label_marker", "other"
]);

export type DeviceType = z.infer<typeof deviceTypeSchema>;

export const DEVICE_TYPE_LABELS: Readonly<Record<DeviceType, string>> = {
  instrument: "Instrument", controller: "Controller", panel: "Panel",
  junction_box: "Junction Box", terminal_block: "Terminal Block",
  breaker: "Circuit Breaker", fuse: "Fuse", relay: "Relay",
  power_supply: "Power Supply", ups: "UPS", chassis_rack: "Chassis / Rack",
  isolator: "Isolator", converter: "Converter", io_module: "I/O Module",
  network_device: "Network Device", earth_bar: "Earth Bar", cable: "Cable",
  cable_gland: "Cable Gland", din_rail: "DIN Rail", wire_duct: "Wire Duct",
  label_marker: "Label / Marker", other: "Other"
};

export const DEVICE_TYPE_OPTIONS = deviceTypeSchema.options.map(value => ({
  value, label: DEVICE_TYPE_LABELS[value]
}));

export function getDeviceTypeLabel(value: DeviceType | null | undefined): string {
  return value ? DEVICE_TYPE_LABELS[value] : "Needs classification";
}

// Only explicit, narrow inheritance is permitted. This makes existing supply
// templates applicable to UPS without turning slots into I/O or rails into assets.
export function deviceTypeFamily(type: DeviceType): DeviceType {
  return type === "ups" ? "power_supply" : type;
}

export function isDeviceTypeApplicable(type: string, allowed: readonly string[]): boolean {
  const parsed = deviceTypeSchema.safeParse(type);
  return allowed.includes(type) || (parsed.success && allowed.includes(deviceTypeFamily(parsed.data)));
}

// For review proposals only: broad legacy groups (Power/Protection/Other) do
// not establish a specific type. Never use this to silently persist a type.
const LEGACY_TECHNICAL_TYPES: Readonly<Record<string, DeviceType>> = {
  instrument: "instrument", controller: "controller", monitor: "controller",
  network_device: "network_device", terminal_block: "terminal_block",
  cable_assembly: "cable", gland: "cable_gland", rail: "din_rail",
  ducting: "wire_duct", label: "label_marker"
};

export function legacyTechnicalTypeProposal(kind: string): DeviceType | null {
  return Object.hasOwn(LEGACY_TECHNICAL_TYPES, kind) ? LEGACY_TECHNICAL_TYPES[kind] : null;
}
