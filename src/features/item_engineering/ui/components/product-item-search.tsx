"use client";
import { useState } from "react";
import { searchProductItemsAction } from "../../api/product-actions";
import { loadItemEngineeringRevisionAction } from "../../api/actions";
import type { ItemEngineeringRevision } from "../../api/public";
export function ProductItemSearch({onSelect,onClose}:{onSelect:(revision:ItemEngineeringRevision)=>void;onClose:()=>void}){
  const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [rows,setRows]=useState<Array<{itemId:string;name:string;manufacturer:string|null;partNumber:string|null;revisionId:string;revisionNumber:number}>>([]);
  async function search(){setBusy(true);setError("");try{const result=await searchProductItemsAction(query);if(result.ok)setRows(result.data);else setError(result.error);}catch{setError("Products could not be loaded. Retry the search.");}finally{setBusy(false);}}
  async function select(row:typeof rows[number]){setBusy(true);try{const result=await loadItemEngineeringRevisionAction({itemId:row.itemId,revisionId:row.revisionId});if(result.ok&&result.data)onSelect(result.data);else setError(result.ok?"Revision unavailable.":result.error);}catch{setError("Product revision could not be loaded.");}finally{setBusy(false);}}
  return <div role="dialog" aria-modal="true" aria-label="Choose Item" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
    <h2 className="font-semibold">Choose Item</h2><p className="my-2 text-xs text-slate-600">Search active Items with a saved engineering revision. Product compatibility requires explicit review.</p>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void search();}}><input className="field-input flex-1" aria-label="Search Items" value={query} onChange={e=>setQuery(e.target.value)} autoFocus/><button className="icon-button" disabled={busy}>Search</button></form>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<ul className="my-3 space-y-2">{rows.map(row=><li key={row.revisionId}><button className="w-full rounded border p-2 text-left text-sm hover:bg-teal-50" disabled={busy} onClick={()=>void select(row)}>{row.name}<span className="block text-xs text-slate-500">{row.manufacturer} · {row.partNumber} · Revision {row.revisionNumber}</span></button></li>)}</ul>
    <button className="icon-button" onClick={onClose}>Close</button></div></div>;
}
