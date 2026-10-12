import type { AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import { normalizeEngineeringValue } from "@/features/engineering_attributes/api/public";
import type { SpecificationEntry } from "../../data/profile-v3-schema";

/** Dry-run only: a proposed new entry never rewrites a retained text type or revision. */
export function previewCatalogueReconciliation(entries: SpecificationEntry[], replacements: Record<string, AttributeTypeSnapshot>) {
  return entries.flatMap(entry => {
    const target = replacements[entry.type.typeId];
    if (!target || entry.payload.kind !== "text") return [];
    const text = entry.payload.value.trim().replaceAll("−", "-");
    const match = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*(?:to|–)\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)))?\s+(.+)$/);
    const payload = match ? match[2] === undefined ? { kind: "quantity" as const, value: Number(match[1]), unit: match[3] } :
      { kind: "range" as const, minimum: Number(match[1]), maximum: Number(match[2]), unit: match[3] } : null;
    const compatible = payload && target.definition.valueKind === payload.kind && target.definition.allowedUnits?.includes(payload.unit) &&
      normalizeEngineeringValue({ value: payload, dimension: target.definition.engineeringDimension, canonicalUnit: target.definition.canonicalUnit }).ok;
    return [{ entryId: entry.id, original: entry.payload, targetTypeRevisionId: target.revisionId,
      status: compatible ? "proposed" as const : "needs_review" as const,
      proposedPayload: compatible ? payload : null,
      message: compatible ? "Explicit review required; retain the original entry and evidence in history." : "Ambiguous or unsupported text remains unchanged." }];
  });
}
