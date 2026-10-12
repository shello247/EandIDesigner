"use client";
import { useEffect, useRef, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { SearchInput } from "@/shared/ui/search-input";
import { listAttributeTypesAction } from "@/features/engineering_attributes/api/actions";
import type { AttributeTypeOption, AttributeTypeSnapshot } from "@/features/engineering_attributes/api/public";
import type { ItemAttributeEntry, ItemProfileV2 } from "../../api/public";
import { saveItemAttributeAction, loadItemAttributeWorkspaceAction } from "../../api/attribute-actions";
import { useItemWorkspace } from "./item-workspace-context";
import { buildPayload, ItemAttributeValueFields, payloadDraft } from "./item-attribute-value-fields";

export type AttributeWorkspace = Extract<Awaited<ReturnType<typeof loadItemAttributeWorkspaceAction>>, { ok: true }>["data"];
export function ItemAttributeDialog({ workspace, entry, onSaved, onClose }: {
  workspace: AttributeWorkspace; entry?: ItemAttributeEntry; onSaved: (value: AttributeWorkspace) => void; onClose: () => void;
}) {
  const { itemId, mutate, busy, setDirty, reviewRevision } = useItemWorkspace();
  const [type, setType] = useState<AttributeTypeSnapshot | null>(entry?.type ?? null);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [value, setValue] = useState(payloadDraft(entry?.payload));
  const [source, setSource] = useState(entry?.source ?? { kind: "engineer_entered" as const });
  const [groupKey, setGroupKey] = useState(entry?.groupKey ?? workspace.profile.groups[0]?.key ?? "new");
  const [newGroup, setNewGroup] = useState({ label: "Device specifications", context: "device" as ItemProfileV2["groups"][number]["context"] });
  const [options, setOptions] = useState<AttributeTypeOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const [error, setError] = useState(""); const [dirty, markDirty] = useState(false);
  const [conflict, setConflict] = useState(false); const [latest, setLatest] = useState<AttributeWorkspace | null>(null);
  const [entryId, setEntryId] = useState(entry?.id); const edits = useRef(0); const groupEdits = useRef(0);
  const changed = () => { edits.current++; markDirty(true); };
  const groupChanged = () => { groupEdits.current++; changed(); };
  useEffect(() => { setDirty("engineering", dirty); return () => setDirty("engineering", false); }, [dirty, setDirty]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      listAttributeTypesAction({ search, page }).then(result => {
        if (!active) return;
        setLoading(false);
        if (result.ok) { setOptions(result.data.items); setPages(result.data.pages); }
        else setError(result.error);
      }).catch(() => { if (active) { setLoading(false); setError("Types could not be loaded. Retry."); } });
    }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [search, page, retry]);
  const close = () => { if (!busy && (!dirty || window.confirm("Discard unsaved changes to this entry?"))) onClose(); };
  const choose = (id: string) => {
    const next = options.find(option => option.revisionId === id);
    if (!next) return;
    if (type && next.revisionId !== type.revisionId && !window.confirm("Changing type clears this entry's value and conditions. Continue?")) return;
    setType(next); setTitle(next.definition.label); setDescription(next.definition.description);
    setValue({ unit: next.definition.canonicalUnit ?? "", ratingType: next.analysisKey === "conditional_sccr" ? "sccr" : "breaking_capacity" });
    changed();
  };
  return <EngineeringDialog title={entry ? "Edit Attribute" : "Add Attribute"} subtitle={workspace.itemName} dirty={dirty} busy={busy} onClose={onClose}>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (!type || busy || conflict) return;
      const submittedEdits = edits.current;
      const submittedGroupEdits = groupEdits.current;
      try {
        const payload = buildPayload(type.definition, value);
        const saved = await mutate(async revisionId => {
          const result = await saveItemAttributeAction({ itemId, expectedLatestRevisionId: revisionId, entryId,
            typeRevisionId: type.revisionId, title, description, payload, source,
            ...(groupKey === "new" ? { newGroup } : { groupKey }) });
          if (!result.ok) { if (result.code === "REVISION_CONFLICT") setConflict(true); throw new Error(result.error); }
          return { value: result.data, revisionId: result.data.revisionId };
        });
        onSaved(saved);
        if (edits.current === submittedEdits) onClose();
        else {
          const stored = saved.profile.entries.find(row => row.id === entryId) ?? saved.profile.entries.at(-1)!;
          setEntryId(stored.id);
          if (groupEdits.current === submittedGroupEdits) setGroupKey(stored.groupKey);
          setError("Submitted values saved. Your later edits remain unsaved.");
        }
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed. Your input is retained."); }
    }}>
      <label className="block text-sm">Search attribute types<SearchInput containerClassName="mt-1" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <label className="block text-sm">Attribute Type<select aria-label="Attribute Type" className="field-input mt-1 block w-full" value={type?.revisionId ?? ""} onChange={event => choose(event.target.value)}>
        <option value="">Choose a type</option>{type && !options.some(option => option.revisionId === type.revisionId) &&
          <option value={type.revisionId}>{type.definition.label} · retained version {type.revisionNumber}</option>}
        {options.map(option => <option key={option.revisionId} value={option.revisionId}>{option.definition.label}</option>)}</select></label>
      {loading && <p role="status">Loading types…</p>}
      <div className="flex gap-2 text-xs"><button type="button" className="icon-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous types</button>
        <span>Page {page} of {pages}</span><button type="button" className="icon-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next types</button>
        <button type="button" className="icon-button" onClick={() => setRetry(retry + 1)}>Retry types</button></div>
      <label className="block text-sm">Title<input className="field-input mt-1 block w-full" required maxLength={160} value={title} onChange={event => { setTitle(event.target.value); changed(); }} /></label>
      <label className="block text-sm">Description<textarea aria-label="Description" className="field-input mt-1 block w-full" maxLength={1000} value={description} onChange={event => { setDescription(event.target.value); changed(); }} /></label>
      {type && <ItemAttributeValueFields definition={type.definition} draft={value} onChange={next => { setValue(next); changed(); }} />}
      <details className="rounded-lg border border-slate-200 p-4" open={groupKey === "new"}><summary className="cursor-pointer text-sm font-medium">Conditions &amp; Source</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Specification group<select className="field-input mt-1 block w-full" value={groupKey} onChange={event => { setGroupKey(event.target.value); groupChanged(); }}>
          {workspace.profile.groups.map(group => <option key={group.key} value={group.key}>{group.label} · {group.context.replaceAll("_", " ")}</option>)}<option value="new">New specification group</option></select></label>
        {groupKey === "new" && <><label className="text-sm">Group title<input className="field-input mt-1 block w-full" value={newGroup.label} onChange={event => { setNewGroup({ ...newGroup, label: event.target.value }); groupChanged(); }} /></label>
          <label className="text-sm">Specification context<select className="field-input mt-1 block w-full" value={newGroup.context} onChange={event => { setNewGroup({ ...newGroup, context: event.target.value as typeof newGroup.context }); groupChanged(); }}>
            <option value="device">Device</option><option value="supply_input">Supply input</option><option value="supply_output">Supply output</option></select></label></>}
        <label className="text-sm">Source type<select className="field-input mt-1 block w-full" value={source.kind} onChange={event => { setSource({ ...source, kind: event.target.value as typeof source.kind }); changed(); }}>
          <option value="engineer_entered">Engineer entered</option><option value="manufacturer">Manufacturer</option><option value="imported">Imported</option></select></label>
        <label className="text-sm sm:col-span-2">Supporting source / conditions<textarea className="field-input mt-1 block w-full" maxLength={500} value={source.reference ?? ""} onChange={event => { setSource({ ...source, reference: event.target.value }); changed(); }} /></label>
      </div></details>
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {conflict && <button type="button" className="icon-button" onClick={async () => {
        const result = await loadItemAttributeWorkspaceAction({ itemId }); if (result.ok) setLatest(result.data); else setError(result.error);
      }}>Compare latest saved entry</button>}
      {latest && <section className="rounded border p-3 text-sm"><h3>Latest saved entry</h3><pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(latest.profile.entries.find(row => row.id === entryId) ?? "Entry not present", null, 2)}</pre>
        <button type="button" className="icon-button" onClick={async () => { await reviewRevision(latest.revisionId); onSaved(latest); setConflict(false); setLatest(null); setError("Latest revision reviewed. Your draft is retained for explicit retry."); }}>Use reviewed revision for retry</button></section>}
      <footer className="flex justify-end gap-2 border-t pt-4"><button type="button" className="icon-button" disabled={busy} onClick={close}>Cancel</button>
        <button className="icon-button icon-button-primary" disabled={busy || !type || !dirty || conflict}>{busy ? "Saving…" : "Save Attribute"}</button></footer>
    </form>
  </EngineeringDialog>;
}
