"use client";
import {useState} from "react";
import {engineeringProjectSettingsSchema,validateProjectEngineeringSettings,projectItemProfileV3,type ItemEngineeringRevision,type EngineeringProjectSettings} from "@/features/item_engineering/api/public";
import {ATTRIBUTE_TYPE_SEEDS} from "@/features/engineering_attributes/api/public";
import {loadSelectedProductAction} from "@/features/item_engineering/api/product-actions";
import {physicalProductKey,type PhysicalProduct} from "../../api/product-contracts";
import type {DrawingModel} from "../../data/schema";
import type {ApprovedDrawingSymbol} from "../../types";
import type {ProductInterface} from "@/features/item_engineering/api/public";
import {TerminalInstallationEditor} from "./terminal-installation-editor";
type SettingsProps={model:DrawingModel;symbols:ApprovedDrawingSymbol[];definition?:ProductInterface;subject:PhysicalProduct;subjects:PhysicalProduct[];revision:ItemEngineeringRevision;onApply:(settings:EngineeringProjectSettings)=>void};
const meanings=ATTRIBUTE_TYPE_SEEDS.filter(s=>s.definition.valueKind==="quantity"&&s.analysisKey);
export function ProjectEngineeringSettings({model,symbols,definition,subject,subjects,revision,onApply}:SettingsProps){
  const [open,setOpen]=useState(false);
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-xs font-semibold">Project settings, supply and assumptions</summary>{open&&<SettingsEditor key={JSON.stringify(subject.settings??{})} model={model} symbols={symbols} definition={definition} subject={subject} subjects={subjects} revision={revision} onApply={onApply}/>}</details>;
}
function SettingsEditor({model,symbols,definition,subject,subjects,revision,onApply}:SettingsProps){
  const [draft,setDraft]=useState<EngineeringProjectSettings>(()=>structuredClone(subject.settings??{modes:[],assumptions:[],channelRanges:[]}));
  const [error,setError]=useState("");const [outputs,setOutputs]=useState<string[]>([]);const [loading,setLoading]=useState(false);
  const profile=projectItemProfileV3(revision.profile);const assignment=draft.powerAssignment;
  const choices=subjects.filter(p=>p.key!==subject.key&&p.selection?.status==="selected");
  async function supply(key:string){
    const selected=choices.find(p=>p.key===key);setOutputs([]);
    if(!selected){setDraft(d=>({...d,powerAssignment:undefined}));return;}
    setDraft(d=>({...d,powerAssignment:{supply:selected.target,outputId:"",loadInputId:"device",supplyNature:"unknown"}}));
    if(!selected.versionId)return;setLoading(true);
    try{const result=await loadSelectedProductAction({versionId:selected.versionId,selection:selected.selection});
      if(result.ok&&result.data.selected.revision){const source=projectItemProfileV3(result.data.selected.revision.profile);setOutputs([...new Set(source.entries.flatMap(e=>e.scope.kind==="supply_output"?[e.scope.id]:[]))]);}
      else setError(result.ok?"Supply specifications are unavailable; preserve the assignment for review.":result.error);
    }catch{setError("Supply outputs could not be loaded.");}finally{setLoading(false);}
  }
  function apply(){const parsed=engineeringProjectSettingsSchema.safeParse(draft);if(!parsed.success){setError(parsed.error.issues.map(i=>i.message).join(" "));return;}
    const errors=validateProjectEngineeringSettings(profile,parsed.data);if(errors.length){setError(errors.join(" "));return;}onApply(parsed.data);setError("Project settings applied. Save the drawing to retain them.");}
  const updateAssignment=(change:Partial<NonNullable<EngineeringProjectSettings["powerAssignment"]>>)=>setDraft(d=>({...d,powerAssignment:d.powerAssignment?{...d.powerAssignment,...change}:undefined}));
  return <div className="mt-3 space-y-3 rounded border bg-slate-50 p-2 text-xs"><p>These settings describe this installation. Manufacturer limits remain unchanged.</p>
    {profile.modes.map(mode=><label className="block" key={mode.id}>{mode.label}<select aria-label={mode.label} className="field-input mt-1 w-full" value={draft.modes.find(m=>m.setId===mode.id)?.choiceId??""} onChange={e=>setDraft(d=>({...d,modes:[...d.modes.filter(m=>m.setId!==mode.id),...(e.target.value?[{setId:mode.id,choiceId:e.target.value}]:[])]}))}><option value="">Not selected — needs review</option>{mode.choices.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>)}
    <label className="block">Assigned supply<select className="field-input mt-1 w-full" aria-label="Assigned supply" disabled={loading} value={assignment?physicalProductKey(assignment.supply):""} onChange={e=>void supply(e.target.value)}><option value="">Unassigned</option>{choices.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
    {assignment&&<div className="space-y-2"><label className="block">Supply output identity<input className="field-input mt-1 w-full" aria-label="Supply output identity" list={`supply-outputs-${revision.id}`} value={assignment.outputId} placeholder="Match the supply specification scope" onChange={e=>updateAssignment({outputId:e.target.value})}/><datalist id={`supply-outputs-${revision.id}`}>{outputs.map(o=><option key={o} value={o}/>)}</datalist></label>
      <label className="block">Load input scope<select className="field-input mt-1 w-full" value={assignment.loadInputId} onChange={e=>updateAssignment({loadInputId:e.target.value})}><option value="device">Device consumption</option>{[...new Set(profile.entries.flatMap(e=>e.scope.kind==="supply_input"?[e.scope.id]:[]))].map(id=><option key={id} value={id}>{id}</option>)}</select></label>
      <label className="block">Supply type<select aria-label="Supply type" className="field-input mt-1 w-full" value={assignment.supplyNature} onChange={e=>updateAssignment({supplyNature:e.target.value as "ac"|"dc"|"unknown"})}><option value="unknown">Needs review</option><option value="dc">DC</option><option value="ac">AC</option></select></label>
      <label className="block">Operating voltage (V), if known<input className="field-input mt-1 w-full" type="number" min="0" step="any" value={assignment.voltageV??""} onChange={e=>updateAssignment({voltageV:e.target.value===""?undefined:Number(e.target.value)})}/></label><p className="text-slate-500">An engineer-entered voltage is provisional unless supported by the selected supply rating. Chassis membership does not assign power.</p>
    </div>}
    {profile.channels.filter(c=>c.ranges.length).map(channel=><label className="block" key={channel.id}>Channel {channel.number} operating range<select aria-label={`Channel ${channel.number} operating range`} className="field-input mt-1 w-full" value={(()=>{const r=draft.channelRanges.find(r=>r.channelId===channel.id);return r?JSON.stringify([r.minimum,r.maximum,r.unit]):"";})()} onChange={e=>{const range=e.target.value?JSON.parse(e.target.value) as [number,number,string]:null;setDraft(d=>({...d,channelRanges:[...d.channelRanges.filter(r=>r.channelId!==channel.id),...(range?[{channelId:channel.id,minimum:range[0],maximum:range[1],unit:range[2]}]:[])]}));}}><option value="">Not selected — needs review</option>{channel.ranges.map((r,i)=><option key={i} value={JSON.stringify([r.minimum,r.maximum,r.unit])}>{r.minimum} to {r.maximum} {r.unit}</option>)}</select></label>)}
    {profile.entries.filter(e=>e.condition).length>0&&<details><summary className="cursor-pointer">Confirm applicable conditions</summary><p className="my-2 text-slate-500">Confirmation is an engineering assumption and makes related results provisional.</p>{profile.entries.filter(e=>e.condition).map(e=><label className="my-2 flex gap-2" key={e.id}><input type="checkbox" checked={draft.confirmedConditions?.includes(e.id)??false} onChange={event=>setDraft(d=>({...d,confirmedConditions:[...(d.confirmedConditions??[]).filter(id=>id!==e.id),...(event.target.checked?[e.id]:[])]}))}/><span>{e.title}: {e.condition}</span></label>)}</details>}
    <details><summary className="cursor-pointer">Engineering assumptions · {draft.assumptions.length}</summary><p className="my-2 text-slate-500">Use only for missing information. Conflicting manufacturer ratings remain authoritative and visible for review.</p>
      {draft.assumptions.map((a,index)=>{const change=(patch:Partial<typeof a>)=>setDraft(d=>({...d,assumptions:d.assumptions.map((v,i)=>i===index?{...v,...patch}:v)}));return <div key={a.id} className="my-2 space-y-2 rounded border p-2"><select className="field-input w-full" aria-label={`Assumption ${index+1} meaning`} value={a.analysisKey} onChange={e=>{const m=meanings.find(m=>m.analysisKey===e.target.value);change({analysisKey:e.target.value,unit:m?.definition.canonicalUnit??"",value:NaN});}}><option value="">Choose specification…</option>{meanings.map(m=><option key={m.typeId} value={m.analysisKey!}>{m.definition.label}</option>)}</select>
        <div className="flex gap-1"><input className="field-input min-w-0 flex-1" aria-label={`Assumption ${index+1} value`} type="number" step="any" value={Number.isNaN(a.value)?"":a.value} onChange={e=>change({value:e.target.value===""?NaN:Number(e.target.value)})}/><input className="field-input w-16" aria-label={`Assumption ${index+1} units`} value={a.unit} onChange={e=>change({unit:e.target.value,value:NaN})}/></div>
        <select className="field-input w-full" aria-label={`Assumption ${index+1} scope`} value={a.scope?.kind??"device"} onChange={e=>change({scope:e.target.value==="device"?{kind:"device"}:{kind:e.target.value as "supply_input"|"supply_output",id:""}})}><option value="device">Device</option><option value="supply_input">Supply input</option><option value="supply_output">Supply output</option></select>
        {a.scope&&"id" in a.scope&&<input className="field-input w-full" aria-label={`Assumption ${index+1} scope identity`} value={a.scope.id} onChange={e=>change({scope:{kind:a.scope!.kind as "supply_input"|"supply_output",id:e.target.value}})}/>}
        <input className="field-input w-full" aria-label={`Assumption ${index+1} reason`} placeholder="Reason and basis for the estimate" value={a.reason} onChange={e=>change({reason:e.target.value})}/><button className="icon-button" onClick={()=>setDraft(d=>({...d,assumptions:d.assumptions.filter((_,i)=>i!==index)}))}>Remove assumption</button></div>;})}
      <button className="icon-button mt-2" onClick={()=>setDraft(d=>({...d,assumptions:[...d.assumptions,{id:crypto.randomUUID(),analysisKey:"",value:NaN,unit:"",reason:""}]}))}>Add assumption</button></details>
    <TerminalInstallationEditor model={model} symbols={symbols} definition={definition} subject={subject} profile={profile} value={draft.terminalConnections??[]} onChange={terminalConnections=>setDraft(d=>({...d,terminalConnections}))}/>
    {error&&<p role="status" className="whitespace-pre-line">{error}</p>}<button className="icon-button" onClick={apply}>Apply project settings</button>
  </div>;
}
