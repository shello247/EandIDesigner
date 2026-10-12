"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getStandardsDetailAction } from "../../api/actions";
import type { EntityKind } from "../../data/schema";
import type { ReviewNote, Revision } from "../../types";
import { StandardsEditor, humanize } from "./standards-editor";
import { PinnedRevision } from "./revision-picker";
import { RequirementTracePanel } from "./requirement-trace-panel";
import { ProfileContextPanel } from "./profile-context-panel";
import { AssuranceEditor } from "./assurance-editor";
export function StandardsRecord({ kind, entityId, embedded = false, onChanged, initialRevisionId }: { kind: EntityKind; entityId: string; embedded?: boolean; onChanged?: () => void; initialRevisionId?: string }) {
  const [data, setData] = useState<{ revision: Revision; current: Revision; history: Revision[]; reviews: ReviewNote[] } | null>(null);
  const [selected, setSelected] = useState<string | undefined>(initialRevisionId), [historyPage, setHistoryPage] = useState(1), [tick, setTick] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState(""), [editing, setEditing] = useState(false);
  const reload = useCallback(() => { setTick(value => value + 1); onChanged?.(); }, [onChanged]);
  useEffect(() => {
    let cancelled = false;
    getStandardsDetailAction({ kind, entityId, revisionId: selected, historyPage }).then(result => {
      if (cancelled) return;
      if (result.ok) { setData(result.data); setError(""); } else setError(result.error);
    });
    return () => { cancelled = true; };
  }, [kind, entityId, selected, historyPage, tick]);
  return <div className={embedded ? "standards-record" : "standards-workspace"}>{!embedded && <Link className="standards-link" href="/standards">← Standards &amp; Assurance</Link>}
    {error && <div className="standards-error" role="alert">{error}<button className="standards-button" onClick={reload}>Retry</button></div>}
    {!data ? !error && <p role="status" className="standards-empty">Loading record…</p> : <section className={embedded ? "" : "standards-panel standards-record mt-4"}>
      <h2>{data.revision.content.title}</h2><div className="flex flex-wrap gap-2"><span className="standards-badge">{humanize(kind)} · R{data.revision.number}</span><span className="standards-badge">{data.revision.content.status}</span>{data.revision.id !== data.current.id && <span className="standards-badge warning">Historical revision</span>}</div>
      <div className="standards-record-actions"><button className="standards-button primary" onClick={() => setEditing(true)} disabled={data.revision.id !== data.current.id}>Edit current revision</button></div>
      <div className="standards-record-grid"><div><RecordFields kind={kind} revision={data.revision}/>
        {kind === "requirement" && <RequirementTracePanel revisionId={data.revision.id} tick={tick} onChanged={reload}/>}
        {kind === "profile" && <ProfileContextPanel revisionId={data.revision.id} currentRevisionId={data.current.id} tick={tick} onChanged={reload}/>}
        {kind === "implementation" && <button className="standards-button mt-4" onClick={() => setReviewing(true)}>Record local review</button>}
      </div>
      <aside className="standards-record-side"><h3>Revision history</h3><div className="standards-history">{data.history.map(revision => <button key={revision.id} className="standards-button" aria-pressed={data.revision.id === revision.id} onClick={() => setSelected(revision.id)}>R{revision.number} · {new Date(revision.createdAt).toLocaleString("en-GB", { timeZone: "America/Port_of_Spain" })}</button>)}</div><div className="mt-2 flex gap-2"><button className="standards-button" disabled={historyPage === 1} onClick={() => setHistoryPage(historyPage - 1)}>Newer</button><button className="standards-button" disabled={data.history.length < 20} onClick={() => setHistoryPage(historyPage + 1)}>Older</button></div><h3>Local review history</h3>{data.reviews.length ? data.reviews.map(review => <div key={review.id} className="standards-card mb-2"><strong className="text-xs">{humanize(review.outcome)}</strong><p>{review.reviewer} · {review.reviewedAt.slice(0, 10)}</p><p>{review.comments}</p><p className="standards-muted">Identity not authenticated</p></div>) : <p>No local reviews recorded for this revision.</p>}</aside></div>
    </section>}
    {editing && data && <StandardsEditor kind={kind} revision={data.current} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setSelected(undefined); reload(); }}/>}
    {reviewing && data && kind === "implementation" && <AssuranceEditor mode="review" kind="implementation" target={data.revision} onClose={() => setReviewing(false)} onSaved={() => { setReviewing(false); reload(); }}/>}
  </div>;
}
export function RecordFields({ kind, revision }: { kind: EntityKind; revision: Revision }) {
  const content = revision.content as unknown as Record<string, unknown>;
  return <div>{Object.entries(content).filter(([key]) => !["title", "status", "entries", "controls", "technicalReferences"].includes(key)).map(([key, value]) => <section key={key}><h3>{humanize(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</h3>{key === "sourceRevisionId" ? <PinnedRevision kind="reference" revisionId={String(value)}/> : key === "requirementRevisionId" ? <PinnedRevision kind="requirement" revisionId={String(value)}/> : key === "sourceUrl" && value ? <a className="standards-link" href={String(value)} target="_blank" rel="noreferrer">{String(value)}</a> : <p>{String(value || "Not recorded")}</p>}</section>)}
    {kind === "implementation" && <><h3>Implementation controls</h3>{((content.controls ?? []) as Array<{ title: string; description: string }>).map((control, index) => <div className="standards-card mb-2" key={index}><strong>{control.title}</strong><p>{control.description}</p></div>)}<details className="standards-card mt-3"><summary>Technical references</summary>{((content.technicalReferences ?? []) as string[]).map((ref, index) => <p key={index}>{ref}</p>)}</details></>}
    {kind === "profile" && <p className="standards-notice">{(content.entries as unknown[]).length} requirement revisions pinned. Local report workflow.</p>}
  </div>;
}
