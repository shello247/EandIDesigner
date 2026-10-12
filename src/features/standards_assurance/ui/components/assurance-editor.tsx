"use client";
import { useRef, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { recordStandardsEvidenceAction, recordStandardsReviewAction } from "../../api/actions";
import { localReviewNotice, provenanceNotice, type EvidenceInput, type ReviewInput } from "../../data/schema";
import type { Evidence, Revision } from "../../types";
const localDateTime = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function AssuranceEditor({ mode, target, kind = "requirement", implementations = [], evidence = [], buildId = "", onClose, onSaved }: {
  mode: "evidence" | "review"; target: Revision; kind?: "requirement" | "implementation" | "profile"; implementations?: Revision<"implementation">[]; evidence?: Evidence[]; buildId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [fields, setFields] = useState({ producer: "", description: "", notes: "", artifactReference: "", buildId, type: "manual_check", result: "inconclusive", implementationRevisionId: "", reviewer: "", comments: "", outcome: "review_recorded", date: localDateTime() });
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const operationId = useRef<string | null>(null);
  function change(key: keyof typeof fields, value: string) { setFields(previous => ({ ...previous, [key]: value })); setDirty(true); operationId.current = null; }
  const text = (key: keyof typeof fields, label: string, multiline = false) => <label className={"standards-field " + (multiline ? "wide" : "")}><span>{label}</span>{multiline ? <textarea className="field-input" value={fields[key]} onChange={e => change(key, e.target.value)}/> : <input className="field-input" value={fields[key]} onChange={e => change(key, e.target.value)}/>}</label>;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true); operationId.current ??= crypto.randomUUID();
    try {
      const date = new Date(fields.date).toISOString();
      const result = mode === "evidence" ? await recordStandardsEvidenceAction({
        operationId: operationId.current, requirementRevisionId: target.id, implementationRevisionId: fields.implementationRevisionId || null,
        type: fields.type as EvidenceInput["type"], description: fields.description, result: fields.result as EvidenceInput["result"],
        artifactReference: fields.artifactReference, buildId: fields.buildId, producer: fields.producer, recordedAt: date, notes: fields.notes
      }) : await recordStandardsReviewAction({
        operationId: operationId.current, targetKind: kind, targetRevisionId: target.id, reviewer: fields.reviewer,
        reviewedAt: date, outcome: fields.outcome as ReviewInput["outcome"], comments: fields.comments, evidenceIds: selectedEvidence
      });
      if (result.ok) onSaved(); else setError(result.error);
    } catch { setError("The record could not be saved. Check the date and connection, then retry. Your entries are retained."); }
    finally { setBusy(false); }
  }
  return <EngineeringDialog title={mode === "evidence" ? "Record evidence" : "Record local review"} subtitle={target.content.title + " · R" + target.number} compact dirty={dirty} busy={busy} onClose={onClose}>
    <form className="standards-form" onSubmit={submit}><fieldset disabled={busy} className="standards-form-body">
      <p className="standards-notice col-span-full m-0">{mode === "evidence" ? provenanceNotice : localReviewNotice}</p>
      {mode === "evidence" ? <>
        {text("producer", "Declared producer")}<label className="standards-field"><span>Evidence type</span><select aria-label="Evidence type" className="field-input" value={fields.type} onChange={e => change("type", e.target.value)}><option value="manual_check">Manual check</option><option value="test_report">Test report metadata</option><option value="example">Reviewed example</option></select></label>
        {text("description", "Check description", true)}
        <label className="standards-field"><span>Recorded result</span><select aria-label="Recorded result" className="field-input" value={fields.result} onChange={e => change("result", e.target.value)}><option value="inconclusive">Inconclusive</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
        <label className="standards-field"><span>Implementation revision</span><select aria-label="Implementation revision" className="field-input" value={fields.implementationRevisionId} onChange={e => change("implementationRevisionId", e.target.value)}><option value="">Requirement-level evidence</option>{implementations.map(row => <option key={row.id} value={row.id}>{row.content.title} · R{row.number}</option>)}</select></label>
        {text("artifactReference", "Artifact or example reference")}{text("buildId", "Application build identity")}{text("notes", "Evidence notes", true)}
      </> : <>
        {text("reviewer", "Declared reviewer name")}
        <label className="standards-field"><span>Review outcome</span><select aria-label="Review outcome" className="field-input" value={fields.outcome} onChange={e => change("outcome", e.target.value)}><option value="review_recorded">Review recorded</option><option value="changes_requested">Changes requested</option></select></label>
        {text("comments", "Review comments", true)}
        <div className="standards-field wide"><span>Evidence considered</span>{evidence.length ? evidence.map(row => <label className="flex gap-2 text-xs" key={row.id}><input type="checkbox" checked={selectedEvidence.includes(row.id)} onChange={e => { setSelectedEvidence(previous => e.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id)); setDirty(true); operationId.current = null; }}/><span>{row.description} · {row.result} · {row.producer}</span></label>) : <small>No evidence has been recorded for the selected revision.</small>}</div>
      </>}
      <label className="standards-field"><span>{mode === "evidence" ? "Check date and time" : "Review date and time"}</span><input type="datetime-local" className="field-input" value={fields.date} onChange={e => change("date", e.target.value)}/><small>Entered in your browser timezone; stored in UTC.</small></label>
    </fieldset>{error && <div className="standards-error" role="alert">{error}</div>}<footer className="standards-form-footer"><button className="standards-button" type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved entries?")) onClose(); }}>Cancel</button><button className="standards-button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save record"}</button></footer></form>
  </EngineeringDialog>;
}

