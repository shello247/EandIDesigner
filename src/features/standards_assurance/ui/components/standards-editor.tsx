"use client";
import { useRef, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { getRequirementAction, saveStandardsContentAction } from "../../api/actions";
import type { ContentByKind, EntityKind, ProfileEntry } from "../../data/schema";
import type { Revision } from "../../types";
import { PinnedRevision, RevisionPicker } from "./revision-picker";
type Field = { key: string; label: string; multiline?: boolean; options?: string[]; help?: string; sourceKind?: EntityKind };
const fields: Record<EntityKind, Field[]> = {
  reference: [
    { key: "title", label: "Title" }, { key: "kind", label: "Source type", options: ["international_standard", "client_specification", "manufacturer_instruction", "company_procedure"] },
    { key: "publisher", label: "Publisher" }, { key: "designation", label: "Designation" }, { key: "edition", label: "Edition" }, { key: "amendment", label: "Amendment / entry revision" },
    { key: "subject", label: "Subject", multiline: true }, { key: "sourceUrl", label: "Authoritative source link" },
    { key: "access", label: "Source access", options: ["catalogue_only", "full_source"] },
    { key: "materialExamined", label: "Authoritative material examined", multiline: true, help: "Identify the edition, document or database entry checked. Enter references and your own summary, not restricted source text." },
    { key: "rightsNotes", label: "Content access and reproduction notes", multiline: true }
  ],
  requirement: [
    { key: "title", label: "Title" }, { key: "sourceRevisionId", label: "Pinned source edition", sourceKind: "reference" },
    { key: "sourceStatus", label: "Source status", options: ["candidate", "source_checked"] },
    { key: "locator", label: "Clause, table or entry reference", help: "Required when marking a requirement Source Checked." },
    { key: "explanation", label: "Requirement explanation", multiline: true }, { key: "interpretation", label: "Our interpretation", multiline: true },
    { key: "applicability", label: "When it applies", multiline: true }, { key: "exclusions", label: "Exclusions", multiline: true },
    { key: "expectedBehavior", label: "Expected application behavior", multiline: true }, { key: "owner", label: "Owner" },
    { key: "verificationMethod", label: "Verification method", options: ["automated", "manual", "combined"] }
  ],
  implementation: [
    { key: "title", label: "Title" }, { key: "requirementRevisionId", label: "Pinned requirement", sourceKind: "requirement" },
    { key: "implementationStatus", label: "Implementation status", options: ["not_planned", "planned", "implemented"] },
    { key: "behavior", label: "What EI Designer does", multiline: true }, { key: "whereToSee", label: "Where to see it", multiline: true },
    { key: "verificationPlan", label: "How it is checked", multiline: true }, { key: "limitations", label: "Limitations and manual responsibilities", multiline: true }
  ],
  profile: [{ key: "title", label: "Title" }, { key: "purpose", label: "Purpose", multiline: true }, { key: "scope", label: "Scope", multiline: true },
    { key: "clientReference", label: "Client reference" }, { key: "projectReference", label: "Project reference", help: "Descriptive metadata; this does not attach the profile to a drawing." }]
};
export function defaultContent(kind: EntityKind): Record<string, unknown> {
  const base: Record<string, unknown> = Object.fromEntries(fields[kind].map(field => [field.key, field.options?.[0] ?? ""]));
  return { ...base, status: "active", ...(kind === "implementation" ? { controls: [], technicalReferences: [] } : {}), ...(kind === "profile" ? { entries: [] } : {}) };
}
export const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
export function StandardsEditor({ kind, revision, preset, onClose, onSaved }: {
  kind: EntityKind; revision?: Revision; preset?: Record<string, unknown>; onClose: () => void; onSaved: (revision: Revision) => void;
}) {
  const initial = revision ? { ...revision.content } : { ...defaultContent(kind), ...preset };
  const [content, setContent] = useState<Record<string, unknown>>(initial), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<Field | null>(null), [dirty, setDirty] = useState(false);
  const operationId = useRef<string | null>(null);
  function change(key: string, value: unknown) { setContent(previous => ({ ...previous, [key]: value })); setDirty(true); operationId.current = null; }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    operationId.current ??= crypto.randomUUID();
    try {
      const normalized = kind === "implementation" ? { ...content, technicalReferences: (content.technicalReferences as string[]).map(value => value.trim()).filter(Boolean) } : content;
      const result = await saveStandardsContentAction({ kind, entityId: revision?.entityId ?? null, expectedRevisionId: revision?.id ?? null, operationId: operationId.current, content: normalized });
      if (result.ok) onSaved(result.data);
      else setError(result.error);
    } catch { setError("Connection interrupted. Your draft is retained; retry to check the same operation."); }
    finally { setBusy(false); }
  }
  const controls = (content.controls ?? []) as ContentByKind["implementation"]["controls"];
  return <EngineeringDialog title={(revision ? "Edit " : "Add ") + (kind === "reference" ? "source" : kind)} subtitle={revision ? "Saving creates a new revision. Earlier evidence and snapshots are retained." : "Record your own explanation and authoritative source references."} compact dirty={dirty} busy={busy} onClose={onClose}>
    <form className="standards-form" onSubmit={submit}>
      <fieldset disabled={busy} className="standards-form-body">
        {fields[kind].map(field => <label key={field.key} className={"standards-field " + (field.multiline || field.sourceKind || field.key === "title" ? "wide" : "")}><span>{field.label}</span>
          {field.sourceKind ? <div className="standards-card flex items-center justify-between gap-3"><PinnedRevision kind={field.sourceKind} revisionId={String(content[field.key] ?? "")}/><button type="button" className="standards-button" aria-label="Choose" onClick={() => setPicker(field)}>Choose</button></div>
          : field.options ? <select aria-label={field.label} className="field-input" value={String(content[field.key] ?? "")} onChange={event => change(field.key, event.target.value)}>{field.options.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
          : field.multiline ? <textarea aria-label={field.label} className="field-input" value={String(content[field.key] ?? "")} onChange={event => change(field.key, event.target.value)}/>
          : <input aria-label={field.label} className="field-input" value={String(content[field.key] ?? "")} onChange={event => change(field.key, event.target.value)} readOnly={!!revision && kind === "reference" && ["publisher", "designation", "edition", "amendment"].includes(field.key)}/>}
          {field.help && <small>{field.help}</small>}</label>)}
        {kind === "implementation" && <><div className="standards-field wide"><span>Implementation controls</span>{controls.map((control, index) => <div key={index} className="standards-control-row"><input className="field-input" aria-label={"Control " + (index + 1) + " title"} placeholder="Control title" value={control.title} onChange={e => change("controls", controls.map((row, i) => i === index ? { ...row, title: e.target.value } : row))}/><textarea className="field-input" aria-label={"Control " + (index + 1) + " description"} placeholder="How the control behaves" value={control.description} onChange={e => change("controls", controls.map((row, i) => i === index ? { ...row, description: e.target.value } : row))}/><button type="button" className="standards-button self-end" onClick={() => change("controls", controls.filter((_, i) => i !== index))}>Remove control</button></div>)}<button type="button" className="standards-button self-start" disabled={controls.length >= 40} onClick={() => change("controls", [...controls, { title: "", description: "" }])}>Add control</button></div>
        <label className="standards-field wide"><span>Technical references</span><textarea className="field-input" placeholder="One code, rule or test reference per line" value={((content.technicalReferences ?? []) as string[]).join("\n")} onChange={event => change("technicalReferences", event.target.value.split("\n"))}/></label></>}
        {kind === "profile" && <ProfileEntries entries={(content.entries ?? []) as ProfileEntry[]} onChange={entries => change("entries", entries)}/>}
        <label className="standards-field"><span>Lifecycle</span><select aria-label="Lifecycle" className="field-input" value={String(content.status)} onChange={e => change("status", e.target.value)}><option value="active">Active</option><option value="retired">Retired</option></select><small>Retirement preserves previous revisions and snapshots.</small></label>
      </fieldset>
      {error && <div role="alert" className="standards-error">{error}</div>}
      <footer className="standards-form-footer"><button type="button" className="standards-button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes to this entry?")) onClose(); }}>Cancel</button><button type="submit" className="standards-button primary" disabled={busy}>{busy ? "Saving…" : "Save revision"}</button></footer>
    </form>
    {picker?.sourceKind && <RevisionPicker kind={picker.sourceKind} onClose={() => setPicker(null)} onPick={row => { change(picker.key, row.revisionId); setPicker(null); }}/>}
  </EngineeringDialog>;
}
function ProfileEntries({ entries, onChange }: { entries: ProfileEntry[]; onChange: (entries: ProfileEntry[]) => void }) {
  const [picking, setPicking] = useState(false), [error, setError] = useState("");
  function update(index: number, changes: Partial<ProfileEntry>) { onChange(entries.map((entry, i) => i === index ? { ...entry, ...changes } : entry)); }
  return <div className="standards-field wide"><span>Selected requirement revisions ({entries.length})</span><small>Entries pin exact revisions. Conflicts remain unresolved.</small>
    {entries.map((entry, index) => <div className="standards-card" key={entry.requirementRevisionId}><PinnedRevision kind="requirement" revisionId={entry.requirementRevisionId}/><div className="mt-2 grid grid-cols-2 gap-2">
      <label className="standards-field"><span>Applicability</span><select aria-label="Applicability" className="field-input" value={entry.applicability} onChange={e => update(index, { applicability: e.target.value as ProfileEntry["applicability"] })}><option value="applies">Applies</option><option value="excluded">Excluded With Reason</option><option value="unresolved">Unresolved</option></select></label>
      <ImplementationChoice requirementRevisionId={entry.requirementRevisionId} selected={entry.implementationRevisionId} onChange={id => update(index, { implementationRevisionId: id })}/>
      <label className="standards-field wide"><span>Applicability rationale</span><textarea className="field-input" value={entry.rationale} onChange={e => update(index, { rationale: e.target.value })}/></label>
      <label className="standards-field wide"><span>Unresolved conflict</span><input className="field-input" value={entry.conflict} onChange={e => update(index, { conflict: e.target.value, ...(e.target.value ? { applicability: "unresolved" as const } : {}) })}/></label>
    </div><button type="button" className="standards-button" onClick={() => onChange(entries.filter((_, i) => i !== index))}>Remove from profile</button></div>)}
    {error && <p role="alert">{error}</p>}<button type="button" className="standards-button self-start" disabled={entries.length >= 250} onClick={() => setPicking(true)}>Add requirement to profile</button>
    {picking && <RevisionPicker kind="requirement" onClose={() => setPicking(false)} onPick={row => {
      if (entries.some(entry => entry.requirementRevisionId === row.revisionId)) setError("This requirement revision is already selected.");
      else { onChange([...entries, { requirementRevisionId: row.revisionId, implementationRevisionId: null, applicability: "unresolved", rationale: "Applicability requires review.", conflict: "" }]); setError(""); }
      setPicking(false);
    }}/>}
  </div>;
}
function ImplementationChoice({ requirementRevisionId, selected, onChange }: { requirementRevisionId: string; selected: string | null; onChange: (id: string | null) => void }) {
  const [options, setOptions] = useState<Revision<"implementation">[]>([]), [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  return <label className="standards-field"><span>Implementation revision</span>{!loaded ? <button type="button" className="standards-button" aria-label={selected ? "Change pinned implementation" : "Choose implementation"} onClick={async () => { const result = await getRequirementAction(requirementRevisionId); if (result.ok) { setOptions(result.data.implementations); setLoaded(true); } else setError(result.error); }}>{selected ? "Change pinned implementation" : "Choose implementation"}</button> : <select aria-label="Implementation revision" className="field-input" value={selected ?? ""} onChange={e => onChange(e.target.value || null)}><option value="">Not mapped</option>{options.map(option => <option key={option.id} value={option.id}>{option.content.title} · R{option.number}</option>)}</select>}{selected && <PinnedRevision kind="implementation" revisionId={selected}/>}<small>{error || "Only mappings for this exact requirement revision are offered."}</small></label>;
}
