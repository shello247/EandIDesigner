import { STANDARD_SPECIFICATIONS } from "./standard-specifications";
import { ENGINEERING_ATTRIBUTE_DEFINITIONS } from "./catalog";
import { attributeTypeDefinitionSchema, type AttributeTypeSnapshot } from "./type-schema";

export const ATTRIBUTE_TYPE_SEEDS: AttributeTypeSnapshot[] = [
  ...STANDARD_SPECIFICATIONS,
  ...ENGINEERING_ATTRIBUTE_DEFINITIONS.filter(value => value.key !== "engineering_purpose").map(value => ({
    key: value.key, definition: attributeTypeDefinitionSchema.parse(value)
  })),
  ...["starting_current", "inrush_current"].map(key => ({ key, definition: attributeTypeDefinitionSchema.parse({
    label: key === "starting_current" ? "Starting Current" : "Inrush Current",
    description: "Manufacturer current under the recorded operating conditions.",
    category: "load", valueKind: "quantity", engineeringDimension: "current",
    canonicalUnit: "A", allowedUnits: ["mA", "A", "kA"], minimum: 0, precision: 6
  }) })),
  { key: "length", definition: attributeTypeDefinitionSchema.parse({
    label: "Length", description: "Manufacturer stated length.", category: "documentation",
    valueKind: "quantity", engineeringDimension: "length", canonicalUnit: "mm",
    allowedUnits: ["mm", "cm", "m"], minimum: 0, precision: 6
  }) },
  ...(["sccr", "breaking_capacity"] as const).map(key => ({ key: "conditional_" + key,
    definition: attributeTypeDefinitionSchema.parse({
      label: key === "sccr" ? "Conditional Short-circuit Current Rating" : "Breaking Capacity",
      description: "Current rating with its applicable voltage, supply nature, designation and source.",
      category: "protection", valueKind: "quantity", engineeringDimension: "current",
      canonicalUnit: "kA", allowedUnits: ["kA", "A"], minimum: 0, minimumExclusive: true,
      payloadKind: "short_circuit"
    }) })),
  { key: "terminal_conductor_limits", definition: attributeTypeDefinitionSchema.parse({
    label: "Terminal Conductor Limits", description: "Conductor range and termination conditions.",
    category: "conductor", valueKind: "range", engineeringDimension: "cross_section",
    canonicalUnit: "mm²", allowedUnits: ["mm²"], minimum: 0, minimumExclusive: true,
    payloadKind: "terminal_range"
  }) }
].map(({ key, definition }) => ({
  typeId: "attribute_type_" + key, revisionId: "attribute_type_" + key + "_v1",
  revisionNumber: 1, analysisKey: key, definition
}));
