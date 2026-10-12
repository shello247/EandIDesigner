"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, Package, Settings2, SlidersHorizontal } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { itemEngineeringDeviceTypeSchema, ITEM_DEVICE_TYPE_OPTIONS, getItemDeviceTypeLabel } from "@/features/item_engineering/api/public";
import { useItemSectionDraft, useItemWorkspace } from "@/features/item_engineering/ui/public";
import type { ItemOverview } from "../../data/item-workspace";
import { getBomItemFormOptionsAction } from "../../api/actions";
import { loadItemWorkspaceOverviewAction, saveItemDetailsAction } from "../../api/item-workspace-actions";
import { itemDetailsDraft, itemDetailsFields } from "./item-details-fields";

const Types = dynamic(() => import("@/features/engineering_attributes/ui/type-library").then(module => module.AttributeTypesDialog), {
  // Keep the page inert while swapping dialogs, even on the first chunk load.
  loading: () => <EngineeringDialog title="Manage Attribute Types" compact busy onClose={() => undefined}><p role="status" className="p-5 text-xs text-slate-500">Loading type library…</p></EngineeringDialog>
});
type Options = Extract<Awaited<ReturnType<typeof getBomItemFormOptionsAction>>, { ok: true }>["data"];
const sections = [
  { id: "product", label: "Product", icon: Package },
  { id: "notes", label: "Notes & Source", icon: FileText },
  { id: "engineering", label: "Engineering", icon: SlidersHorizontal }
] as const;
type Section = typeof sections[number]["id"];
const fieldSection = (key: typeof itemDetailsFields[number][0]): Section =>
  ["description", "notes", "productUrl"].includes(key) ? "notes" : "product";

export function ItemDetailsDialog({ item, onUpdated, onClose }: {
  item: ItemOverview; onUpdated: (item: ItemOverview) => void; onClose: () => void;
}) {
  const draft = useItemSectionDraft("overview", itemDetailsDraft(item));
  const { mutate, busy, readOnly, reviewRevision, setDirty } = useItemWorkspace();
  const [baseline, setBaseline] = useState(item);
  const [options, setOptions] = useState<Options | null>(null);
  const [optionError, setOptionError] = useState("");
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState<ItemOverview | null>(null);
  const [types, setTypes] = useState(false);
  const [section, setSection] = useState<Section>("product");
  const tabId = useId();
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const typesButton = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);
  const typeDirty = useCallback((value: boolean) => setDirty("item-types", value), [setDirty]);
  useEffect(() => {
    let active = true;
    getBomItemFormOptionsAction().then(result => {
      if (!active) return;
      if (result.ok) { setOptions(result.data); setOptionError(""); }
      else setOptionError("Catalogue suggestions could not be loaded. Your draft is safe; retry or enter the values directly.");
    }).catch(() => { if (active) setOptionError("Catalogue suggestions could not be loaded. Retry when ready."); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    if (types || !returning.current) return;
    const frame = requestAnimationFrame(() => { typesButton.current?.focus(); returning.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [types]);
  const close = () => { if (!busy && (!draft.dirty || window.confirm("Discard unsaved changes to this entry?"))) onClose(); };
  if (types) return <Types onDirty={typeDirty} returnLabel="Back to Edit details" onClose={() => { returning.current = true; setTypes(false); }} />;
  return <EngineeringDialog title="Edit details" subtitle={item.displayName} compact dirty={draft.dirty} busy={busy} onClose={onClose}>
    <form noValidate className="flex min-h-0 flex-1 flex-col text-xs" onSubmit={async event => {
      event.preventDefault(); if (busy || readOnly || conflict) return;
      // An invalid value may be in an inactive tab. Reveal it before asking the
      // browser to focus/explain it, instead of losing native form validation.
      const invalid = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))
        .find(field => !field.checkValidity());
      if (invalid) {
        const target = invalid.closest<HTMLElement>("[data-details-section]")?.dataset.detailsSection as Section | undefined;
        if (target) setSection(target);
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return;
      }
      const submitted = draft.snapshot(); setMessage("");
      if (!submitted.deviceType) { setSection("product"); setMessage("Choose a Device Type before saving."); return; }
      try {
        const saved = await mutate(async revisionId => {
          const result = await saveItemDetailsAction({ itemId: item.id, expectedUpdatedAt: baseline.updatedAt,
            expectedLatestRevisionId: revisionId, fields: submitted.fields,
            deviceType: submitted.deviceType });
          if (!result.ok) { if (result.code === "REVISION_CONFLICT") setConflict(true); throw new Error(result.error); }
          return { value: result.data, revisionId: result.data.revisionId };
        });
        const unchanged = JSON.stringify(draft.snapshot()) === JSON.stringify(submitted);
        onUpdated(saved); setBaseline(saved); draft.acknowledge(submitted, itemDetailsDraft(saved));
        if (unchanged) onClose(); else setMessage("Submitted values saved. Your later edits remain unsaved.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed. Your input is retained."); }
    }}>
      <div role="tablist" aria-label="Item details sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3">
        {sections.map((tab, index) => <button key={tab.id} ref={node => { tabButtons.current[index] = node; }} type="button" role="tab"
          id={`${tabId}-tab-${tab.id}`} aria-controls={`${tabId}-panel-${tab.id}`} aria-selected={section === tab.id} tabIndex={section === tab.id ? 0 : -1}
          className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-bold outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-teal-600 ${section === tab.id ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          onClick={() => setSection(tab.id)} onKeyDown={event => {
            const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 :
              event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : -1;
            if (next < 0) return;
            event.preventDefault(); setSection(sections[next].id); tabButtons.current[next]?.focus();
          }}><tab.icon size={14} aria-hidden="true" />{tab.label}</button>)}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
      {(["product", "notes"] as const).map(current => <section key={current} role="tabpanel" id={`${tabId}-panel-${current}`} aria-labelledby={`${tabId}-tab-${current}`}
        data-details-section={current} hidden={section !== current} className="space-y-3">
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        {current === "product" && <label className="block sm:col-span-2"><span className="font-bold">Device Type<span className="ml-1 text-teal-700" aria-hidden="true">*</span></span>
          <select aria-label="Device Type" required className="field-input mt-1 block w-full" value={draft.draft.deviceType ?? ""}
            onChange={event => draft.change({ ...draft.draft, deviceType: event.target.value ? itemEngineeringDeviceTypeSchema.parse(event.target.value) : null })}>
            <option value="" disabled>Select Device Type</option>
            {ITEM_DEVICE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>}
        {itemDetailsFields.filter(([key]) => fieldSection(key) === current).map(([key, label]) => <label key={key} className={`block ${["displayName", "description", "notes", "productUrl"].includes(key) ? "sm:col-span-2" : ""}`}>
          <span className="font-bold">{label}{["displayName", "unit"].includes(key) && <span className="ml-1 text-teal-700" aria-hidden="true">*</span>}</span>
          {["description", "notes"].includes(key) ? <textarea aria-label={label} className="field-input mt-1 w-full resize-y" rows={3} maxLength={key === "description" ? 600 : 1000}
            value={draft.draft.fields[key]} onChange={event => draft.change({ ...draft.draft, fields: { ...draft.draft.fields, [key]: event.target.value } })} /> :
            <input aria-label={label} className="field-input mt-1 w-full" required={["displayName", "unit"].includes(key)} type={key === "productUrl" ? "url" : "text"}
              list={options && key === "manufacturer" ? "details-options-manufacturer" : undefined}
              value={draft.draft.fields[key]} onChange={event => draft.change({ ...draft.draft, fields: { ...draft.draft.fields, [key]: event.target.value } })} />}
        </label>)}</div>
        {current === "product" && options && <datalist id="details-options-manufacturer">{options.manufacturers.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>}
        {current === "product" && optionError && <div className="text-amber-900"><p role="status">{optionError}</p><button type="button" className="icon-button mt-2" onClick={() => setRetry(value => value + 1)}>Retry suggestions</button></div>}
      </section>)}
      <section role="tabpanel" id={`${tabId}-panel-engineering`} aria-labelledby={`${tabId}-tab-engineering`} data-details-section="engineering" hidden={section !== "engineering"}
        className="space-y-3 rounded-lg border border-teal-100 bg-teal-50/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="font-bold">Attribute Types library</p><p className="mt-1 text-[11px] text-slate-500">Type changes save separately. Your Item details stay here.</p></div>
          <button ref={typesButton} type="button" className="icon-button" disabled={busy || readOnly} onClick={() => setTypes(true)}><Settings2 size={16} />Manage Types</button>
        </div>
      </section>
      {message && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">{message}</p>}
      {message && <button type="button" className="icon-button" disabled={busy} onClick={async () => {
        try { const result = await loadItemWorkspaceOverviewAction(item.id); if (result.ok) setReview(result.data); else setMessage(result.error); }
        catch { setMessage("Latest details could not be loaded. Your draft is retained; retry."); }
      }}>Review latest saved section</button>}
      {review && <section className="space-y-3 rounded-lg border border-slate-200 p-3"><h3 className="font-semibold">Latest saved values — your draft is unchanged</h3>
        <dl className="space-y-2">{itemDetailsFields.map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd className="break-words text-slate-500">{review[key] || "Unspecified"}</dd></div>)}
          <div><dt className="font-medium">Device Type</dt><dd>{getItemDeviceTypeLabel(review.deviceType)}</dd></div></dl>
        <button type="button" className="icon-button" disabled={busy} onClick={async () => { await reviewRevision(review.revisionId); setBaseline(review); onUpdated(review);
          draft.load(itemDetailsDraft(review)); setReview(null); setConflict(false); setMessage("Latest values reviewed. Retry saving your draft."); }}>Use this version for retry</button>
      </section>}
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {draft.dirty && <span className="mr-auto text-[11px] text-slate-500">Unsaved changes</span>}
        <div className="flex shrink-0 gap-2">
        <button type="button" className="icon-button" disabled={busy} onClick={close}>Cancel</button>
        <button className="icon-button icon-button-primary" disabled={busy || readOnly || !draft.dirty || conflict}>{busy ? "Saving…" : "Save details"}</button>
        </div>
      </footer>
    </form>
  </EngineeringDialog>;
}
