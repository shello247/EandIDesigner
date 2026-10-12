import { ATTRIBUTE_TYPE_SEEDS } from "@/features/engineering_attributes/api/public";
import type { ItemEngineeringProfile } from "../../data/schema";
import { itemProfileV2Schema, type ItemAttributeEntry, type ItemProfileV2 } from "../../data/attribute-schema";

const seed = (key: string) => {
  const type = ATTRIBUTE_TYPE_SEEDS.find(value => value.analysisKey === key);
  if (!type) throw new Error("Legacy attribute definition is unavailable: " + key);
  return type;
};
/** Read-only adapter. The original v1 object and its hash are never changed. */
export function projectItemAttributeProfile(profile: ItemEngineeringProfile | null): ItemProfileV2 {
  if (profile?.version === 3) throw new Error("Use the version 3 specification workspace for this Item.");
  if (!profile) return { version: 2, deviceType: "other", groups: [], entries: [] };
  if (profile.version === 2) return structuredClone(profile);
  const groups = profile.groups.map(({ key, label, context }) => ({ key, label, context }));
  const entries: ItemAttributeEntry[] = profile.groups.flatMap(group => group.attributes.values.map(value => {
    const type = seed(value.definitionKey);
    const { definitionKey: _key, definitionVersion: _version, source, ...payload } = value;
    void _key; void _version;
    return { id: "legacy:" + group.key + ":" + value.definitionKey, groupKey: group.key,
      title: type.definition.label, description: type.definition.description, type, payload, source };
  }));
  for (const rating of profile.shortCircuitRatings) {
    const { key, groupKey, source, ...payload } = rating;
    entries.push({ id: "rating:" + key, groupKey, title: rating.designation, description: "",
      type: seed("conditional_" + rating.ratingType), payload: { kind: "short_circuit", ...payload }, source });
  }
  if (profile.terminalConductorRanges.length) {
    let key = "legacy-terminal-limits";
    while (groups.some(group => group.key === key)) key += "-";
    groups.push({ key, label: "Terminal conductor limits", context: "device" });
    for (const range of profile.terminalConductorRanges) {
      const { key: rangeKey, source, ...payload } = range;
      entries.push({ id: "range:" + rangeKey, groupKey: key, title: "Terminal conductor limits",
        description: "", type: seed("terminal_conductor_limits"), payload: { kind: "terminal_range", ...payload }, source });
    }
  }
  return itemProfileV2Schema.parse({ version: 2, deviceType: profile.deviceType, groups, entries });
}
export function itemAttributeDisplay(entry: ItemAttributeEntry) {
  const p = entry.payload;
  if (p.kind === "short_circuit") return { unit: p.displayUnit ?? "kA", value: String(p.currentKa * (p.displayUnit === "A" ? 1000 : 1)), detail: `${p.voltageV} V ${p.supplyNature.toUpperCase()} · ${p.conditions}` };
  if (p.kind === "terminal_range") return { unit: "mm²", value: `${p.minimumMm2}–${p.maximumMm2}`, detail: `${p.terminalKeys.join(", ")} · ${p.conductorClass} · ${p.termination}` };
  if (p.kind === "range") return { unit: p.unit, value: `${p.minimum}–${p.maximum}`, detail: "" };
  return { unit: p.kind === "quantity" ? p.unit : "—",
    value: p.kind === "choice" ? entry.type.definition.choices?.find(choice => choice.value === p.value)?.label ?? p.value : String(p.value), detail: "" };
}
