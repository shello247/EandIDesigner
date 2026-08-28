import {
  engineeringAttributeDefinitionSchema,
  type EngineeringAttributeDefinition
} from "./schema";

const ALL_MANAGED_ASSET_TYPES = [
  "instrument",
  "controller",
  "panel",
  "junction_box",
  "terminal_block",
  "breaker",
  "fuse",
  "relay",
  "power_supply",
  "isolator",
  "converter",
  "io_module",
  "network_device",
  "earth_bar",
  "cable",
  "other"
] as const;

const ELECTRICAL_ASSET_TYPES = ALL_MANAGED_ASSET_TYPES.filter(
  (type) => type !== "other"
);

const ELECTRICAL_LOAD_TYPES = [
  "instrument",
  "controller",
  "relay",
  "power_supply",
  "converter",
  "io_module",
  "network_device",
  "other"
] as const;

const PROTECTION_RATED_TYPES = [
  "panel",
  "junction_box",
  "terminal_block",
  "breaker",
  "fuse",
  "relay",
  "power_supply",
  "isolator",
  "converter",
  "io_module",
  "other"
] as const;

const definitions = [
  {
    key: "engineering_purpose",
    version: 1,
    label: "Purpose / Description",
    description: "The asset's project-specific engineering purpose.",
    category: "documentation",
    valueKind: "text",
    maximumTextLength: 400,
    applicableAssetTypes: [...ALL_MANAGED_ASSET_TYPES],
    copyPolicy: "clear"
  },
  {
    key: "nominal_voltage",
    version: 1,
    label: "Nominal voltage",
    description: "The nominal electrical supply or operating voltage.",
    category: "supply",
    valueKind: "quantity",
    engineeringDimension: "voltage",
    canonicalUnit: "V",
    allowedUnits: ["V", "kV"],
    minimum: 0,
    minimumExclusive: true,
    precision: 6,
    applicableAssetTypes: ELECTRICAL_ASSET_TYPES,
    copyPolicy: "copy"
  },
  {
    key: "supply_nature",
    version: 1,
    label: "Supply nature",
    description: "Whether the applicable electrical supply is AC or DC.",
    category: "supply",
    valueKind: "choice",
    choices: [
      { value: "ac", label: "AC" },
      { value: "dc", label: "DC" }
    ],
    applicableAssetTypes: ELECTRICAL_ASSET_TYPES,
    copyPolicy: "copy"
  },
  {
    key: "phase_configuration",
    version: 1,
    label: "Phase configuration",
    description: "The phase arrangement for the applicable supply.",
    category: "supply",
    valueKind: "choice",
    choices: [
      { value: "single_phase", label: "Single-phase" },
      { value: "split_phase", label: "Split-phase" },
      { value: "three_phase", label: "Three-phase" },
      { value: "not_applicable", label: "Not applicable" }
    ],
    applicableAssetTypes: ELECTRICAL_ASSET_TYPES,
    copyPolicy: "copy"
  },
  {
    key: "frequency",
    version: 1,
    label: "Frequency",
    description: "The nominal AC supply frequency.",
    category: "supply",
    valueKind: "quantity",
    engineeringDimension: "frequency",
    canonicalUnit: "Hz",
    allowedUnits: ["Hz"],
    minimum: 0,
    minimumExclusive: true,
    precision: 6,
    applicableAssetTypes: ELECTRICAL_ASSET_TYPES,
    copyPolicy: "copy"
  },
  {
    key: "rated_current",
    version: 1,
    label: "Rated current",
    description: "The rated or stated current for the asset.",
    category: "load",
    valueKind: "quantity",
    engineeringDimension: "current",
    canonicalUnit: "A",
    allowedUnits: ["mA", "A", "kA"],
    minimum: 0,
    precision: 6,
    applicableAssetTypes: ELECTRICAL_ASSET_TYPES,
    copyPolicy: "copy"
  },
  {
    key: "active_power_consumption",
    version: 1,
    label: "Active power consumption",
    description: "The asset's active power consumption.",
    category: "load",
    valueKind: "quantity",
    engineeringDimension: "active_power",
    canonicalUnit: "W",
    allowedUnits: ["W", "kW"],
    minimum: 0,
    precision: 6,
    applicableAssetTypes: [...ELECTRICAL_LOAD_TYPES],
    copyPolicy: "copy"
  },
  {
    key: "apparent_power_consumption",
    version: 1,
    label: "Apparent power consumption",
    description: "The asset's apparent AC power consumption.",
    category: "load",
    valueKind: "quantity",
    engineeringDimension: "apparent_power",
    canonicalUnit: "VA",
    allowedUnits: ["VA", "kVA"],
    minimum: 0,
    precision: 6,
    applicableAssetTypes: [...ELECTRICAL_LOAD_TYPES],
    copyPolicy: "copy"
  },
  {
    key: "power_factor",
    version: 1,
    label: "Power factor",
    description: "The AC load power factor as a value from zero to one.",
    category: "load",
    valueKind: "number",
    minimum: 0,
    maximum: 1,
    precision: 6,
    applicableAssetTypes: [...ELECTRICAL_LOAD_TYPES],
    copyPolicy: "copy"
  },
  {
    key: "short_circuit_current_rating",
    version: 1,
    label: "Short-circuit current rating",
    description: "The stated short-circuit current rating for the asset.",
    category: "protection",
    valueKind: "quantity",
    engineeringDimension: "current",
    canonicalUnit: "A",
    allowedUnits: ["A", "kA"],
    minimum: 0,
    minimumExclusive: true,
    precision: 6,
    applicableAssetTypes: [...PROTECTION_RATED_TYPES],
    copyPolicy: "copy"
  },
  {
    key: "short_circuit_rating_voltage",
    version: 1,
    label: "SCCR rated voltage",
    description: "The voltage at which the short-circuit rating applies.",
    category: "protection",
    valueKind: "quantity",
    engineeringDimension: "voltage",
    canonicalUnit: "V",
    allowedUnits: ["V", "kV"],
    minimum: 0,
    minimumExclusive: true,
    precision: 6,
    applicableAssetTypes: [...PROTECTION_RATED_TYPES],
    copyPolicy: "copy"
  },
  {
    key: "conductor_cross_section",
    version: 1,
    label: "Conductor cross-sectional area",
    description: "The conductor cross-sectional area for the cable asset.",
    category: "conductor",
    valueKind: "quantity",
    engineeringDimension: "cross_section",
    canonicalUnit: "mm²",
    allowedUnits: ["mm²"],
    minimum: 0,
    minimumExclusive: true,
    precision: 6,
    applicableAssetTypes: ["cable"],
    copyPolicy: "copy"
  },
  {
    key: "heat_loss",
    version: 1,
    label: "Heat loss",
    description: "The asset's heat dissipation under the stated condition.",
    category: "thermal",
    valueKind: "quantity",
    engineeringDimension: "active_power",
    canonicalUnit: "W",
    allowedUnits: ["W", "kW"],
    minimum: 0,
    precision: 6,
    applicableAssetTypes: ALL_MANAGED_ASSET_TYPES.filter(
      (type) => type !== "cable" && type !== "earth_bar"
    ),
    copyPolicy: "copy"
  }
] satisfies Array<Omit<EngineeringAttributeDefinition, "status">>;

export const ENGINEERING_ATTRIBUTE_DEFINITIONS = definitions.map((definition) =>
  engineeringAttributeDefinitionSchema.parse(definition)
);

export const ENGINEERING_ATTRIBUTE_DEFINITION_BY_KEY = new Map(
  ENGINEERING_ATTRIBUTE_DEFINITIONS.map((definition) => [
    definition.key,
    definition
  ])
);
