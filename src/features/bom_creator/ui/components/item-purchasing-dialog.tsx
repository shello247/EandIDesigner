"use client";
import { useId, useState } from "react";
import { Building2, FileText, ShoppingCart } from "lucide-react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { WorkspaceDialogTabs, WorkspaceValue } from "@/shared/ui/item-workspace-presentation";
import { ItemWorkspaceMessage, useItemSectionDraft, useItemWorkspace } from "@/features/item_engineering/ui/public";
import { loadItemWorkspaceOverviewAction, saveItemCommercialAction } from "../../api/item-workspace-actions";
import type { ItemOverview } from "../../data/item-workspace";
import { displayItemValue } from "../../logic/services/item-workspace-presentation";
import { BomItemCommercialFields, itemCommercialDraft, itemCommercialFields, type CommercialSection } from "./bom-item-commercial-fields";

const sections = [{ id: "pricing", label: "Pricing & Ordering", icon: ShoppingCart }, { id: "supplier", label: "Supplier", icon: Building2 }, { id: "notes", label: "Notes", icon: FileText }] as const;
export function ItemPurchasingDialog({ item, onUpdated, onClose, onSaved }: { item: ItemOverview; onUpdated: (item: ItemOverview) => void; onClose: () => void; onSaved: () => void }) {
  const draft = useItemSectionDraft("commercial", itemCommercialDraft(item));
  const { busy, readOnly, mutate } = useItemWorkspace();
  const [baseline, setBaseline] = useState(item);
  const [section, setSection] = useState<CommercialSection>("pricing");
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"info" | "error" | "success">("info");
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState<ItemOverview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const id = useId();
  const close = () => { if (!busy && (!draft.dirty || window.confirm("Discard unsaved purchasing changes?"))) onClose(); };
  return <EngineeringDialog title="Edit purchasing" subtitle={item.displayName} compact dirty={draft.dirty} busy={busy} onClose={onClose}>
    <form noValidate className="flex min-h-0 flex-1 flex-col text-[12px]" onSubmit={async event => {
      event.preventDefault(); if (busy || readOnly || conflict) return;
      const invalid = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).find(field => !field.checkValidity());
      if (invalid) { setSection(invalid.closest<HTMLElement>("[data-commercial-section]")!.dataset.commercialSection as CommercialSection); requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); }); return; }
      const submitted = draft.snapshot(); setMessage(null);
      try {
        const saved = await mutate(async revisionId => {
          const result = await saveItemCommercialAction({ itemId: item.id, expectedUpdatedAt: baseline.updatedAt, fields: submitted });
          if (!result.ok) {
            if (result.code === "REVISION_CONFLICT") setConflict(true);
            const key = Object.keys(result.fieldErrors ?? {})[0]?.replace(/^fields\./, "");
            const field = itemCommercialFields.find(value => value.key === key); if (field) setSection(field.section);
            throw new Error(result.error);
          }
          return { value: result.data, revisionId };
        });
        const unchanged = JSON.stringify(draft.snapshot()) === JSON.stringify(submitted);
        setBaseline(saved); onUpdated(saved); draft.acknowledge(submitted, itemCommercialDraft(saved));
        if (unchanged) { onSaved(); onClose(); } else { setKind("success"); setMessage("Submitted purchasing values saved. Your later edits remain unsaved."); }
      } catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Save failed. Your draft is retained."); }
    }}>
      <WorkspaceDialogTabs id={id} label="Purchasing sections" tabs={sections} selected={section} onSelect={setSection} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {sections.map(tab => <section key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`} data-commercial-section={tab.id} hidden={section !== tab.id}>
          <BomItemCommercialFields idPrefix={id} section={tab.id} draft={draft.draft} onChange={patch => draft.change({ ...draft.snapshot(), ...patch })} />
        </section>)}
        <ItemWorkspaceMessage message={message} kind={kind} />
        {conflict && <button type="button" className="icon-button" disabled={busy || reviewing} onClick={async () => {
          setReviewing(true); try { const result = await loadItemWorkspaceOverviewAction(item.id); if (result.ok) setReview(result.data); else throw new Error(result.error); }
          catch (error) { setKind("error"); setMessage(error instanceof Error ? error.message : "Latest purchasing data could not be loaded. Retry."); } finally { setReviewing(false); }
        }}>{reviewing ? "Loading comparison…" : "Review latest saved section"}</button>}
        {review && <section className="space-y-3 rounded-lg border border-slate-200 p-3"><h3 className="font-bold">Latest saved values — your draft is unchanged</h3>
          <dl className="grid gap-3 sm:grid-cols-2">{itemCommercialFields.map(field => <WorkspaceValue key={field.key} label={field.label}>{displayItemValue(review[field.key])}</WorkspaceValue>)}</dl>
          <button type="button" className="icon-button" disabled={busy || review.status !== "active"} onClick={() => { setBaseline(review); onUpdated(review); draft.load(itemCommercialDraft(review)); setReview(null); setConflict(false); setKind("info"); setMessage("Latest values reviewed. Retry saving your draft."); }}>Use this version for retry</button>
        </section>}
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {draft.dirty && <span className="mr-auto text-[11px] text-slate-500">Unsaved changes</span>}
        <button type="button" className="icon-button" disabled={busy} onClick={close}>Cancel</button>
        <button className="icon-button icon-button-primary" disabled={busy || readOnly || conflict || !draft.dirty}>{busy ? "Saving…" : "Save purchasing"}</button>
      </footer>
    </form>
  </EngineeringDialog>;
}
