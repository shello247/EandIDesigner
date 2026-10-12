"use client";
import { useEffect,useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { ATTRIBUTE_TEMPLATES,type AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import { listAttributeTypesAction } from "@/features/engineering_attributes/api/actions";
import { itemProfileV3Schema } from "../../api/public";
import { createTemplateEntries } from "../../logic/services/attribute-template-entries";
import { previewAttributePaste } from "../../logic/services/attribute-paste";
import { editSpecification,materializeSpecificationDraft,type SpecificationDraft,type SpecificationEditorDraft } from "../../logic/services/specification-editor-draft";
export function AttributePasteDialog({ mode,draft,onAdd,onClose }: { mode: "paste"|"template"; draft: SpecificationEditorDraft; onAdd: (rows: SpecificationDraft[]) => void; onClose: () => void }) {
  const [types,setTypes] = useState<AttributeTypeSnapshot[]>([]); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [text,setText] = useState(""); const [template,setTemplate] = useState(ATTRIBUTE_TEMPLATES.find(t => t.deviceTypes.includes(draft.profile.deviceType))?.id ?? "io_module");
  const [preview,setPreview] = useState<SpecificationDraft[] | null>(null);
  useEffect(() => { let active = true; (async () => {
    try {
      const first = await listAttributeTypesAction({}); if (!first.ok) throw new Error(first.error);
      const rest = await Promise.all(Array.from({ length: first.data.pages-1 },(_,i) => listAttributeTypesAction({ page: i+2 })));
      const all = [first,...rest].flatMap(result => { if (!result.ok) throw new Error(result.error); return result.data.items; });
      if (active) setTypes(all.map(t => ({ typeId: t.typeId,revisionId: t.revisionId,revisionNumber: t.revisionNumber,analysisKey: t.analysisKey,definition: t.definition })));
    } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Types could not be loaded."); } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; },[]);
  const makePreview = () => {
    setError(""); setPreview(null); const groupKey = draft.profile.groups[0]?.key ?? "device";
    const result = mode === "paste" ? previewAttributePaste(text,types,groupKey,() => crypto.randomUUID()) : (() => {
      const result = createTemplateEntries(template,types,groupKey,() => crypto.randomUUID());
      return { rows: result.entries.map(editSpecification),errors: result.missingTypes.map(key => ({ row: 0,message: `Template type ${key} is unavailable.` })) };
    })();
    if (result.errors.length) { setError(result.errors.map(e => `${e.row ? `Row ${e.row}: ` : ""}${e.message}`).join("\n")); return; }
    const candidate = materializeSpecificationDraft({ ...draft,profile: { ...draft.profile,groups: draft.profile.groups.length ? draft.profile.groups : [{ key: groupKey,label: "Device",context: "device" }] },rows: [...draft.rows,...result.rows] });
    const checked = itemProfileV3Schema.safeParse(candidate.profile);
    const issues = [...Object.values(candidate.errors).flat(),...(!checked.success ? checked.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) : [])];
    if (issues.length) { setError(issues.join("\n")); return; }
    setPreview(result.rows);
  };
  return <EngineeringDialog title={mode === "paste" ? "Paste specifications" : "Add from template"} onClose={onClose}>
    {mode === "paste" ? <><p className="text-sm">Paste tab-separated columns: Specification, Value, Unit, Condition, Source. A blank value stays Missing. Use a range such as −20 to 70.</p><textarea aria-label="Pasted specification rows" className="field-input mt-3 min-h-44 w-full font-mono text-xs" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} /></> :
      <label className="block text-sm">Template<select aria-label="Specification template" className="field-input mt-2 w-full" value={template} onChange={e => { setTemplate(e.target.value); setPreview(null); }}>{ATTRIBUTE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select><span className="mt-2 block text-xs">Templates suggest information to record. All values begin as Missing.</span></label>}
    {error && <p role="alert" className="my-3 whitespace-pre-wrap rounded bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {preview && <div className="my-4 max-h-72 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Specification</th><th className="p-2">Value</th><th className="p-2">Condition</th></tr></thead><tbody>{preview.map(row => <tr key={row.entry.id} className="border-t"><td className="p-2">{row.entry.title}</td><td className="p-2">{row.availability === "recorded" ? Object.values(row.value).join(" · ") : "Missing"}</td><td className="p-2">{row.entry.condition || "Device"}</td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex justify-end gap-2"><button className="icon-button" disabled={loading} onClick={makePreview}>{loading ? "Loading types…" : "Preview rows"}</button><button className="icon-button icon-button-primary" disabled={!preview?.length} onClick={() => { if (preview) { onAdd(preview); onClose(); } }}>Add rows to draft</button></div>
  </EngineeringDialog>;
}
