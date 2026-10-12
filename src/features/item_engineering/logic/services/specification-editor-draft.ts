import { convertEngineeringUnit } from "@/features/engineering_attributes/api/public";
import { type ItemProfileV3, type SpecificationEntry } from "../../data/profile-v3-schema";
import { buildPayload, payloadDraft, type ValueDraft } from "./attribute-value-draft";
export type SpecificationDraft = { entry: SpecificationEntry; availability: "recorded" | "missing" | "needs_review"; value: ValueDraft };
export type SpecificationEditorDraft = { profile: Omit<ItemProfileV3,"entries">; rows: SpecificationDraft[] };
export function editSpecification(entry: SpecificationEntry): SpecificationDraft {
  const p = entry.payload;
  return { entry: structuredClone(entry), availability: p.kind === "unresolved" ? p.status : "recorded",
    value: p.kind === "unresolved" ? { unit: entry.type.definition.canonicalUnit ?? "" } : p.kind === "conductor_size" ? { gauge: p.gauge, unit: "AWG" } : payloadDraft(p) };
}
export function editSpecificationProfile(profile: ItemProfileV3): SpecificationEditorDraft {
  const { entries, ...metadata } = structuredClone(profile); return { profile: metadata, rows: entries.map(editSpecification) };
}
export function materializeSpecificationDraft(draft: SpecificationEditorDraft): { profile: ItemProfileV3; errors: Record<string,string[]> } {
  const errors: Record<string,string[]> = {};
  const entries = draft.rows.map(row => {
    try {
      return { ...row.entry, payload: row.availability !== "recorded" ? { kind: "unresolved" as const, status: row.availability,
        reason: row.entry.payload.kind === "unresolved" ? row.entry.payload.reason : "" } : row.value.unit === "AWG" ?
        { kind: "conductor_size" as const, system: "AWG" as const, gauge: row.value.gauge ?? "" } : buildPayload(row.entry.type.definition,row.value) };
    } catch (error) { errors[`rows.${row.entry.id}.payload`] = [error instanceof Error ? error.message : "Check this value."]; return row.entry; }
  });
  return { profile: { ...draft.profile, entries }, errors };
}
export function changeSpecificationUnit(row: SpecificationDraft, unit: string): SpecificationDraft {
  const value = { ...row.value }; const from = value.unit || row.entry.type.definition.canonicalUnit;
  if (from === "AWG" || unit === "AWG") return { ...row, availability: "missing", value: { unit } };
  if (from && from !== unit) for (const key of ["value","minimum","maximum","currentKa"]) {
    if (!value[key]?.trim()) continue;
    const result = convertEngineeringUnit(Number(value[key]), row.entry.type.definition.engineeringDimension ?? "", from, unit);
    if (!result.ok) throw new Error(result.message); value[key] = String(result.value);
  }
  value.unit = unit; return { ...row, value };
}
