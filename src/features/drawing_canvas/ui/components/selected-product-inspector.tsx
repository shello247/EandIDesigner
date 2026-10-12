"use client";
import {useEffect,useMemo,useState} from "react";
import {ProjectEngineeringSettings} from "./project-engineering-settings";
import {loadSelectedProductAction} from "@/features/item_engineering/api/product-actions";
import {loadItemEngineeringRevisionAction} from "@/features/item_engineering/api/actions";
import {compareProductRevisions,type ItemEngineeringRevision} from "@/features/item_engineering/api/public";
import {projectItemProfileV3,type DrawingProductSelection,type EngineeringProjectSettings,type PhysicalProductTarget} from "@/features/item_engineering/api/public";
import {InheritedSpecifications} from "@/features/item_engineering/ui/components/inherited-specifications";
import {listPhysicalProducts,type PhysicalProduct} from "../../api/product-contracts";
import type {ApprovedDrawingSymbol} from "../../types";
import type {DrawingModel} from "../../data/schema";
export type ProductChange=(target:PhysicalProductTarget,selection:DrawingProductSelection,settings?:EngineeringProjectSettings)=>void;
export function SelectedProductInspector({model,symbols,assetId,onChange}:{model:DrawingModel;symbols:ApprovedDrawingSymbol[];assetId:string;onChange:ProductChange}){
  const allSubjects=useMemo(()=>listPhysicalProducts(model),[model]);const subjects=allSubjects.filter(s=>s.target.assetId===assetId);
  const [chosen,setChosen]=useState("");const subject=subjects.find(s=>s.key===chosen)??subjects[0];
  return <section className="rounded-lg border bg-white p-4"><h3 className="text-sm font-semibold">Selected product</h3>{subjects.length>1&&<select className="field-input my-2 w-full text-xs" aria-label="Physical product position" value={subject?.key??""} onChange={e=>setChosen(e.target.value)}>{subjects.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>}
    {subject?.versionId?<ProductDetails key={subject.key} model={model} symbols={symbols} subject={subject} subjects={allSubjects} onChange={onChange}/>:<p className="mt-2 text-xs text-slate-500">Choose a Symbol representation for this device first.</p>}</section>;
}
type Loaded=Extract<Awaited<ReturnType<typeof loadSelectedProductAction>>,{ok:true}>["data"];
function ProductDetails({model,symbols,subject,subjects,onChange}:{model:DrawingModel;symbols:ApprovedDrawingSymbol[];subject:PhysicalProduct;subjects:PhysicalProduct[];onChange:ProductChange}){
  const [loaded,setLoaded]=useState<Loaded|null>(null);const [message,setMessage]=useState("");const [retry,setRetry]=useState(0);const [candidate,setCandidate]=useState("");const [busy,setBusy]=useState(false);
  const [newer,setNewer]=useState<ItemEngineeringRevision|null>(null);
  const selectionJson=JSON.stringify(subject.selection);
  useEffect(()=>{let active=true;loadSelectedProductAction({versionId:subject.versionId,selection:selectionJson?JSON.parse(selectionJson):undefined}).then(r=>{if(active){if(r.ok){setLoaded(r.data);setMessage("");}else setMessage(r.error);}}).catch(()=>{if(active)setMessage("Product information could not be loaded.");});return()=>{active=false;};},[subject.versionId,selectionJson,retry]);
  async function select(){if(!loaded?.workspace.configuration)return;const configuration=loaded.workspace.configuration;
    const option=configuration.options.find(o=>o.itemEngineeringRevisionId===candidate);if(!option)return;
    setBusy(true);try{const selection:DrawingProductSelection={version:1,status:"selected",configurationId:configuration.id,itemId:option.itemId,itemEngineeringRevisionId:option.itemEngineeringRevisionId};
      const checked=await loadSelectedProductAction({versionId:subject.versionId,selection});
      if(checked.ok&&checked.data.selected.status==="selected"){onChange(subject.target,selection,undefined);setCandidate("");setMessage("Product chosen. Save the drawing to retain this selection.");}
      else setMessage(checked.ok?checked.data.selected.issues.join(" "):checked.error);
    }catch{setMessage("Product could not be selected.");}finally{setBusy(false);}}
  const product=loaded?.selected;const revision=product?.revision;const config=loaded?.workspace.configuration;
  const profile=revision?projectItemProfileV3(revision.profile):null;
  async function checkUpdate(){if(!revision)return;setBusy(true);try{const result=await loadItemEngineeringRevisionAction({itemId:revision.itemId});if(!result.ok)setMessage(result.error);else if(!result.data||result.data.id===revision.id)setMessage("This drawing already uses the latest Item revision.");else setNewer(result.data);}catch{setMessage("Newer revisions could not be checked.");}finally{setBusy(false);}}
  return <div className="mt-3 space-y-3">{message&&<p role="status" className="text-xs">{message}<button className="ml-2 underline" onClick={()=>setRetry(r=>r+1)}>Reload</button></p>}
    {!loaded&&<p className="text-xs">Loading product…</p>}
    {loaded&&<><p className="text-xs">{revision?<><strong>{revision.identity.displayName}</strong><br/>{revision.identity.manufacturer} · {revision.identity.partNumber??revision.identity.model} · revision {revision.revisionNumber}</>:subject.selection?"No primary product selected.":"Legacy device: existing specifications and BOM remain in use."}</p>
      {product?.issues.map(issue=><p key={issue} className="text-xs text-amber-800">{issue}</p>)}
      {config?<><label className="block text-xs">Choose a compatible product<select className="field-input mt-1 w-full" aria-label="Compatible product" value={candidate} onChange={e=>setCandidate(e.target.value)}><option value="">Select Item revision…</option>{config.options.map(option=>{const r=loaded.workspace.revisions.find(r=>r.id===option.itemEngineeringRevisionId);return <option key={option.itemEngineeringRevisionId} value={option.itemEngineeringRevisionId}>{r?.identity.displayName} · {r?.identity.partNumber??r?.identity.itemKey} · rev {r?.revisionNumber} · {option.usage.replaceAll("_"," ")}</option>;})}</select></label>
        {candidate&&<div className="rounded bg-amber-50 p-2 text-xs"><p>This choice applies to every view of {subject.label}. Review its terminal mapping and existing wiring. Project settings will be cleared for the new revision.</p><details><summary className="cursor-pointer">Review mapped terminals</summary>{config.options.find(o=>o.itemEngineeringRevisionId===candidate)?.interface.terminalMappings.map(m=><p key={m.terminalId}>{loaded.workspace.revisions.find(r=>r.id===candidate)&&projectItemProfileV3(loaded.workspace.revisions.find(r=>r.id===candidate)!.profile).terminals.find(t=>t.id===m.terminalId)?.number} → Symbol terminal {m.symbolTerminalKey}</p>)}</details><button className="icon-button mt-2" disabled={busy} onClick={()=>void select()}>Use this product</button></div>}
        {subject.selection?.status==="selected"&&<button className="icon-button text-xs" onClick={()=>onChange(subject.target,{version:1,status:"unassigned",configurationId:config.id},undefined)}>Clear product selection</button>}</>:<p className="text-xs text-slate-500">Configure compatible Items on the Symbol record before choosing a product.</p>}
      {subject.symbolId&&<a className="block text-xs text-teal-700 underline" href={`/symbols/${subject.symbolId}`} target="_blank" rel="noreferrer">Open Symbol compatibility</a>}
      {profile&&revision&&<><button className="icon-button text-xs" disabled={busy} onClick={()=>void checkUpdate()}>Check newer Item revision</button>
        {newer&&newer.id!==revision.id&&<div className="space-y-2 rounded border p-2 text-xs"><strong>Compare revision {revision.revisionNumber} → {newer.revisionNumber}</strong>{compareProductRevisions(revision,newer).map((change,i)=><div key={i}><strong>{change.label}</strong><p>Saved: {change.before}</p><p>New: {change.after}</p></div>)}
          <a href={`/bom/items/${newer.itemId}?revisionId=${newer.id}`} className="block text-teal-700 underline" target="_blank" rel="noreferrer">Review full new revision and interfaces</a>
          {config?.options.some(o=>o.itemEngineeringRevisionId===newer.id)?<button className="icon-button" onClick={()=>{setCandidate(newer.id);setNewer(null);}}>Review product update</button>:<p>The newer revision must be qualified in the Symbol compatibility configuration before this drawing can adopt it.</p>}
          <button className="icon-button" onClick={()=>setNewer(null)}>Keep saved revision</button></div>}
        <details><summary className="cursor-pointer text-xs font-semibold">Inherited specifications and evidence</summary><div className="mt-3"><InheritedSpecifications revision={revision}/></div></details>
        {subject.selection?.status==="selected"&&<ProjectEngineeringSettings model={model} symbols={symbols} definition={product?.option?.interface} subject={subject} subjects={subjects} revision={revision} onApply={settings=>onChange(subject.target,subject.selection!,settings)}/>}
      </>}
    </>}
  </div>;
}
