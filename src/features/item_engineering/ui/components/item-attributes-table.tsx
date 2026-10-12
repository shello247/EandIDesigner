"use client";
import { useEffect, useState, Fragment, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Copy, Plus, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { WorkspaceHeading } from "@/shared/ui/item-workspace-presentation";
import { attributeApplicability, type AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import type { AttributeEvidence, SpecificationEntry } from "../../api/public";
import { loadSpecificationWorkspaceAction, previewItemAttributeBatchAction, saveItemAttributeBatchAction } from "../../api/batch-actions";
import { buildAttributeBatch } from "../../logic/services/attribute-batch-validation";
import { editSpecification, editSpecificationProfile, materializeSpecificationDraft, type SpecificationDraft, type SpecificationEditorDraft } from "../../logic/services/specification-editor-draft";
import { acknowledgeSectionSave, sectionIsDirty } from "../../logic/services/item-workspace-state";
import { useItemWorkspace, ItemWorkspaceMessage, itemWorkspaceDate } from "./item-workspace-context";
import { SpecificationValueEditor } from "./specification-value-editor";
import { AttributeEvidenceEditor } from "./attribute-evidence-editor";
import { AttributePasteDialog } from "./attribute-paste-dialog";
import { AttributeConflictReview } from "./attribute-conflict-review";
import { ItemChannelTable } from "./item-channel-table";
import { AttributeOperatingModes } from "./attribute-operating-modes";
import { AttributeTypePicker } from "./attribute-type-picker";
const TypesDialog = dynamic(() => import("@/features/engineering_attributes/ui/type-library").then(m => m.AttributeTypesDialog));
export type SpecificationWorkspace = Extract<Awaited<ReturnType<typeof loadSpecificationWorkspaceAction>>,{ok:true}>["data"];
function LazyDetails({ label,children }: { label: string; children: ReactNode }) {
  const [open,setOpen] = useState(false);
  return <details className="mt-2" onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-xs">{label}</summary>{open && children}</details>;
}

export function ItemAttributesTable({ workspace, onSaved }: { workspace: SpecificationWorkspace; onSaved: (saved: SpecificationWorkspace) => void }) {
  const { itemId,readOnly,busy,mutate,setDirty,reviewRevision } = useItemWorkspace();
  const [state,setState] = useState(() => ({ saved: editSpecificationProfile(workspace.profile),draft: editSpecificationProfile(workspace.profile),revisionId: workspace.revisionId }));
  const [message,setMessage] = useState(""); const [error,setError] = useState(""); const [errors,setErrors] = useState<Record<string,string[]>>({});
  const [search,setSearch] = useState(""); const [picker,setPicker] = useState(false); const [types,setTypes] = useState(false);
  const [sharedSource,setSharedSource] = useState<AttributeEvidence[]>([]);
  const [insert,setInsert] = useState<"paste"|"template"|null>(null);
  const [latest,setLatest] = useState<SpecificationWorkspace | null>(null);
  const dirty = sectionIsDirty(state);
  useEffect(() => { setDirty("engineering-attributes",dirty); },[dirty,setDirty]);
  useEffect(() => () => setDirty("engineering-attributes",false),[setDirty]);
  if (state.revisionId !== workspace.revisionId && !dirty) {
    const next = editSpecificationProfile(workspace.profile);
    setState({ saved: next,draft: next,revisionId: workspace.revisionId });
  }
  const change = (draft: SpecificationEditorDraft) => { setState(current => ({ ...current,draft })); setMessage(""); };
  const updateRow = (row: SpecificationDraft) => change({ ...state.draft,rows: state.draft.rows.map(old => old.entry.id === row.entry.id ? row : old) });
  const add = (type: AttributeTypeSnapshot) => {
    const groups = state.draft.profile.groups.length ? state.draft.profile.groups : [{ key: "device",label: "Device",context: "device" as const }];
    const entry: SpecificationEntry = { id: crypto.randomUUID(),groupKey: groups[0].key,title: type.definition.label,description: "",type,
      payload: { kind: "unresolved",status: "missing",reason: "" },source: { kind: "manufacturer" },scope: { kind: "device" },modes: [],condition: "",ratingBasis: "unspecified",evidence: structuredClone(sharedSource) };
    change({ profile: { ...state.draft.profile,groups },rows: [...state.draft.rows,editSpecification(entry)] });
  };
  const submit = async (preview: boolean) => {
    setError(""); setMessage(""); setErrors({});
    const submitted = structuredClone(state.draft); const materialized = materializeSpecificationDraft(submitted);
    if (Object.keys(materialized.errors).length) { setErrors(materialized.errors); setError("Correct the highlighted values. Blank values are not saved as zero."); return; }
    const saved = materializeSpecificationDraft(state.saved).profile;
    const batch = buildAttributeBatch(itemId,state.revisionId,saved,materialized.profile);
    try {
      if (preview) { const result = await previewItemAttributeBatchAction(batch);
        if (!result.ok) { setError(result.error); setErrors(result.fieldErrors ?? {}); return; }
        setMessage(`${result.data.summary.added} added, ${result.data.summary.updated} updated, ${result.data.summary.removed} removed. ${result.data.warnings.map(w => w.message).join(" ")}`); return;
      }
      const result = await mutate(async () => {
        const reply = await saveItemAttributeBatchAction(batch);
        if (!reply.ok) { setErrors(reply.fieldErrors ?? {}); if (reply.code === "REVISION_CONFLICT") {
          const current = await loadSpecificationWorkspaceAction({ itemId }); if (current.ok) setLatest(current.data);
        } throw new Error(reply.error); }
        return { value: reply.data,revisionId: reply.data.revisionId };
      });
      setState(current => ({ ...acknowledgeSectionSave(current,submitted,editSpecificationProfile(result.profile)),revisionId: result.revisionId }));
      onSaved(result); setMessage(result.created ? "Specifications saved." : "No changes to save.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed. Your draft is retained."); }
  };
  const rows = state.draft.rows.filter(row => [row.entry.title,row.entry.type.definition.label,row.entry.condition,JSON.stringify(row.value)].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-4">
    <WorkspaceHeading title="Engineering Attributes" icon={SlidersHorizontal} detail={workspace.revisionNumber ? `Revision ${workspace.revisionNumber} · ${itemWorkspaceDate(workspace.updatedAt!)}` : "Provisional specifications"} />
    <div className="flex flex-wrap items-center gap-2">
      {!readOnly && <><button className="icon-button" onClick={() => setPicker(true)}><Plus size={15} />Add specification</button>
        <button className="icon-button" onClick={() => setInsert("template")}>Add from template</button>
        <button className="icon-button" onClick={() => setInsert("paste")}>Paste rows</button>
        <button className="icon-button" onClick={() => setTypes(true)}>Manage types</button></>}
      <input className="field-input min-w-48 flex-1" aria-label="Search recorded specifications" placeholder="Search recorded specifications" value={search} onChange={e => setSearch(e.target.value)} />
      <span role="status" className="text-xs text-slate-600">{busy ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</span>
      {!readOnly && <><button className="icon-button" disabled={busy || !dirty} onClick={() => { setState(current => ({ ...current,draft: current.saved })); setErrors({}); setError(""); }}>Cancel changes</button>
        <button className="icon-button" disabled={busy || !dirty} onClick={() => void submit(true)}>Review changes</button>
        <button className="icon-button icon-button-primary" disabled={busy || !dirty} onClick={() => void submit(false)}><Save size={15} />Save changes</button></>}
    </div>
    <ItemWorkspaceMessage message={error || null} kind="error" /><ItemWorkspaceMessage message={message || null} kind="success" />
    {latest && <AttributeConflictReview base={state.saved} draft={state.draft} saved={editSpecificationProfile(latest.profile)} onClose={() => setLatest(null)} onReconcile={async combined => {
      await reviewRevision(latest.revisionId); onSaved(latest);
      setState({ saved: editSpecificationProfile(latest.profile),draft: combined,revisionId: latest.revisionId }); setLatest(null); setError(""); setMessage("Combined draft ready. Review it, then save to retry.");
    }} />}
    <AttributeOperatingModes modes={state.draft.profile.modes} disabled={readOnly} onChange={modes => change({ ...state.draft,profile: { ...state.draft.profile,modes } })} />
    {!readOnly && <LazyDetails label="Shared source for new specifications"><div className="mt-3"><AttributeEvidenceEditor itemId={itemId} value={sharedSource} onChange={setSharedSource} /></div></LazyDetails>}
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-[13px]" aria-label="Engineering specifications" onKeyDown={event => {
      if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement || !(event.target instanceof HTMLInputElement)) return;
      const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>("input:not(:disabled)")); const index = fields.indexOf(event.target);
      fields[index + (event.shiftKey ? -1 : 1)]?.focus(); event.preventDefault();
    }}><thead className="border-b bg-slate-50"><tr>{["Specification","Value","Applies to / Condition","Source"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map(row => {
        const entry = row.entry; const rowErrors = Object.entries(errors).filter(([key]) => key.includes(entry.id)).flatMap(([,values]) => values);
        const scope = entry.scope;
        return <Fragment key={entry.id}><tr className={rowErrors.length ? "bg-rose-50" : "even:bg-slate-50/60"}>
          <td className="w-[22%] p-3 align-top"><p className="font-semibold">{entry.title}</p><p className="text-xs text-slate-500">{entry.type.definition.label}</p>
            <details className="mt-2"><summary className="cursor-pointer text-xs">Details and type revision</summary><label className="mt-2 block text-xs">Custom label<input disabled={readOnly} className="field-input w-full" value={entry.title} onChange={e => updateRow({ ...row,entry: { ...entry,title: e.target.value } })} /></label>
              <label className="mt-2 block text-xs">Description<textarea disabled={readOnly} className="field-input w-full" value={entry.description} onChange={e => updateRow({ ...row,entry: { ...entry,description: e.target.value } })} /></label>
              <p className="mt-2 text-xs">Type revision {entry.type.revisionNumber}. Historical Item revisions retain their recorded values.</p>
              {attributeApplicability(entry.type,state.draft.profile.deviceType).warnings.map(w => <p className="text-xs text-amber-800" key={w}>{w}</p>)}
            </details>
            {!readOnly && <div className="mt-2 flex gap-1"><button className="icon-button" aria-label={`Duplicate ${entry.title}`} onClick={() => change({ ...state.draft,rows: [...state.draft.rows,{ ...structuredClone(row),entry: { ...structuredClone(entry),id: crypto.randomUUID(),condition: entry.condition } }] })}><Copy size={13} /></button>
              <button className="icon-button" aria-label={`Remove ${entry.title}`} onClick={() => change({ ...state.draft,rows: state.draft.rows.filter(r => r.entry.id !== entry.id) })}><Trash2 size={13} /></button></div>}
          </td>
          <td className="w-[24%] p-3 align-top"><SpecificationValueEditor row={row} disabled={readOnly} onChange={updateRow} />{rowErrors.map((msg,i) => <p role="alert" className="mt-1 text-xs text-rose-800" key={i}>{msg}</p>)}</td>
          <td className="w-[26%] space-y-2 p-3 align-top"><select disabled={readOnly} aria-label={`${entry.title} scope`} className="field-input w-full" value={scope.kind} onChange={e => {
            const kind = e.target.value as SpecificationEntry["scope"]["kind"]; updateRow({ ...row,entry: { ...entry,scope: kind === "device" ? { kind } : { kind,id: "" } } });
          }}>{["device","supply_input","supply_output","channel","terminal"].map(kind => <option value={kind} key={kind}>{kind.replaceAll("_"," ")}</option>)}</select>
            {scope.kind !== "device" && (scope.kind === "channel" || scope.kind === "terminal" ? <select disabled={readOnly} aria-label={`${entry.title} scope identity`} className="field-input w-full" value={scope.id} onChange={e => updateRow({ ...row,entry: { ...entry,scope: { ...scope,id: e.target.value } } })}><option value="">Choose…</option>{(scope.kind === "channel" ? state.draft.profile.channels : state.draft.profile.terminals).map(target => <option key={target.id} value={target.id}>{target.number}</option>)}</select> :
              <input disabled={readOnly} className="field-input w-full" aria-label={`${entry.title} supply identity`} placeholder="Supply identifier" value={scope.id} onChange={e => updateRow({ ...row,entry: { ...entry,scope: { ...scope,id: e.target.value } } })} />)}
            {state.draft.profile.modes.map(mode => <select key={mode.id} disabled={readOnly} className="field-input w-full" aria-label={`${entry.title} ${mode.label}`} value={entry.modes.find(m => m.setId === mode.id)?.choiceId ?? ""} onChange={e => updateRow({ ...row,entry: { ...entry,modes: [...entry.modes.filter(m => m.setId !== mode.id),...(e.target.value ? [{ setId: mode.id,choiceId: e.target.value }] : [])] } })}><option value="">{mode.label}: all modes</option>{mode.choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>)}
            <input disabled={readOnly} className="field-input w-full" aria-label={`${entry.title} condition`} placeholder="Condition, if applicable" value={entry.condition} onChange={e => updateRow({ ...row,entry: { ...entry,condition: e.target.value } })} />
            <select disabled={readOnly} className="field-input w-full text-xs" aria-label={`${entry.title} rating basis`} value={entry.ratingBasis} onChange={e => updateRow({ ...row,entry: { ...entry,ratingBasis: e.target.value as SpecificationEntry["ratingBasis"] } })}>{["unspecified","continuous","transient","test"].map(basis => <option key={basis}>{basis}</option>)}</select>
          </td>
          <td className="p-3 align-top"><p className="text-xs text-slate-500">{entry.evidence.length ? `${entry.evidence.length} source${entry.evidence.length === 1 ? "" : "s"}` : entry.source.reference || "No source recorded"}</p>
            <LazyDetails label="Evidence"><div className="mt-2"><AttributeEvidenceEditor itemId={itemId} value={entry.evidence} disabled={readOnly} onChange={evidence => updateRow({ ...row,entry: { ...entry,evidence } })} /></div>
              <label className="mt-2 block text-xs">Origin<select disabled={readOnly} className="field-input w-full" value={entry.source.kind} onChange={e => updateRow({ ...row,entry: { ...entry,source: { ...entry.source,kind: e.target.value as SpecificationEntry["source"]["kind"] } } })}>{["manufacturer","engineer_entered","imported"].map(kind => <option key={kind}>{kind}</option>)}</select></label>
              {entry.source.reference && <p className="mt-2 text-xs">Retained reference: {entry.source.reference}</p>}
            </LazyDetails></td>
        </tr></Fragment>;
      })}</tbody></table>{!rows.length && <p className="p-5 text-sm text-slate-500">No matching specifications. Add a specification to begin.</p>}</div>
    <p className="text-xs text-slate-500">{state.draft.rows.length} specifications · Missing information can be saved for later review.</p>
    <ItemChannelTable itemId={itemId} profile={state.draft.profile} disabled={readOnly} onChange={profile => change({ ...state.draft,profile })} />
    {insert && <AttributePasteDialog mode={insert} draft={state.draft} onClose={() => setInsert(null)} onAdd={rows => {
      const groups = state.draft.profile.groups.length ? state.draft.profile.groups : [{ key: "device",label: "Device",context: "device" as const }];
      change({ profile: { ...state.draft.profile,groups },rows: [...state.draft.rows,...rows.map(row => ({ ...row,entry: { ...row.entry,evidence: row.entry.evidence.length ? row.entry.evidence : structuredClone(sharedSource) } }))] });
    }} />}
    {picker && <AttributeTypePicker deviceType={state.draft.profile.deviceType} onSelect={add} onClose={() => setPicker(false)} />}
    {types && <TypesDialog onClose={() => setTypes(false)} onDirty={value => setDirty("attribute-types",value)} />}
  </div>;
}
