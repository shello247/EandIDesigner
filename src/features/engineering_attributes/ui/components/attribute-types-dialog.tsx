"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Archive, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, FileText, ListFilter, Plus, RefreshCw, Ruler, Users } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { SearchInput } from "@/shared/ui/search-input";
import { attributeTypeDefinitionSchema, type AttributeTypeDefinition, type AttributeTypeOption } from "../../api/public";
import { listAttributeTypesAction, saveAttributeTypeAction, setAttributeTypeStatusAction, loadCurrentAttributeTypeAction } from "../../api/actions";
import { AttributeTypeTabs } from "./attribute-type-tabs";
import { AttributeTypeFields, typeValueLabels, type AttributeTypeSection } from "./attribute-type-fields";

const blank = (): AttributeTypeDefinition => ({ label: "", description: "", category: "documentation", valueKind: "quantity",
  engineeringDimension: "current", canonicalUnit: "A", allowedUnits: ["mA", "A", "kA"], payloadKind: "scalar", precision: 6 });
const statusTabs = [{ id: "active", label: "Active", icon: CheckCircle2 }, { id: "retired", label: "Retired", icon: Archive }] as const;
const editorTabs = [{ id: "details", label: "Details", icon: FileText }, { id: "units", label: "Units & Limits", icon: Ruler }, { id: "applicability", label: "Applicability", icon: Users }] as const;
const validationSection = (field: PropertyKey | undefined): AttributeTypeSection =>
  field === "applicableAssetTypes" ? "applicability" : ["label", "description", "valueKind"].includes(String(field)) ? "details" : "units";

export function AttributeTypesDialog({ onClose, onDirty, returnLabel }: { onClose: () => void; onDirty: (dirty: boolean) => void; returnLabel?: string }) {
  const [items, setItems] = useState<AttributeTypeOption[]>([]); const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "retired">("active");
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ previous?: AttributeTypeOption; draft: AttributeTypeDefinition } | null>(null);
  const [section, setSection] = useState<AttributeTypeSection>("details");
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true); const edits = useRef(0);
  const [latest, setLatest] = useState<AttributeTypeOption | null>(null);
  const editorGeneration = useRef(0); const comparisonRequest = useRef(0);
  const tabId = useId(); const body = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<string | null>(null);
  const editorKey = editor ? editor.previous?.typeId ?? "new" : null;
  const clearComparison = () => { comparisonRequest.current++; setLatest(null); };
  const openEditor = (previous?: AttributeTypeOption) => {
    editorGeneration.current++; clearComparison(); returnFocus.current = previous ? "Edit type " + previous.definition.label : "New Type";
    setEditor({ previous, draft: previous?.definition ?? blank() }); setSection("details"); setDirty(false); setError("");
  };
  useEffect(() => {
    if (editorKey) body.current?.querySelector<HTMLInputElement>('input[aria-label="Type name"]')?.focus();
    else if (returnFocus.current) {
      const button = [...(body.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
        .find(node => node.getAttribute("aria-label") === returnFocus.current);
      (button ?? body.current?.querySelector<HTMLInputElement>('input[aria-label="Search types"]'))?.focus();
      returnFocus.current = null;
    }
  }, [editorKey]);
  useEffect(() => () => { editorGeneration.current++; comparisonRequest.current++; }, []);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { listAttributeTypesAction({ search, status, page }).then(result => {
      if (!active) return; setLoading(false);
      if (result.ok) {
        setItems(result.data.items); setPages(result.data.pages); setListError("");
        if (page > result.data.pages) { setPage(result.data.pages); setLoading(true); }
      }
      else { setItems([]); setListError(result.error); }
    }).catch(() => { if (active) { setLoading(false); setItems([]); setListError("The type library could not be loaded. Retry."); } }); }, 150);
    return () => { active = false; clearTimeout(timer); };
  }, [search, status, page, retry]);
  const refresh = () => { setLoading(true); setListError(""); setRetry(value => value + 1); };
  const change = (patch: Partial<AttributeTypeDefinition>) => { edits.current++; setDirty(true); setEditor(current => current ? { ...current, draft: { ...current.draft, ...patch } } : null); };
  const back = () => { if (!busy && (!dirty || window.confirm("Discard unsaved type changes?"))) {
    editorGeneration.current++; clearComparison(); setEditor(null); setDirty(false); setError("");
  } };
  const d = editor?.draft;
  return <EngineeringDialog title={editor ? editor.previous ? "Edit Attribute Type" : "New Attribute Type" : "Manage Attribute Types"}
    subtitle={editor?.previous ? "Version " + editor.previous.revisionNumber + " · " + editor.previous.definition.label : undefined}
    compact dirty={dirty} busy={busy} onClose={onClose}>
    <div ref={body} className="flex min-h-0 flex-1 flex-col text-xs">
    {d && editor ? <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const invalid = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")).find(field => !field.checkValidity());
      if (invalid) {
        const target = invalid.closest<HTMLElement>("[data-type-section]")?.dataset.typeSection as AttributeTypeSection | undefined;
        if (target) setSection(target);
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return;
      }
      const serial = edits.current; clearComparison(); setBusy(true); setError("");
      try {
        const parsed = attributeTypeDefinitionSchema.safeParse(d);
        if (!parsed.success) { setSection(validationSection(parsed.error.issues[0].path[0])); throw new Error(parsed.error.issues[0].message); }
        const result = await saveAttributeTypeAction({ typeId: editor.previous?.typeId, expectedRevision: editor.previous?.revisionNumber, definition: parsed.data });
        if (!result.ok) throw new Error(result.error);
        refresh();
        if (edits.current === serial) { editorGeneration.current++; setEditor(null); setDirty(false); }
        else setEditor(current => current ? { ...current, previous: result.data } : null);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed; your changes are retained."); }
      finally { setBusy(false); }
    }}>
      <AttributeTypeTabs id={tabId} label="Attribute type sections" tabs={editorTabs} selected={section} onSelect={setSection} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
      {error && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p role="alert" className="text-amber-900">{error}</p>
        {editor.previous && <button type="button" className="icon-button" disabled={busy} onClick={async () => {
          const typeId = editor.previous!.typeId; const generation = editorGeneration.current;
          const request = ++comparisonRequest.current; setLatest(null);
          try {
            const result = await loadCurrentAttributeTypeAction(typeId);
            if (generation !== editorGeneration.current || request !== comparisonRequest.current) return;
            if (result.ok && result.data.typeId === typeId) setLatest(result.data);
            else setError(result.ok ? "The requested type could not be compared. Retry." : result.error);
          } catch {
            if (generation === editorGeneration.current && request === comparisonRequest.current) setError("The latest type could not be loaded. Your draft is retained; retry.");
          }
        }}>Compare latest type</button>}
      </div>}
      {latest && latest.typeId === editor.previous?.typeId && <section className="rounded-lg border border-slate-200 p-3"><h3 className="font-bold">Latest saved type · version {latest.revisionNumber}</h3>
        <pre className="my-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(latest.definition, null, 2)}</pre>
        <button type="button" className="icon-button" disabled={busy || latest.status !== "active"} onClick={() => {
          setEditor(current => current?.previous?.typeId === latest.typeId ? { ...current, previous: latest } : current);
          clearComparison(); setError("Latest version reviewed. Your draft is retained; save to retry.");
        }}>Use reviewed type version for retry</button></section>}
      <AttributeTypeFields draft={d} existing={!!editor.previous} section={section} id={tabId} change={change} />
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {dirty && <span className="mr-auto text-[11px] text-slate-500">Unsaved changes</span>}
        <button type="button" className="icon-button" disabled={busy} onClick={back}>Cancel</button><button className="icon-button icon-button-primary" disabled={busy || !dirty}>{busy ? "Saving…" : "Save Type"}</button>
      </footer>
    </form> : <>
      <AttributeTypeTabs id={tabId} label="Attribute type status" tabs={statusTabs} selected={status} disabled={busy} onSelect={value => {
        if (value === status) return;
        setStatus(value); setPage(1); setLoading(true); setListError("");
      }} />
      <div role="tabpanel" id={tabId + "-panel-" + status} aria-labelledby={tabId + "-tab-" + status} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-5 py-3">
          <SearchInput aria-label="Search types" containerClassName="flex-1" value={search} placeholder="Search attribute types" onChange={event => {
            setSearch(event.target.value); setPage(1); setLoading(true); setListError("");
          }} />
          <button type="button" className="icon-button icon-button-primary shrink-0" aria-label="New Type" disabled={busy} onClick={() => openEditor()}><Plus size={14} aria-hidden="true" />New Type</button>
        </div>
        <section aria-label="Attribute type results" aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          {loading ? <p role="status" className="py-8 text-center text-slate-500">Loading type library…</p> : listError ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><p role="alert">{listError}</p><button className="icon-button mt-2" onClick={refresh}>Retry</button></div> : !items.length ?
            <div className="py-8 text-center text-slate-500"><ListFilter size={22} className="mx-auto mb-2" aria-hidden="true" /><p>{search ? "No matching types." : status === "retired" ? "No retired types." : "No attribute types yet."}</p></div> :
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
            {items.map(item => <li key={item.typeId} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50">
              <div className="min-w-0 flex-1"><p className="break-words font-semibold">{item.definition.label}</p><p className="mt-0.5 break-words text-[11px] text-slate-500">{typeValueLabels[item.definition.valueKind]} · v{item.revisionNumber}{item.definition.allowedUnits?.length ? " · " + item.definition.allowedUnits.join(", ") : ""}</p></div>
              <div className="flex shrink-0 gap-1">
              {item.status === "active" && <button className="icon-button" disabled={busy} aria-label={"Edit type " + item.definition.label} onClick={() => openEditor(item)}>Edit</button>}
              <button className="icon-button" disabled={busy} aria-label={(item.status === "active" ? "Retire type " : "Restore type ") + item.definition.label} onClick={async () => {
                if (!window.confirm((item.status === "active" ? "Retire" : "Restore") + " this type? Existing Item entries remain unchanged.")) return;
                setBusy(true); setListError("");
                try { const result = await setAttributeTypeStatusAction({ typeId: item.typeId, expectedRevision: item.revisionNumber, expectedStatus: item.status, status: item.status === "active" ? "retired" : "active" });
                  if (!result.ok) setListError(result.error); else refresh(); } catch { setListError("Status could not be changed. Retry."); } finally { setBusy(false); }
              }}>{item.status === "active" ? "Retire" : "Restore"}</button>
              </div>
            </li>)}</ul>}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
        <button type="button" aria-label={returnLabel ?? "Close type library"} className="icon-button" disabled={busy} onClick={onClose}><ArrowLeft size={14} aria-hidden="true" />{returnLabel ? "Back" : "Close"}</button>
        <div className="flex items-center gap-1">
          <button className="icon-button" aria-label="Refresh" title="Refresh" disabled={busy || loading} onClick={refresh}><RefreshCw size={14} aria-hidden="true" /></button>
          <button className="icon-button" aria-label="Previous" title="Previous page" disabled={busy || loading || page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1); }}><ChevronLeft size={14} aria-hidden="true" /></button>
          <span className="whitespace-nowrap px-1 text-[11px] text-slate-500">Page {page} of {pages}</span>
          <button className="icon-button" aria-label="Next" title="Next page" disabled={busy || loading || page >= pages} onClick={() => { setLoading(true); setPage(value => value + 1); }}><ChevronRight size={14} aria-hidden="true" /></button>
        </div>
      </footer>
    </>}
    </div>
  </EngineeringDialog>;
}
