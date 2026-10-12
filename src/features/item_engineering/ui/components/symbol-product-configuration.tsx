"use client";
import { useEffect,useState } from "react";
import { loadProductConfigurationAction,saveProductConfigurationAction } from "../../api/product-actions";
import { projectItemProfileV3,validateProductCompatibility,type CompatibleProduct,type AdditionalProductPart,type ItemEngineeringRevision } from "../../api/public";
import { ProductItemSearch } from "./product-item-search";
type Workspace=Extract<Awaited<ReturnType<typeof loadProductConfigurationAction>>,{ok:true}>["data"];
export function SymbolProductConfiguration({symbolVersionId,readOnly}:{symbolVersionId:string;readOnly:boolean}){
  const [loaded,setLoaded]=useState<Workspace|null>(null);const [error,setError]=useState("");const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;loadProductConfigurationAction(symbolVersionId).then(r=>{if(!active)return;if(r.ok){setLoaded(r.data);setError("");}else setError(r.error);}).catch(()=>{if(active)setError("Compatible products could not be loaded.");});return()=>{active=false;};},[symbolVersionId,retry]);
  return <>{error&&<p role="alert">{error}<button className="icon-button" onClick={()=>setRetry(r=>r+1)}>Retry</button></p>}{loaded?<ProductConfigurationEditor key={symbolVersionId} symbolVersionId={symbolVersionId} initial={loaded} readOnly={readOnly||loaded.readOnly}/>:<p>Loading compatible products…</p>}</>;
}
function ProductConfigurationEditor({symbolVersionId,initial,readOnly}:{symbolVersionId:string;initial:Workspace;readOnly:boolean}){
  const [base,setBase]=useState(initial.configuration);const [options,setOptions]=useState<CompatibleProduct[]>(initial.configuration?.options??[]);
  const [parts,setParts]=useState<AdditionalProductPart[]>(initial.configuration?.parts??[]);const [revisions,setRevisions]=useState(initial.revisions);
  const [picker,setPicker]=useState<"option"|"part"|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const dirty=JSON.stringify({options,parts})!==JSON.stringify({options:base?.options??[],parts:base?.parts??[]});
  function add(revision:ItemEngineeringRevision){
    setRevisions(current=>current.some(r=>r.id===revision.id)?current:[...current,revision]);
    if(picker==="option")setOptions(current=>current.some(o=>o.itemEngineeringRevisionId===revision.id)?current:[...current,{itemId:revision.itemId,itemEngineeringRevisionId:revision.id,usage:initial.metadata.layoutUsage??"wiring",evidence:"",interface:{terminalMappings:[]}}]);
    else setParts(current=>[...current,{lineKey:crypto.randomUUID(),itemEngineeringRevisionId:revision.id,optionRevisionId:null,quantity:1,quantityRule:"fixed_per_assembly"}]);
    setPicker(null);setMessage("");
  }
  async function save(){setBusy(true);setMessage("");try{const result=await saveProductConfigurationAction({symbolVersionId,expectedConfigurationId:base?.id??null,options,parts});
    if(result.ok){setBase(result.data.configuration);setOptions(result.data.configuration.options);setParts(result.data.configuration.parts);setMessage(`Compatible products saved.${result.data.warnings.length?" "+result.data.warnings.join(" "):""}`);}else setMessage(result.error);
  }catch{setMessage("Save failed. Your draft is retained.");}finally{setBusy(false);}}
  const name=(id:string)=>{const revision=revisions.find(r=>r.id===id);return revision?`${revision.identity.displayName} · ${revision.identity.partNumber??revision.identity.itemKey} · rev ${revision.revisionNumber}`:id;};
  return <section className="space-y-4 p-1"><div className="flex flex-wrap items-center gap-2"><h2 className="mr-auto font-semibold">Compatible products</h2>
    {!readOnly&&<><button className="icon-button" disabled={busy} onClick={()=>setPicker("option")}>Add compatible Item</button><button className="icon-button" disabled={!dirty||busy||!options.length} onClick={()=>void save()}>{busy?"Saving…":"Save product configuration"}</button><button className="icon-button" disabled={!dirty||busy} onClick={()=>{setOptions(base?.options??[]);setParts(base?.parts??[]);setMessage("");}}>Cancel changes</button></>}
    </div><p className="text-sm text-slate-600">Each physical device selects one primary product. Additional parts are counted alongside that choice. This configuration belongs to the saved Symbol version; it does not change existing drawing selections.</p>
    {initial.contractChanged&&<p className="rounded bg-amber-50 p-3 text-sm">The saved Symbol interface has changed. Review all mappings and save a new configuration before making new selections.</p>}
    {message&&<p role="status" className="whitespace-pre-line rounded border p-3 text-sm">{message}</p>}
    {!options.length&&<p className="text-sm">No product alternatives configured. Existing drawings continue to use their legacy BOM.</p>}
    <fieldset disabled={readOnly||busy} className="space-y-4">{options.map((option,index)=>{
      const revision=revisions.find(r=>r.id===option.itemEngineeringRevisionId)!;const profile=projectItemProfileV3(revision.profile);
      const check=validateProductCompatibility(initial.metadata,revision,option);
      const update=(change:Partial<CompatibleProduct>)=>setOptions(current=>current.map((o,i)=>i===index?{...o,...change}:o));
      return <div className="rounded-lg border bg-white p-4" key={option.itemEngineeringRevisionId}><div className="flex flex-wrap gap-2"><a className="mr-auto font-medium text-teal-700" href={`/bom/items/${option.itemId}?revisionId=${option.itemEngineeringRevisionId}`} target="_blank" rel="noreferrer">{name(option.itemEngineeringRevisionId)}</a>
        <select aria-label={`Representation for ${revision.identity.displayName}`} className="field-input text-sm" value={option.usage} onChange={e=>update({usage:e.target.value as CompatibleProduct["usage"]})}><option value="wiring">Wiring</option><option value="panel_layout">Panel layout</option><option value="both">Wiring and panel layout</option></select>
        {!readOnly&&<button className="icon-button" onClick={()=>{setOptions(current=>current.filter((_,i)=>i!==index));setParts(current=>current.filter(p=>p.optionRevisionId!==option.itemEngineeringRevisionId));}}>Remove option</button>}</div>
        <label className="mt-3 block text-xs">Compatibility basis<input className="field-input mt-1 w-full" value={option.evidence} placeholder="Manufacturer drawing, reviewed interface or qualification reference" onChange={e=>update({evidence:e.target.value})}/></label>
        <details className="mt-3"><summary className="cursor-pointer text-sm">Terminal mapping · {option.interface.terminalMappings.length} mapped</summary><p className="my-2 text-xs text-slate-500">Map existing terminal keys explicitly. Anchors and electrical continuity are preserved.</p>
          <table className="w-full text-left text-xs"><thead><tr><th>Product terminal</th><th>Function</th><th>Symbol terminal</th></tr></thead><tbody>{profile.terminals.map(terminal=><tr key={terminal.id} className="border-t"><td className="p-1">{terminal.number}</td><td className="p-1">{terminal.function}</td><td className="p-1">{terminal.connectable?<select className="field-input w-full" aria-label={`Map terminal ${terminal.number}`} value={option.interface.terminalMappings.find(m=>m.terminalId===terminal.id)?.symbolTerminalKey??""} onChange={e=>update({interface:{terminalMappings:[...option.interface.terminalMappings.filter(m=>m.terminalId!==terminal.id),...(e.target.value?[{terminalId:terminal.id,symbolTerminalKey:e.target.value}]:[])]}})}><option value="">Unmapped</option>{initial.metadata.terminals.map(t=><option key={t.key} value={t.key}>{t.label} ({t.key})</option>)}</select>:"Unused / non-connectable"}</td></tr>)}</tbody></table>
        </details>{check.errors.length>0&&<p className="mt-2 whitespace-pre-line text-xs text-amber-800">{check.errors.join("\n")}</p>}</div>;
    })}</fieldset>
    <div className="flex items-center gap-2"><h3 className="mr-auto font-semibold">Additional parts</h3>{!readOnly&&<button className="icon-button" disabled={busy||!options.length} onClick={()=>setPicker("part")}>Add additional part</button>}</div>
    <fieldset disabled={readOnly||busy} className="space-y-2">{parts.map((part,index)=>{const update=(change:Partial<AdditionalProductPart>)=>setParts(current=>current.map((p,i)=>i===index?{...p,...change}:p));return <div key={part.lineKey} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm"><span className="mr-auto">{name(part.itemEngineeringRevisionId)}</span>
      <select className="field-input text-xs" aria-label={`Part ${index+1} applies to`} value={part.optionRevisionId??""} onChange={e=>update({optionRevisionId:e.target.value||null})}><option value="">Every selected product</option>{options.map(o=><option key={o.itemEngineeringRevisionId} value={o.itemEngineeringRevisionId}>{name(o.itemEngineeringRevisionId)}</option>)}</select>
      <input type="number" min="0" step="any" className="field-input w-20" aria-label={`Part ${index+1} quantity`} value={Number.isNaN(part.quantity)?"":part.quantity} onChange={e=>update({quantity:e.target.value===""?NaN:Number(e.target.value)})}/>
      <select className="field-input text-xs" aria-label={`Part ${index+1} quantity rule`} value={part.quantityRule} onChange={e=>update({quantityRule:e.target.value as AdditionalProductPart["quantityRule"]})}>{["fixed_per_assembly","per_cable_end","per_conductor_termination","per_connection","manual"].map(q=><option key={q} value={q}>{q.replaceAll("_"," ")}</option>)}</select>
      {!readOnly&&<button className="icon-button" onClick={()=>setParts(current=>current.filter((_,i)=>i!==index))}>Remove part</button>}</div>;})}</fieldset>
    {picker&&<ProductItemSearch onSelect={add} onClose={()=>setPicker(null)}/>}</section>;
}
