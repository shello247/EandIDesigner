"use client";
import { useEffect, useState } from "react";
import type { AttributeEvidence } from "../../api/public";
import { loadAttributeEvidenceAction } from "../../api/batch-actions";
import { evidenceLabel } from "../../logic/services/attribute-evidence";
type Sources = Extract<Awaited<ReturnType<typeof loadAttributeEvidenceAction>>, { ok: true }>["data"]["sources"];
export function AttributeEvidenceEditor({ itemId, value, onChange, disabled = false }: {
  itemId: string; value: AttributeEvidence[]; onChange: (value: AttributeEvidence[]) => void; disabled?: boolean;
}) {
  const [sources,setSources] = useState<Sources>([]); const [reference,setReference] = useState(""); const [error,setError] = useState("");
  useEffect(() => { let active = true; loadAttributeEvidenceAction({ itemId }).then(result => {
    if (!active) return; if (result.ok) setSources(result.data.sources); else setError(result.error);
  }).catch(() => { if (active) setError("Sources could not be loaded."); }); return () => { active = false; }; },[itemId]);
  return <div className="space-y-2 text-xs">
    {value.map((source,index) => <div className="flex flex-wrap items-center gap-2" key={index}>
      {source.kind === "url" || source.kind === "document" || source.kind === "note" ? <a className="text-teal-700 underline" target="_blank" rel="noreferrer"
        href={source.kind === "url" ? source.url : (sources.find(s => s.kind === source.kind && s.id === source.id)?.href ?? `/bom/items/${itemId}`) + (source.kind === "document" && source.page ? `#page=${source.page}` : "")}>{source.kind === "url" ? evidenceLabel(source) : sources.find(s => s.kind === source.kind && s.id === source.id)?.label ?? evidenceLabel(source)}</a> : <span>{source.reference}</span>}
      {source.kind === "document" && <input type="number" min={1} aria-label="Source page" placeholder="Page" className="field-input w-20" disabled={disabled} value={source.page ?? ""}
        onChange={event => onChange(value.map((s,i) => i === index ? { ...source, page: event.target.value ? Number(event.target.value) : undefined } : s))} />}
      {(source.kind === "document" || source.kind === "note") && <input aria-label="Source section" placeholder="Section" className="field-input min-w-0 flex-1" disabled={disabled} value={source.section ?? ""}
        onChange={event => onChange(value.map((s,i) => i === index ? { ...source, section: event.target.value } : s))} />}
      {!disabled && <button className="icon-button" aria-label="Remove source" onClick={() => onChange(value.filter((_,i) => i !== index))}>Remove</button>}
    </div>)}
    {!disabled && <><select className="field-input w-full" aria-label="Add attached source" value="" onChange={async event => {
      const selected = sources.find(s => `${s.kind}:${s.id}` === event.target.value); if (!selected) return;
      const result = await loadAttributeEvidenceAction({ itemId, kind: selected.kind, id: selected.id });
      if (!result.ok) { setError(result.error); return; }
      const source = result.data.sources[0]; if (source.contentHash) onChange([...value,{ kind: source.kind, id: source.id, contentHash: source.contentHash }]);
    }}><option value="">Add attached document or note…</option>{sources.map(source => <option key={`${source.kind}:${source.id}`} value={`${source.kind}:${source.id}`}>{source.label}{source.archived ? " (retained)" : ""}</option>)}</select>
      <div className="flex gap-2"><input className="field-input min-w-0 flex-1" aria-label="External source or engineer reference" placeholder="Source URL or engineer reference" value={reference} onChange={e => setReference(e.target.value)} />
        <button className="icon-button" disabled={!reference.trim()} onClick={() => { const text = reference.trim(); onChange([...value, /^https?:\/\//i.test(text) ? { kind: "url", url: text, label: "" } : { kind: "engineer",reference: text }]); setReference(""); }}>Add source</button></div></>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
  </div>;
}
