"use client";
import { useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { reconcileSpecificationDraft,readableConflictValue } from "../../logic/services/attribute-conflict-review";
import type { SpecificationEditorDraft } from "../../logic/services/specification-editor-draft";
export function AttributeConflictReview({ base,draft,saved,onReconcile,onClose }: { base: SpecificationEditorDraft; draft: SpecificationEditorDraft; saved: SpecificationEditorDraft; onReconcile: (draft: SpecificationEditorDraft) => void; onClose: () => void }) {
  const [choices,setChoices] = useState<Record<string,"draft"|"saved">>({});
  const original = reconcileSpecificationDraft(base,draft,saved); const result = reconcileSpecificationDraft(base,draft,saved,choices);
  return <EngineeringDialog title="Review specification conflict" onClose={onClose}>
    <p className="text-sm">Your draft is retained. Changes to separate fields can be combined. Choose which value to keep where both versions changed the same field.</p>
    {original.conflicts.length ? <table className="mt-4 w-full text-left text-sm"><thead><tr><th>Field</th><th>Saved</th><th>Your draft</th><th>Keep</th></tr></thead><tbody>{original.conflicts.map(conflict => <tr key={conflict.path} className="border-t"><td className="p-2">{conflict.label}</td><td className="p-2">{readableConflictValue(conflict.saved)}</td><td className="p-2">{readableConflictValue(conflict.draft)}</td><td className="p-2"><select className="field-input" aria-label={`Resolve ${conflict.label}`} value={choices[conflict.path] ?? ""} onChange={e => setChoices({ ...choices,[conflict.path]: e.target.value as "draft"|"saved" })}><option value="">Choose…</option><option value="draft">My draft</option><option value="saved">Saved value</option></select></td></tr>)}</tbody></table> : <p className="my-4 text-sm text-teal-800">No overlapping field changes. The combined draft is ready for review.</p>}
    <div className="mt-4 flex justify-end gap-2"><button className="icon-button" onClick={onClose}>Keep editing my draft</button><button className="icon-button icon-button-primary" disabled={result.conflicts.length > 0} onClick={() => onReconcile(result.draft)}>Use combined draft</button></div>
    <p className="mt-2 text-xs text-slate-500">This does not save. Review the combined values, then choose Save changes to retry.</p>
  </EngineeringDialog>;
}
