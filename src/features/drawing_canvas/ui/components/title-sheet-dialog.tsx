"use client";

import { useEffect, useRef, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { titleSheetDraftSchema, type TitleSheetDraft } from "../../data/schema";
import { drawingTitleBlockFields } from "../../logic/services/drawing-title-fields";

export function TitleSheetDialog({ title, titleBlock, onClose, onApply }: TitleSheetDraft & {
  onClose: () => void;
  onApply: (draft: TitleSheetDraft) => void;
}) {
  const [draft, setDraft] = useState({ title, titleBlock });
  const [error, setError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    // Focus after the shared native dialog has opened, not while it is hidden.
    const frame = requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[name="title"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify({ title, titleBlock });
  const close = () => { if (!dirty || window.confirm("Discard unsaved changes to this entry?")) onClose(); };
  return <EngineeringDialog title="Edit Title Sheet" subtitle="Shared drawing information · Apply, then Save drawing" compact dirty={dirty} onClose={onClose}>
    <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
      event.preventDefault();
      const parsed = titleSheetDraftSchema.safeParse(draft);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setError(issue.message);
        formRef.current?.querySelector<HTMLInputElement>(`[name="${issue.path.join(".")}"]`)?.focus();
        return;
      }
      onApply(parsed.data);
    }}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div><label className="field-label" htmlFor="title-sheet-title">Drawing title</label>
          <input id="title-sheet-title" name="title" className="field-input" maxLength={200} value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); setError(undefined); }} /></div>
        <div className="grid gap-3 sm:grid-cols-2">{drawingTitleBlockFields.map(field => <div key={field.key}>
          <label className="field-label" htmlFor={`title-sheet-${field.key}`}>{field.key === "project" ? "Project" : field.label}</label>
          <input id={`title-sheet-${field.key}`} name={`titleBlock.${field.key}`} className="field-input" placeholder={field.placeholder} value={draft.titleBlock[field.key] ?? ""} onChange={event => { setDraft({ ...draft, titleBlock: { ...draft.titleBlock, [field.key]: event.target.value } }); setError(undefined); }} />
        </div>)}</div>
        {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button className="icon-button" type="button" onClick={close}>Cancel</button>
        <button className="icon-button icon-button-primary" type="submit">Apply</button>
      </footer>
    </form>
  </EngineeringDialog>;
}
