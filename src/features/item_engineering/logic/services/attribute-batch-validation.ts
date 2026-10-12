import { z } from "zod";
import { attributeApplicability, type AttributeTypeOption, attributeTypeSnapshotSchema } from "@/features/engineering_attributes/api/public";
import { itemProfileV3Schema, type ItemProfileV3 } from "../../data/profile-v3-schema";
import type { ItemAttributeBatch } from "../../data/attribute-batch-schema";

export function applyAttributeBatch(current: ItemProfileV3, batch: ItemAttributeBatch, types: AttributeTypeOption[]) {
  const profile = structuredClone(current); Object.assign(profile, batch.profile ?? {});
  const fail = (id: string, field: string, message: string): never => { throw new z.ZodError([{ code: "custom", path: ["rows",id,field], message }]); };
  const byId = new Map(types.map(t => [t.revisionId,t]));
  for (const id of batch.removals) if (!profile.entries.some(e => e.id === id)) fail(id,"id","This specification no longer exists.");
  profile.entries = profile.entries.filter(e => !batch.removals.includes(e.id));
  for (const [operation, rows] of [["add", batch.additions],["update",batch.updates]] as const) for (const row of rows) {
    const existing = profile.entries.find(e => e.id === row.id);
    if (operation === "add" && existing || operation === "update" && !existing) fail(row.id,"id","The specification changed; review the latest revision.");
    const type = byId.get(row.typeRevisionId);
    if (!type) return fail(row.id,"type","Attribute type revision was not found.");
    if (type.status !== "active" && existing?.type.revisionId !== type.revisionId) fail(row.id,"type","This type was retired. Choose an active type.");
    const { typeRevisionId: _typeId, ...fields } = row; void _typeId;
    const entry = { ...fields, type: attributeTypeSnapshotSchema.parse({ typeId: type.typeId, revisionId: type.revisionId,
      revisionNumber: type.revisionNumber, analysisKey: type.analysisKey, definition: type.definition }) };
    if (existing) profile.entries[profile.entries.indexOf(existing)] = entry; else profile.entries.push(entry);
  }
  const result = itemProfileV3Schema.safeParse(profile);
  if (!result.success) throw new z.ZodError(result.error.issues.map(issue => ({ ...issue,
    path: issue.path[0] === "entries" && typeof issue.path[1] === "number" ? ["rows", profile.entries[issue.path[1]].id, ...issue.path.slice(2)] : issue.path })));
  const warnings = profile.entries.flatMap(entry => attributeApplicability(entry.type, profile.deviceType, entry.scope.kind).warnings.map(message => ({ entryId: entry.id, message })));
  return { profile: result.data, warnings, summary: { added: batch.additions.length, updated: batch.updates.length, removed: batch.removals.length } };
}
export function buildAttributeBatch(itemId: string, expectedLatestRevisionId: string | null, saved: ItemProfileV3, draft: ItemProfileV3): ItemAttributeBatch {
  const change = (row: ItemProfileV3["entries"][number]) => { const { type, ...fields } = row; return { ...fields, typeRevisionId: type.revisionId }; };
  const before = new Map(saved.entries.map(e => [e.id,e])); const after = new Set(draft.entries.map(e => e.id));
  const { version: _version, entries: _entries, ...metadata } = draft; void _version; void _entries;
  return { itemId, expectedLatestRevisionId, profile: metadata,
    additions: draft.entries.filter(e => !before.has(e.id)).map(change),
    updates: draft.entries.filter(e => before.has(e.id) && JSON.stringify(before.get(e.id)) !== JSON.stringify(e)).map(change),
    removals: saved.entries.filter(e => !after.has(e.id)).map(e => e.id) };
}
