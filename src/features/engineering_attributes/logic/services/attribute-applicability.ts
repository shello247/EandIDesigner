import type { AttributeTypeSnapshot } from "../../data/type-schema";

/** Recommendations affect discovery and warnings, never structural value validity. */
export function attributeApplicability(type: AttributeTypeSnapshot, deviceType?: string, scope?: string) {
  const classes = type.definition.applicableAssetTypes;
  const recommended = !deviceType || !classes?.length || classes.includes(deviceType);
  const scopeMatch = !scope || scope === "device" ||
    scope.startsWith("supply") && ["supply", "load"].includes(type.definition.category) ||
    scope === "terminal" && type.definition.category === "conductor" ||
    scope === "channel" && type.analysisKey?.startsWith("io_");
  return { recommended, score: (recommended ? 20 : 0) + (scopeMatch ? 5 : 0),
    warnings: recommended ? [] : [`${type.definition.label} is not usually suggested for ${deviceType?.replaceAll("_", " ")}. It can still be recorded.`] };
}

export function rankAttributeTypes<T extends AttributeTypeSnapshot>(types: T[], input: { search?: string; deviceType?: string; scope?: string }) {
  const search = input.search?.trim().toLocaleLowerCase() ?? "";
  return types.filter(type => !search || [type.definition.label, type.definition.description, type.analysisKey ?? ""].join(" ").toLocaleLowerCase().includes(search))
    .map(type => ({ ...type, suggestion: attributeApplicability(type, input.deviceType, input.scope) }))
    .sort((a, b) => b.suggestion.score - a.suggestion.score || a.definition.label.localeCompare(b.definition.label) || a.typeId.localeCompare(b.typeId));
}
