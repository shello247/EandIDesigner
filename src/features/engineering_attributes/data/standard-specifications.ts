import { attributeTypeDefinitionSchema } from "./type-schema";

const scalar = (label: string, valueKind: "number" | "text", extra: object = {}) => attributeTypeDefinitionSchema.parse({
  label, description: `Manufacturer stated ${label.toLowerCase()}; record its applicable conditions and evidence.`, category: "documentation", valueKind, ...extra
});
const quantity = (label: string, engineeringDimension: string, canonicalUnit: string, allowedUnits: string[], range = false, extra: object = {}) => attributeTypeDefinitionSchema.parse({
  label, description: `Manufacturer stated ${label.toLowerCase()}; preserve the applicable scope, mode and evidence.`,
  category: "documentation", valueKind: range ? "range" : "quantity", engineeringDimension, canonicalUnit, allowedUnits, ...extra
});
const choice = (label: string, values: string[]) => attributeTypeDefinitionSchema.parse({
  label, description: `Explicit ${label.toLowerCase()} for the selected product or channel.`, category: "documentation", valueKind: "choice",
  choices: values.map(value => ({ value, label: value.replaceAll("_", " ") }))
});
/** New identities for typed specifications; existing text identities are never repurposed. */
export const STANDARD_SPECIFICATIONS = [
  { key: "operating_temperature_range", definition: quantity("Operating temperature range", "temperature", "°C", ["°C","°F","K"], true) },
  { key: "storage_temperature_range", definition: quantity("Storage temperature range", "temperature", "°C", ["°C","°F","K"], true) },
  { key: "relative_humidity_range", definition: quantity("Relative humidity range", "ratio", "%", ["%","fraction"], true, { minimum: 0, maximum: 100 }) },
  { key: "installation_torque", definition: quantity("Installation torque", "torque", "N·m", ["N·m","lbf·in"], false, { minimum: 0 }) },
  { key: "product_mass", definition: quantity("Product mass", "mass", "kg", ["g","kg","lb"], false, { minimum: 0 }) },
  { key: "installation_clearance", definition: quantity("Installation clearance", "length", "mm", ["mm","cm","m","in","ft"], false, { minimum: 0 }) },
  { key: "io_channel_count", definition: scalar("I/O channel count", "number", { minimum: 0, precision: 0, applicableAssetTypes: ["io_module","controller","instrument"] }) },
  { key: "io_signal_direction", definition: choice("I/O signal direction", ["input","output","bidirectional"]) },
  { key: "io_signal_type", definition: choice("I/O signal type", ["analog_current","analog_voltage","digital","relay","serial","other"]) },
  { key: "io_current_range", definition: quantity("I/O current range", "current", "mA", ["µA","mA","A"], true) },
  { key: "io_voltage_range", definition: quantity("I/O voltage range", "voltage", "V", ["mV","V","kV"], true) },
  { key: "io_resolution_bits", definition: scalar("I/O resolution (bits)", "number", { minimum: 1, precision: 0 }) },
  { key: "io_accuracy", definition: quantity("I/O accuracy", "ratio", "%", ["%","fraction"], false, { minimum: 0 }) },
  { key: "io_accuracy_basis", definition: choice("I/O accuracy basis", ["full_scale","reading","span","specified_conditions"]) },
  { key: "io_input_burden", definition: quantity("I/O input burden", "resistance", "Ω", ["Ω","kΩ","MΩ"], false, { minimum: 0 }) },
  { key: "io_isolation_working", definition: quantity("Isolation working voltage", "voltage", "V", ["V","kV"], false, { minimum: 0 }) },
  { key: "io_isolation_test", definition: quantity("Isolation test voltage", "voltage", "V", ["V","kV"], false, { minimum: 0 }) },
  { key: "io_isolation_arrangement", definition: choice("Isolation arrangement", ["channel_to_channel","grouped_channels","non_isolated","specified_conditions"]) },
  { key: "io_update_time", definition: quantity("I/O update time", "time", "ms", ["µs","ms","s","min","h"], false, { minimum: 0 }) },
  { key: "supply_voltage_range", definition: quantity("Supply voltage range", "voltage", "V", ["mV","V","kV"], true, { minimum: 0 }) },
  { key: "supply_output_capacity_w", definition: quantity("Supply output capacity (W)", "active_power", "W", ["W","kW"], false, { minimum: 0 }) },
  { key: "supply_output_capacity_va", definition: quantity("Supply output capacity (VA)", "apparent_power", "VA", ["VA","kVA"], false, { minimum: 0 }) },
  { key: "supply_output_capacity_a", definition: quantity("Supply output capacity (A)", "current", "A", ["µA","mA","A","kA"], false, { minimum: 0 }) },
  { key: "supply_input_current", definition: quantity("Supply input current consumption", "current", "A", ["µA","mA","A"], false, { minimum: 0 }) },
  { key: "network_protocol", definition: scalar("Network protocol", "text", { maximumTextLength: 1000 }) },
  { key: "terminal_strip_length", definition: quantity("Conductor strip length", "length", "mm", ["mm","in"], true, { minimum: 0 }) }
];
