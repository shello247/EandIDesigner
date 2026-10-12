"use client";
import { useEffect, useState } from "react";
import { EngineeringDialog } from "@/shared/ui/engineering-dialog";
import { getStandardsRevisionAction, listStandardsAction } from "../../api/actions";
import type { EntityKind } from "../../data/schema";
import type { Summary } from "../../types";
export function RevisionPicker({ kind, onPick, onClose }: { kind: EntityKind; onPick: (row: Summary) => void; onClose: () => void }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(1), [rows, setRows] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      listStandardsAction({ kind, query, page, status: "active" }).then(result => {
        if (cancelled) return;
        if (result.ok) { setRows(result.data.rows); setTotal(result.data.total); setError(""); } else setError(result.error);
        setLoading(false);
      });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [kind, query, page]);
  return <EngineeringDialog title={"Choose " + kind} compact onClose={onClose}>
    <div className="standards-toolbar"><input className="field-input" aria-label={"Search " + kind} placeholder="Search active records…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); setLoading(true); }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}/></div>
    <div className="min-h-0 flex-1 overflow-auto p-3">{error && <p role="alert" className="standards-error">{error}</p>}{loading ? <p role="status">Loading…</p> : !rows.length ? <p className="standards-empty">No matching active records.</p> : <div className="standards-detail-list">{rows.map(row => <button type="button" className="standards-card text-left hover:bg-slate-50" key={row.id} onClick={() => onPick(row)}><strong className="block text-xs">{row.title}</strong><span className="standards-muted">R{row.revision} · {row.key}</span></button>)}</div>}</div>
    <footer className="standards-form-footer"><span className="mr-auto text-xs text-slate-500">Page {page} · {total} records</span><button className="standards-button" type="button" disabled={page === 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Previous</button><button className="standards-button" type="button" disabled={page * 20 >= total} onClick={() => { setPage(page + 1); setLoading(true); }}>Next</button><button className="standards-button" type="button" onClick={onClose}>Cancel</button></footer>
  </EngineeringDialog>;
}
export function PinnedRevision({ kind, revisionId }: { kind: EntityKind; revisionId: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!revisionId) return;
    getStandardsRevisionAction({ kind, revisionId }).then(result => { if (!cancelled) setLabel(result.ok ? result.data.content.title + " · R" + result.data.number : "Revision unavailable"); });
    return () => { cancelled = true; };
  }, [kind, revisionId]);
  return <span className="standards-muted">{revisionId ? label || "Loading pinned revision…" : "No revision selected"}</span>;
}

