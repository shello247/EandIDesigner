import type { SpecificationDraft,SpecificationEditorDraft } from "./specification-editor-draft";
export type AttributeConflict = { path: string; label: string; saved: unknown; draft: unknown };
// The editable value is authoritative. entry.payload is the last loaded value
// and can differ after an in-flight save; comparing both duplicates conflicts.
function comparable(row:SpecificationDraft){
  const {payload,...entry}=row.entry;
  return {...row,entry,unresolvedReason:payload.kind==="unresolved"?payload.reason:""};
}
export function reconcileSpecificationDraft(base: SpecificationEditorDraft, local: SpecificationEditorDraft, remote: SpecificationEditorDraft, choices: Record<string,"draft"|"saved"> = {}) {
  const conflicts: AttributeConflict[] = []; const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  function merge(before: unknown, ours: unknown, theirs: unknown, path: string, label: string): unknown {
    if (same(ours,before)) return structuredClone(theirs); if (same(theirs,before) || same(ours,theirs)) return structuredClone(ours);
    if (before && ours && theirs && [before,ours,theirs].every(v => typeof v === "object" && !Array.isArray(v))) {
      const b = before as Record<string,unknown>, l = ours as Record<string,unknown>, r = theirs as Record<string,unknown>;
      return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])].map(key => [key,merge(b[key],l[key],r[key],`${path}.${key}`,`${label} / ${key}`)]).filter(([,v]) => v !== undefined));
    }
    if (!choices[path]) conflicts.push({ path,label,saved: theirs,draft: ours });
    return structuredClone(choices[path] === "saved" ? theirs : ours);
  }
  const maps = [base,local,remote].map(p => new Map(p.rows.map(row => [row.entry.id,comparable(row)])));
  const order = [...new Set([...remote.rows,...local.rows,...base.rows].map(row => row.entry.id))];
  const rows = order.flatMap(id => {
    const merged=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),`rows.${id}`,maps[1].get(id)?.entry.title ?? maps[2].get(id)?.entry.title ?? id) as ReturnType<typeof comparable>|undefined;
    if(!merged)return [];
    const {unresolvedReason,...row}=merged;
    const original=[...local.rows,...remote.rows,...base.rows].find(r=>r.entry.id===id)!;
    return [{...row,entry:{...row.entry,payload:row.availability==="recorded"?original.entry.payload:{kind:"unresolved" as const,status:row.availability,reason:unresolvedReason}}}];
  });
  return { draft: { profile: merge(base.profile,local.profile,remote.profile,"profile","Product connections and modes") as SpecificationEditorDraft["profile"],rows },conflicts };
}
export function readableConflictValue(value: unknown): string {
  if (value === undefined) return "Removed"; if (value === null || value === "") return "Empty";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(readableConflictValue).join("; ") || "None";
  return Object.entries(value).filter(([key]) => !["type","id","contentHash","revisionId"].includes(key)).map(([key,v]) => `${key}: ${readableConflictValue(v)}`).join(" · ");
}
