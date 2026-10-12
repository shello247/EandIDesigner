export type AttributeTemplate = { id: string; label: string; deviceTypes: string[]; analysisKeys: string[] };
const common = ["operating_temperature_range", "physical_width", "physical_height", "physical_depth", "mounting_method"];
export const ATTRIBUTE_TEMPLATES: AttributeTemplate[] = [
  { id: "io_module", label: "I/O module", deviceTypes: ["io_module"], analysisKeys: [...common,"io_channel_count","io_signal_direction","io_signal_type","io_current_range","io_resolution_bits","io_accuracy","io_accuracy_basis","io_input_burden","io_isolation_arrangement","io_isolation_working","io_update_time","active_power_consumption"] },
  { id: "controller", label: "Controller", deviceTypes: ["controller"], analysisKeys: [...common,"supply_voltage_range","supply_nature","active_power_consumption","network_protocol"] },
  { id: "power_supply", label: "Power supply / UPS", deviceTypes: ["power_supply", "ups"], analysisKeys: [...common,"supply_voltage_range","supply_nature","supply_output_capacity_w","supply_output_capacity_va","supply_output_capacity_a","frequency"] },
  { id: "protection", label: "Protection device", deviceTypes: ["breaker","fuse"], analysisKeys: [...common,"rated_current","pole_count","trip_characteristic","conditional_breaking_capacity","conditional_sccr"] },
  { id: "terminal_block", label: "Terminal block", deviceTypes: ["terminal_block"], analysisKeys: [...common,"rated_current","nominal_voltage","terminal_conductor_limits","installation_torque","terminal_strip_length"] },
  { id: "instrument", label: "Instrument", deviceTypes: ["instrument"], analysisKeys: [...common,"supply_voltage_range","io_signal_type","io_current_range","io_accuracy","io_accuracy_basis"] },
  { id: "network_device", label: "Network device", deviceTypes: ["network_device"], analysisKeys: [...common,"supply_voltage_range","active_power_consumption","network_protocol"] }
];
