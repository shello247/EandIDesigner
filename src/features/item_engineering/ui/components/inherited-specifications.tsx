"use client";
import {useState} from "react";
import {projectItemProfileV3,type ItemEngineeringRevision,type AttributeEvidence} from "../../api/public";
import {specificationValueLabel} from "../../logic/services/specification-display";
import {loadAttributeEvidenceAction} from "../../api/batch-actions";
export function EvidenceLinks({revision,evidence}:{revision:Pick<ItemEngineeringRevision,"itemId"|"id">;evidence:AttributeEvidence[]}){
  const [links,setLinks]=useState<Array<{label:string;href:string}>>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function load(){setBusy(true);setError("");try{const result=await loadAttributeEvidenceAction({itemId:revision.itemId,revisionId:revision.id});
    if(!result.ok){setError(result.error);return;}
    setLinks(evidence.map(e=>{
      if(e.kind==="url")return {label:e.label||e.url,href:e.url};
      if(e.kind==="engineer")return {label:e.reference,href:""};
      const source=result.data.sources.find(s=>s.kind===e.kind&&s.id===e.id&&s.contentHash===e.contentHash);
      if(!source)return {label:"Retained source unavailable",href:""};
      return {label:`${source.label}${e.kind==="document"&&e.page?`, p. ${e.page}`:""}${e.section?`, ${e.section}`:""}`,href:source.href+(e.kind==="document"&&e.page?`#page=${e.page}`:"")};
    }));
  }catch{setError("Sources could not be loaded.");}finally{setBusy(false);}}
  if(!evidence.length)return <span className="text-slate-500">No linked source</span>;
  return <span>{!links.length&&<button className="text-teal-700 underline" disabled={busy} onClick={()=>void load()}>{busy?"Loading…":`View ${evidence.length} source${evidence.length===1?"":"s"}`}</button>}{links.map((link,i)=><span key={i} className="block">{link.href?<a href={link.href} target="_blank" rel="noreferrer" className="text-teal-700 underline">{link.label}</a>:link.label}</span>)}{error&&<span role="alert">{error}</span>}</span>;
}
export function InheritedSpecifications({revision}:{revision:ItemEngineeringRevision}){
  const profile=projectItemProfileV3(revision.profile);const [search,setSearch]=useState("");
  return <div className="space-y-3"><p className="text-xs text-slate-500">Manufacturer specifications · saved Item revision {revision.revisionNumber} · read-only in this drawing</p>
    <input className="field-input w-full text-xs" aria-label="Search inherited specifications" placeholder="Search specifications" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="space-y-2">{profile.entries.filter(e=>`${e.title} ${e.condition}`.toLowerCase().includes(search.toLowerCase())).map(entry=><div key={entry.id} className="rounded border p-2 text-xs"><div className="flex justify-between gap-3"><strong>{entry.title}</strong><span>{specificationValueLabel(entry)}</span></div><p className="mt-1 text-slate-500">{entry.scope.kind.replaceAll("_"," ")}{"id" in entry.scope?` ${entry.scope.id}`:""}{entry.condition?` · ${entry.condition}`:""}{entry.modes.map(m=>` · ${profile.modes.find(s=>s.id===m.setId)?.choices.find(c=>c.id===m.choiceId)?.label??m.choiceId}`).join("")}</p><EvidenceLinks revision={revision} evidence={entry.evidence}/>{entry.source.reference&&!entry.evidence.length&&<p>{entry.source.reference}</p>}</div>)}</div>
    {profile.channels.length>0&&<details><summary className="cursor-pointer text-xs font-semibold">Channels and physical terminals</summary><div className="mt-2 space-y-2">{profile.channels.map(channel=><div key={channel.id} className="rounded border p-2 text-xs"><strong>Channel {channel.number}</strong> · {channel.direction} · {channel.signalType.replaceAll("_"," ")}<ul>{channel.terminals.map(member=>{const terminal=profile.terminals.find(t=>t.id===member.terminalId);return <li key={member.terminalId}>Terminal {terminal?.number} · {member.function}{terminal?.isolationGroup?` · isolation: ${terminal.isolationGroup}`:""}</li>;})}</ul><EvidenceLinks revision={revision} evidence={channel.evidence}/></div>)}</div><p className="mt-2 text-xs">Unused terminals: {profile.terminals.filter(t=>!t.connectable).map(t=>t.number).join(", ")||"None recorded"}</p></details>}
  </div>;
}
