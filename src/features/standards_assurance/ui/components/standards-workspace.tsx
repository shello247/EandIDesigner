"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Search, BookOpenCheck, ArrowRight } from "lucide-react";
import { getStandardsDashboardAction, listStandardsAction, seedStandardsAction } from "../../api/actions";
import type { EntityKind } from "../../data/schema";
import type { Summary } from "../../types";
import { StandardsEditor } from "./standards-editor";
import { StandardsRecord } from "./standards-record";
export const workspaceTabs = [
  { id: "reference", title: "Standards Register" }, { id: "requirement", title: "Requirements" },
  { id: "implementation", title: "Application Implementation" }, { id: "evidence", title: "Verification & Evidence" },
  { id: "profile", title: "Profiles & History" }
] as const;
export function recordHref(kind: EntityKind, id: string) {
  return kind === "requirement" ? "/standards/requirements/" + id : kind === "profile" ? "/standards/profiles/" + id : "/standards/records/" + kind + "/" + id;
}
export function StandardsWorkspace() {
  const [tab, setTab] = useState<string>("reference"), [query, setQuery] = useState(""), [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "retired" | "all">("active"), [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Summary[]; total: number; pageSize: number }>({ rows: [], total: 0, pageSize: 20 });
  const [counts, setCounts] = useState({ sources: 0, requirements: 0, implementations: 0, profiles: 0, evidence: 0, reviews: 0 });
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [editor, setEditor] = useState(false), [tick, setTick] = useState(0);
  const [inspect, setInspect] = useState<Summary | null>(null);
  const kind = (tab === "evidence" ? "requirement" : tab) as EntityKind;
  const reload = useCallback(() => setTick(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listStandardsAction({ kind, query: search, status, page }), getStandardsDashboardAction()]).then(([list, stats]) => {
      if (cancelled) return;
      if (list.ok) { setData(list.data); setError(""); } else setError(list.error);
      if (stats.ok) setCounts(stats.data); else if (list.ok) setError(stats.error);
      setBusy(false);
    }).catch(() => { if (!cancelled) { setError("Connection interrupted. Retry to reload the register."); setBusy(false); } });
    return () => { cancelled = true; };
  }, [kind, search, status, page, tick]);
  const selectTab = (value: string) => { setTab(value); setPage(1); setInspect(null); setBusy(true); reload(); };
  return <main className="standards-workspace">
    <header className="standards-heading"><div><div className="standards-eyebrow"><BookOpenCheck size={15} /> ENGINEERING BASIS</div><h1>Standards &amp; Assurance</h1><p>Source → Requirement → Application implementation → Evidence → Recorded review</p></div><span className="standards-badge">Local workflow</span></header>
    <section className="standards-stats" aria-label="Register totals">{Object.entries(counts).map(([name, value]) => <div key={name}><strong>{value}</strong><span>{name}</span></div>)}</section>
    <div className="standards-notice">Requirements and evidence are recorded separately. Local reviewer identities are self-declared; this register does not certify a drawing.</div>
    <nav className="standards-tabs" aria-label="Standards workspace">{workspaceTabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => selectTab(item.id)}>{item.title}</button>)}</nav>
    <section className="standards-panel">
      <div className="standards-toolbar"><form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query); setBusy(true); reload(); }} className="standards-search"><Search size={16}/><input aria-label="Search standards records" placeholder="Search by title or reference…" value={query} onChange={event => setQuery(event.target.value)}/><button className="standards-button" type="submit">Search</button></form>
        <select className="field-input standards-status-filter" aria-label="Record lifecycle" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); setBusy(true); }}><option value="active">Active</option><option value="retired">Retired</option><option value="all">All records</option></select>
        <button type="button" className="standards-button" aria-label="Refresh register" onClick={() => { setBusy(true); reload(); }}><RefreshCw size={15}/></button>
        {tab !== "evidence" && <button type="button" className="standards-button primary" onClick={() => setEditor(true)}><Plus size={16}/>Add {kind === "reference" ? "source" : kind}</button>}
      </div>
      {tab === "evidence" && <p className="standards-hint">Open a requirement to inspect its source, record evidence and add a local review. Use Profiles &amp; History for scoped coverage and dossiers.</p>}
      {error && <div role="alert" className="standards-error">{error}<button className="standards-button" onClick={reload}>Retry</button></div>}
      {busy ? <p role="status" className="standards-empty">Loading records…</p> : !data.rows.length ? <div className="standards-empty"><h2>{search ? "No matching records" : "No records yet"}</h2><p>{search ? "Try another title or reference, or change the lifecycle filter." : "Start with a source, then trace its requirements into application behavior and evidence."}</p>{counts.sources === 0 && !error && <button type="button" className="standards-button primary" onClick={async () => { setBusy(true); const result = await seedStandardsAction(); if (!result.ok) setError(result.error); reload(); }}>Load curated starter register</button>}</div> : <div className="standards-table-scroll"><table className="standards-table"><thead><tr><th>Record</th><th>Reference</th><th>Revision</th><th>Lifecycle</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id}><td><Link href={recordHref(kind, row.id)}>{row.title}</Link>{row.contentStatus && <div className="mt-1"><span className={"standards-badge " + (row.contentStatus === "candidate" ? "warning" : "")}>{row.contentStatus.replaceAll("_", " ")}</span></div>}</td><td className="standards-muted">{row.referenceLabel ?? row.key}</td><td>R{row.revision}</td><td><span className="standards-badge">{row.status}</span></td><td><button type="button" className="standards-button" aria-label={"Inspect " + row.title} onClick={() => setInspect(row)}>Inspect <ArrowRight size={14}/></button></td></tr>)}</tbody></table></div>}
      <footer className="standards-pagination"><span>{data.total} records · Page {page}</span><div><button className="standards-button" disabled={page === 1 || busy} onClick={() => { setPage(page - 1); setBusy(true); }}>Previous</button><button className="standards-button" disabled={page * data.pageSize >= data.total || busy} onClick={() => { setPage(page + 1); setBusy(true); }}>Next</button></div></footer>
    </section>
    {editor && <StandardsEditor kind={kind} onClose={() => setEditor(false)} onSaved={() => { setEditor(false); reload(); }}/>}
    {inspect && <section className="standards-panel standards-inspection"><div className="standards-toolbar"><h2>Record inspection</h2><button className="standards-button" onClick={() => setInspect(null)}>Close inspection</button></div><StandardsRecord key={inspect.id} kind={kind} entityId={inspect.id} embedded onChanged={reload}/></section>}
  </main>;
}
