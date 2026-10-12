"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createStandardsSnapshotAction, getProfileAction, listStandardsSnapshotsAction } from "../../api/actions";
import type { StandardsContext } from "../../types";
import { AssuranceEditor } from "./assurance-editor";
import { humanize } from "./standards-editor";
export function ProfileContextPanel({ revisionId, currentRevisionId, tick, onChanged }: { revisionId: string; currentRevisionId: string; tick: number; onChanged: () => void }) {
  const [context, setContext] = useState<StandardsContext | null>(null), [error, setError] = useState("");
  const [snapshots, setSnapshots] = useState<Array<{ id: string; createdAt: string; contentHash: string; profileRevisionId: string }>>([]);
  const [snapshotPage, setSnapshotPage] = useState(1), [snapshotTotal, setSnapshotTotal] = useState(0), [reviewing, setReviewing] = useState(false), [busy, setBusy] = useState(false);
  const snapshotOperation = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getProfileAction(revisionId).then(async result => {
      if (cancelled) return;
      if (result.ok) {
        setContext(result.data); setError("");
        const history = await listStandardsSnapshotsAction({ profileId: result.data.profile.entityId, page: snapshotPage });
        if (!cancelled) { if (history.ok) { setSnapshots(history.data.rows); setSnapshotTotal(history.data.total); } else setError(history.error); }
      } else setError(result.error);
    });
    return () => { cancelled = true; };
  }, [revisionId, tick, snapshotPage]);
  if (error && !context) return <p className="standards-error" role="alert">{error}</p>;
  if (!context || context.profile.id !== revisionId) return <p role="status">Loading profile coverage…</p>;
  const coverage = context.coverage;
  async function snapshot() {
    setBusy(true); setError(""); snapshotOperation.current ??= crypto.randomUUID();
    try {
      const result = await createStandardsSnapshotAction({ operationId: snapshotOperation.current, profileRevisionId: revisionId, expectedCurrentRevisionId: currentRevisionId, expectedAssessmentHash: context!.assessmentHash });
      if (result.ok) { snapshotOperation.current = null; onChanged(); } else setError(result.error);
    } catch { setError("Connection interrupted. Retry to recover the same snapshot operation."); }
    finally { setBusy(false); }
  }
  const counters = [
    ["Source checked", coverage.sourceChecked], ["Candidates", coverage.candidates], ["Implemented", coverage.implemented], ["Planned", coverage.planned],
    ["Unmapped / not planned", coverage.notPlanned], ["Evidence recorded", coverage.evidenceRecorded], ["Evidence stale", coverage.evidenceStale], ["Evidence missing", coverage.evidenceMissing],
    ["Applies", coverage.applies], ["Excluded", coverage.excluded], ["Unresolved", coverage.unresolved], ["Failed checks", coverage.failedEvidence],
    ["Local reviews", coverage.reviewRecorded], ["Changes requested", coverage.changesRequested]
  ];
  return <section><h3>Scoped coverage</h3><p>Counts describe the selected requirement revisions. Evidence is declared; no overall compliance percentage is calculated.</p>
    <div className="standards-coverage">{counters.map(([label, value]) => <div key={label}><strong>{value}</strong>{label}</div>)}</div>
    <details className="standards-card" open={coverage.empty}><summary>{coverage.gaps.length} findings, exclusions and outstanding checks</summary><ul className="standards-gap-list">{coverage.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></details>
    <div className="standards-record-actions"><button className="standards-button" onClick={() => setReviewing(true)}>Record profile review</button><button className="standards-button primary" disabled={busy || revisionId !== currentRevisionId} onClick={snapshot}>{busy ? "Freezing report…" : "Create report snapshot"}</button></div>
    {error && <div className="standards-error" role="alert">{error}</div>}
    <p className="standards-muted">Snapshots preserve the displayed scope, gaps, evidence and local-review status. Build: {context.buildId}</p>
    <h3>Pinned requirements</h3><div className="standards-detail-list">{context.rows.map(row => <article className="standards-card" key={row.trace.requirement.id}><Link className="standards-link" href={"/standards/requirements/" + row.trace.requirement.entityId + "?revision=" + row.trace.requirement.id}>{row.trace.requirement.content.title} · R{row.trace.requirement.number}</Link><div className="mt-2 flex flex-wrap gap-2"><span className="standards-badge">{humanize(row.trace.requirement.content.sourceStatus)}</span><span className="standards-badge">{humanize(row.entry.applicability)}</span><span className="standards-badge">{row.implementation ? humanize(row.implementation.content.implementationStatus) : "Not mapped"}</span><span className="standards-badge">{row.evidence.length ? row.evidence.some(e => !e.stale) ? "Evidence recorded" : "Evidence stale" : "Evidence missing"}</span></div><p>{row.entry.rationale}</p>{row.entry.conflict && <p>Conflict: {row.entry.conflict}</p>}{row.evidence.filter(e => e.stale).map(e => <p className="standards-muted" key={e.id}>{e.description}: {e.reasons.join("; ")}</p>)}</article>)}</div>
    <h3>Frozen report history</h3>{!snapshots.length ? <p>No snapshots created yet.</p> : <div className="standards-detail-list">{snapshots.map(row => <div className="standards-card" key={row.id}><strong className="text-xs">Snapshot · {new Date(row.createdAt).toLocaleString("en-GB", { timeZone: "America/Port_of_Spain" })}</strong><p className="standards-muted">{row.id}</p><div className="mt-2 flex flex-wrap gap-2"><a className="standards-button" href={"/standards/snapshots/" + row.id + "/html"} target="_blank" rel="noreferrer">Open dossier / Print</a><a className="standards-button" href={"/standards/snapshots/" + row.id + "/json"}>Download JSON</a></div></div>)}</div>}
    <div className="standards-pagination"><span>{snapshotTotal} snapshots · Page {snapshotPage}</span><div><button className="standards-button" disabled={snapshotPage === 1} onClick={() => setSnapshotPage(snapshotPage - 1)}>Newer</button><button className="standards-button" disabled={snapshotPage * 20 >= snapshotTotal} onClick={() => setSnapshotPage(snapshotPage + 1)}>Older</button></div></div>
    {reviewing && <AssuranceEditor mode="review" kind="profile" target={context.profile} evidence={context.rows.flatMap(row => row.evidence.filter(e => e.requirementRevisionId === row.trace.requirement.id))} onClose={() => setReviewing(false)} onSaved={() => { setReviewing(false); onChanged(); }}/>}
  </section>;
}
