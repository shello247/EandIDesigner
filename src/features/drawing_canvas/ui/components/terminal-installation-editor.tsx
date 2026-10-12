"use client";
import {useMemo,useState} from "react";
import type {DrawingModel} from "../../data/schema";
import type {ApprovedDrawingSymbol} from "../../types";
import type {PhysicalProduct} from "../../api/product-contracts";
import type {ProductInterface,ItemProfileV3,EngineeringProjectSettings} from "@/features/item_engineering/api/public";
import {buildPackageConnectivityGraph} from "@/features/drawing_panel_wiring/api/public";
import {buildDrawingPanelWiringSource} from "../../logic/services/drawing-panel-wiring-source";
import {productConnectionIndex} from "@/features/drawing_panel_analysis/api/connection-contracts";
type Installation=NonNullable<EngineeringProjectSettings["terminalConnections"]>[number];
type Props={model:DrawingModel;symbols:ApprovedDrawingSymbol[];subject:PhysicalProduct;definition?:ProductInterface;profile:ItemProfileV3;value:Installation[];onChange:(rows:Installation[])=>void};
export function TerminalInstallationEditor(props:Props){
  const [open,setOpen]=useState(false);
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer">Terminal installation details</summary>{open&&<InstallationRows {...props}/>}</details>;
}
function InstallationRows({model,symbols,subject,definition,profile,value,onChange}:Props){
  const rows=useMemo(()=>{
    const graph=buildPackageConnectivityGraph(buildDrawingPanelWiringSource(model,symbols));
    return productConnectionIndex(model,graph,subject,definition).flatMap(row=>row.connections.map(connection=>({...row,connection})));
  },[model,symbols,subject,definition]);
  const stale=value.filter(v=>!rows.some(r=>r.terminalId===v.terminalId&&r.connection.id===v.connectionId));
  return <div className="mt-2 space-y-2"><p>Conductor class and termination describe each actual landing. A size entered here is provisional when no saved wire specification supplies it.</p>
    {!rows.length&&<p className="text-amber-800">No mapped canonical wire landings are available for this product. Check the terminal mapping and wiring representation.</p>}
    {rows.map(row=>{const recorded=value.find(v=>v.terminalId===row.terminalId&&v.connectionId===row.connection.id);const change=(patch:Partial<Installation>)=>onChange([...value.filter(v=>v!==recorded),{terminalId:row.terminalId,connectionId:row.connection.id,...recorded,...patch}]);
      return <fieldset className="space-y-1 rounded border p-2" key={`${row.nodeId}:${row.connection.id}`}><legend>Terminal {profile.terminals.find(t=>t.id===row.terminalId)?.number} · {row.connection.label} · {row.side}</legend>
        <label className="block">Conductor class<select className="field-input w-full" value={recorded?.conductorClass??""} onChange={e=>change({conductorClass:(e.target.value||undefined) as Installation["conductorClass"]})}><option value="">Needs review</option><option value="solid">Solid</option><option value="stranded">Stranded</option><option value="fine_stranded">Fine stranded</option></select></label>
        <label className="block">Termination<select className="field-input w-full" value={recorded?.termination??""} onChange={e=>change({termination:(e.target.value||undefined) as Installation["termination"]})}><option value="">Needs review</option><option value="bare">Bare</option><option value="ferruled">Ferruled</option></select></label>
        {row.connection.size&&<p>Saved wire size: {row.connection.size}</p>}
        <label className="block">Project size, if missing<input className="field-input w-full" value={recorded?.size??""} placeholder="e.g. 1.5 mm² or 16 AWG" onChange={e=>change({size:e.target.value||undefined})}/></label>
      </fieldset>;
    })}
    {stale.length>0&&<div className="text-amber-800"><p>{stale.length} installation records refer to landings no longer present.</p><button className="icon-button" onClick={()=>onChange(value.filter(v=>!stale.includes(v)))}>Remove stale installation records</button></div>}
  </div>;
}
