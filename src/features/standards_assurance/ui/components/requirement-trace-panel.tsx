"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRequirementAction } from "../../api/actions";
import type { Trace } from "../../types";
import { StandardsEditor, humanize } from "./standards-editor";
import { AssuranceEditor } from "./assurance-editor";
export function RequirementTracePanel({ revisionId, tick, onChanged }: { revisionId: string; tick: number; onChanged: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null), [error, setError] = useState("");
  const [editor, setEditor] = useState<"implementation" | "evidence" | "review" | null>(null);
  useEffect(() => {
    let cancelled = false;
    getRequirementAction(revisionId).then(result => { if (!cancelled) { if (result.ok) { setTrace(result.data); setError(""); } else setError(result.error); } });
    return () => { cancelled = true; };
  }, [revisionId, tick]);
  if (error) return <div className="standards-error" role="alert">{error}</div>;
  if (!trace || trace.requirement.id !== revisionId) return <p role="status">Loading traceability…</p>;
  const currentEvidence = trace.evidence.filter(row => row.requirementRevisionId === revisionId);
  function saved() { setEditor(null); onChanged(); }
  return <section>
    <div className="standards-notice"><strong>{humanize(trace.requirement.content.sourceStatus)}</strong> · {trace.source.content.designation} {trace.source.content.edition}{trace.source.content.amendment ? " + " + trace.source.content.amendment : ""}<br/>{trace.requirement.content.locator || "No normative locator verified."} {trace.source.content.access === "catalogue_only" ? "Only catalogue information has been recorded." : "Authoritative material examination is recorded."}</div>
    <h3>Source and edition</h3><p>{trace.source.content.title}</p><p><a href={trace.source.content.sourceUrl || undefined} className="standards-link" target="_blank" rel="noreferrer">Authoritative source reference</a> · Source R{trace.source.number}</p>
    {trace.sourceCurrentRevisionId !== trace.source.id && <p className="standards-notice">A newer source revision exists. This requirement retains its pinned source.</p>}
    <h3>How EI Designer addresses this requirement</h3>
    <div className="standards-record-actions"><button className="standards-button" onClick={() => setEditor("implementation")}>Add implementation explanation</button><button className="standards-button" onClick={() => setEditor("evidence")}>Record evidence</button><button className="standards-button" onClick={() => setEditor("review")}>Record local review</button></div>
    {!trace.implementations.length ? <p>No implementation mapping has been recorded for this revision.</p> : trace.implementations.map(implementation => <article className="standards-card mb-3" key={implementation.id}><div className="flex justify-between gap-3"><h3>{implementation.content.title}</h3><span className="standards-badge">{humanize(implementation.content.implementationStatus)}</span></div><p>{implementation.content.behavior}</p><h3>Where to see it</h3><p>{implementation.content.whereToSee || "Not recorded"}</p><h3>Verification</h3><p>{implementation.content.verificationPlan}</p><h3>Limitations</h3><p>{implementation.content.limitations || "No limitations recorded; this does not establish complete coverage."}</p><Link className="standards-link" href={"/standards/records/implementation/" + implementation.entityId + "?revision=" + implementation.id}>Inspect implementation R{implementation.number}</Link></article>)}
    <h3>Verification evidence</h3><p className="standards-muted">Declared evidence. A passing recorded result is not authenticated verification or engineering approval.</p>
    {!trace.evidence.length ? <p>No evidence recorded.</p> : trace.evidence.map(evidence => <article className="standards-card my-2" key={evidence.id}><div className="flex justify-between gap-2"><strong className="text-xs">{evidence.description}</strong><span className="standards-badge">{evidence.result}</span></div><p>{humanize(evidence.type)} · {evidence.producer} · {evidence.recordedAt.slice(0, 10)}</p><p>{evidence.artifactReference || "No artifact reference"}{evidence.notes ? "\n" + evidence.notes : ""}</p>{evidence.buildId && <p className="standards-muted">Build: {evidence.buildId}</p>}{evidence.requirementRevisionId !== revisionId && <span className="standards-badge warning">Earlier requirement revision — stale for this revision</span>}<details className="mt-2"><summary className="text-xs">Evidence identity and dependencies</summary><p className="standards-muted">ID: {evidence.id}<br/>Requirement: {evidence.requirementRevisionId}<br/>Source: {evidence.sourceRevisionId}<br/>Implementation: {evidence.implementationRevisionId || "Requirement level"}</p></details></article>)}
    {editor === "implementation" && <StandardsEditor kind="implementation" preset={{ requirementRevisionId: revisionId, title: trace.requirement.content.title + " — Application Implementation" }} onClose={() => setEditor(null)} onSaved={saved}/>}
    {(editor === "evidence" || editor === "review") && <AssuranceEditor mode={editor} target={trace.requirement} evidence={currentEvidence} implementations={trace.implementations} onClose={() => setEditor(null)} onSaved={saved}/>}
  </section>;
}

