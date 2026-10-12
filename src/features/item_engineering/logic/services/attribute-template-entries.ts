import { ATTRIBUTE_TEMPLATES, type AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import type { SpecificationEntry } from "../../data/profile-v3-schema";

export function createTemplateEntries(templateId: string, types: AttributeTypeSnapshot[], groupKey: string, newId: () => string) {
  const template = ATTRIBUTE_TEMPLATES.find(t => t.id === templateId);
  if (!template) throw new Error("Specification template was not found.");
  const missingTypes: string[] = [];
  const entries: SpecificationEntry[] = template.analysisKeys.flatMap(key => {
    const type = types.find(t => t.analysisKey === key);
    if (!type) { missingTypes.push(key); return []; }
    return [{ id: newId(), groupKey, title: type.definition.label, description: "", type,
      payload: { kind: "unresolved", status: "missing", reason: "" }, source: { kind: "manufacturer" }, scope: { kind: "device" },
      modes: [], condition: "", evidence: [], ratingBasis: key === "io_isolation_test" ? "test" : "unspecified" } satisfies SpecificationEntry];
  });
  return { entries, missingTypes };
}
